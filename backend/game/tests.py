import os
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import connection
from django.db.utils import ProgrammingError
from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITransactionTestCase, APITestCase

from backend.runtime_bootstrap import RuntimeBootstrapMiddleware
from .data.load_questions import load_questions
from .data.questions_data import DEPRECATED_QUESTION_TEXTS, questions as bundled_questions
from .models import BlackCard, Leaderboard, Match, Question, MATCH_TARGET_SCORE, QUESTION_TIME_LIMIT_SECONDS

User = get_user_model()


class AuthAndLeaderboardTests(APITestCase):
    def test_register_creates_user_and_leaderboard(self):
        response = self.client.post(
            '/api/register/',
            {
                'username': 'newplayer',
                'email': 'newplayer@example.com',
                'password': 'StrongPass123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username='newplayer')
        self.assertEqual(user.email, 'newplayer@example.com')
        self.assertTrue(Leaderboard.objects.filter(user=user).exists())
        self.assertTrue(BlackCard.objects.filter(owner=user, current_holder=user).exists())

    def test_leaderboard_is_public(self):
        user = User.objects.create_user(
            username='leaderboard_user',
            email='leaderboard@example.com',
            password='StrongPass123!',
        )
        Leaderboard.objects.create(user=user, wins=3, points=25)

        response = self.client.get('/api/leaderboard/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['user'], 'leaderboard_user')


class MatchFlowTests(APITestCase):
    def setUp(self):
        self.player1 = User.objects.create_user(
            username='player_one',
            email='player1@example.com',
            password='StrongPass123!',
        )
        self.player2 = User.objects.create_user(
            username='player_two',
            email='player2@example.com',
            password='StrongPass123!',
        )
        self.player3 = User.objects.create_user(
            username='player_three',
            email='player3@example.com',
            password='StrongPass123!',
        )
        Leaderboard.objects.create(user=self.player1)
        Leaderboard.objects.create(user=self.player2)
        Leaderboard.objects.create(user=self.player3)

        self.question_one = Question.objects.create(
            category='history',
            difficulty='easy',
            question_text='What year did Juneteenth mark the arrival of emancipation news in Texas?',
            answer_choices=['1863', '1865', '1870', '1876'],
            correct_answer='1865',
        )
        self.question_two = Question.objects.create(
            category='sports',
            difficulty='easy',
            question_text='Which boxer was known as The Greatest?',
            answer_choices=['Joe Frazier', 'Muhammad Ali', 'George Foreman', 'Sugar Ray Leonard'],
            correct_answer='Muhammad Ali',
        )

    def test_create_match_returns_waiting_state_and_code(self):
        self.client.force_authenticate(user=self.player1)

        response = self.client.post('/api/matches/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'waiting')
        self.assertEqual(response.data['user_role'], 'player1')
        self.assertEqual(len(response.data['invite_code']), 6)
        self.assertEqual(Match.objects.count(), 1)

    def test_create_match_returns_existing_active_match_instead_of_creating_duplicate(self):
        self.client.force_authenticate(user=self.player1)
        first_response = self.client.post('/api/matches/', {}, format='json')

        second_response = self.client.post('/api/matches/', {}, format='json')

        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.data['id'], first_response.data['id'])
        self.assertEqual(second_response.data['result'], 'active_match_exists')
        self.assertEqual(Match.objects.count(), 1)

    def test_host_can_cancel_waiting_match(self):
        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        match_id = create_response.data['id']

        cancel_response = self.client.delete(f'/api/matches/{match_id}/')

        self.assertEqual(cancel_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Match.objects.filter(id=match_id).exists())

    def test_host_cannot_cancel_match_after_opponent_joins(self):
        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']
        match_id = create_response.data['id']

        self.client.force_authenticate(user=self.player2)
        self.client.post('/api/matches/join/', {'invite_code': invite_code}, format='json')

        self.client.force_authenticate(user=self.player1)
        cancel_response = self.client.delete(f'/api/matches/{match_id}/')

        self.assertEqual(cancel_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("can't be canceled", cancel_response.data['error'])

    def test_join_by_code_and_answer_updates_match_score(self):
        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']
        match_id = create_response.data['id']

        self.client.force_authenticate(user=self.player2)
        join_response = self.client.post(
            '/api/matches/join/',
            {'invite_code': invite_code},
            format='json',
        )

        self.assertEqual(join_response.status_code, status.HTTP_200_OK)
        self.assertEqual(join_response.data['status'], 'live')
        self.assertEqual(join_response.data['user_role'], 'player2')
        self.assertIsNotNone(join_response.data['current_question'])

        question = Question.objects.get(id=join_response.data['current_question']['id'])

        buzz_response = self.client.post(f'/api/matches/{match_id}/buzz/', {}, format='json')
        self.assertEqual(buzz_response.status_code, status.HTTP_200_OK)
        self.assertEqual(buzz_response.data['current_buzzer']['username'], 'player_two')

        answer_response = self.client.post(
            f'/api/matches/{match_id}/answer/',
            {'answer': question.correct_answer},
            format='json',
        )

        self.assertEqual(answer_response.status_code, status.HTTP_200_OK)
        self.assertEqual(answer_response.data['result'], 'correct')

        match = Match.objects.get(id=match_id)
        self.assertEqual(match.player2_id, self.player2.id)
        self.assertEqual(match.player2_score, 10)
        self.assertIsNone(match.current_buzzer)

        leaderboard = Leaderboard.objects.get(user=self.player2)
        self.assertEqual(leaderboard.points, 10)

    def test_join_by_code_returns_existing_active_match_if_user_is_already_in_another_room(self):
        self.client.force_authenticate(user=self.player2)
        existing_match_response = self.client.post('/api/matches/', {}, format='json')
        existing_match_id = existing_match_response.data['id']

        self.client.force_authenticate(user=self.player1)
        target_match_response = self.client.post('/api/matches/', {}, format='json')
        target_invite_code = target_match_response.data['invite_code']
        target_match_id = target_match_response.data['id']

        self.client.force_authenticate(user=self.player2)
        join_response = self.client.post(
            '/api/matches/join/',
            {'invite_code': target_invite_code},
            format='json',
        )

        self.assertEqual(join_response.status_code, status.HTTP_200_OK)
        self.assertEqual(join_response.data['id'], existing_match_id)
        self.assertEqual(join_response.data['result'], 'active_match_exists')

        existing_match = Match.objects.get(id=existing_match_id)
        target_match = Match.objects.get(id=target_match_id)
        self.assertEqual(existing_match.player1_id, self.player2.id)
        self.assertIsNone(existing_match.player2_id)
        self.assertEqual(target_match.player1_id, self.player1.id)
        self.assertIsNone(target_match.player2_id)

    def test_wrong_answer_opens_steal_and_applies_penalty(self):
        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']
        match_id = create_response.data['id']

        self.client.force_authenticate(user=self.player2)
        join_response = self.client.post('/api/matches/join/', {'invite_code': invite_code}, format='json')
        question = Question.objects.get(id=join_response.data['current_question']['id'])

        buzz_response = self.client.post(f'/api/matches/{match_id}/buzz/', {}, format='json')
        self.assertEqual(buzz_response.status_code, status.HTTP_200_OK)

        wrong_choice = next(choice for choice in question.answer_choices if choice != question.correct_answer)
        wrong_response = self.client.post(
            f'/api/matches/{match_id}/answer/',
            {'answer': wrong_choice},
            format='json',
        )

        self.assertEqual(wrong_response.status_code, status.HTTP_200_OK)
        self.assertEqual(wrong_response.data['result'], 'steal_open')

        match = Match.objects.get(id=match_id)
        self.assertEqual(match.player2_score, -5)
        self.assertEqual(match.locked_out_player_id, self.player2.id)
        self.assertIsNone(match.current_buzzer)

        blocked_buzz = self.client.post(f'/api/matches/{match_id}/buzz/', {}, format='json')
        self.assertEqual(blocked_buzz.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(user=self.player1)
        steal_buzz = self.client.post(f'/api/matches/{match_id}/buzz/', {}, format='json')
        self.assertEqual(steal_buzz.status_code, status.HTTP_200_OK)
        self.assertEqual(steal_buzz.data['current_buzzer']['username'], 'player_one')

    def test_target_score_finishes_match_on_refresh(self):
        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']
        match_id = create_response.data['id']

        self.client.force_authenticate(user=self.player2)
        self.client.post('/api/matches/join/', {'invite_code': invite_code}, format='json')
        match = Match.objects.get(id=match_id)
        match.player1_score = MATCH_TARGET_SCORE
        match.player2_score = 10
        match.current_question = Question.objects.first()
        match.save(update_fields=['player1_score', 'player2_score', 'current_question'])

        self.client.force_authenticate(user=self.player1)
        refresh_response = self.client.get(f'/api/matches/{match_id}/')

        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertEqual(refresh_response.data['status'], 'completed')
        self.assertEqual(refresh_response.data['winner']['id'], self.player1.id)
        self.assertEqual(refresh_response.data['loser']['id'], self.player2.id)
        self.assertNotIn('final_question_active', refresh_response.data)
        self.assertNotIn('final_question_player', refresh_response.data)
        self.assertNotIn('card_saved', refresh_response.data)

        match.refresh_from_db()
        self.assertEqual(match.winner_id, self.player1.id)
        self.assertEqual(match.loser_id, self.player2.id)
        self.assertFalse(match.card_saved)

        black_card = BlackCard.objects.get(owner=self.player2)
        self.assertEqual(black_card.current_holder_id, self.player1.id)
        self.assertIsNotNone(black_card.captured_at)

    def test_reaching_target_score_finishes_match(self):
        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']
        match_id = create_response.data['id']

        self.client.force_authenticate(user=self.player2)
        join_response = self.client.post('/api/matches/join/', {'invite_code': invite_code}, format='json')
        question = Question.objects.get(id=join_response.data['current_question']['id'])

        match = Match.objects.get(id=match_id)
        match.player1_score = MATCH_TARGET_SCORE - 10
        match.player2_score = 20
        match.current_question = question
        match.current_buzzer = self.player1
        match.save(update_fields=['player1_score', 'player2_score', 'current_question', 'current_buzzer'])

        self.client.force_authenticate(user=self.player1)
        response = self.client.post(
            f'/api/matches/{match_id}/answer/',
            {'answer': question.correct_answer},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['result'], 'match_finished')
        self.assertEqual(response.data['status'], 'completed')
        self.assertEqual(response.data['winner']['id'], self.player1.id)
        self.assertEqual(response.data['loser']['id'], self.player2.id)
        self.assertEqual(response.data['target_score'], MATCH_TARGET_SCORE)

        match.refresh_from_db()
        self.assertEqual(match.player1_score, MATCH_TARGET_SCORE)
        self.assertEqual(match.winner_id, self.player1.id)
        self.assertEqual(match.loser_id, self.player2.id)

    def test_defeating_card_holder_reclaims_your_black_card(self):
        winner_card, _ = BlackCard.objects.get_or_create(owner=self.player1, defaults={'current_holder': self.player1})
        winner_card.current_holder = self.player2
        winner_card.captured_at = timezone.now()
        winner_card.save(update_fields=['current_holder', 'captured_at'])
        self.player1.black_card_active = False
        self.player1.save(update_fields=['black_card_active'])

        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']
        match_id = create_response.data['id']

        self.client.force_authenticate(user=self.player2)
        join_response = self.client.post('/api/matches/join/', {'invite_code': invite_code}, format='json')
        question = Question.objects.get(id=join_response.data['current_question']['id'])
        match = Match.objects.get(id=match_id)
        match.player1_score = MATCH_TARGET_SCORE - 10
        match.player2_score = 10
        match.current_question = question
        match.current_buzzer = self.player1
        match.save(update_fields=['player1_score', 'player2_score', 'current_question', 'current_buzzer'])

        self.client.force_authenticate(user=self.player1)
        response = self.client.post(
            f'/api/matches/{match_id}/answer/',
            {'answer': question.correct_answer},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['result'], 'match_finished')

        winner_card.refresh_from_db()
        self.player1.refresh_from_db()
        loser_card = BlackCard.objects.get(owner=self.player2)

        self.assertEqual(winner_card.current_holder_id, self.player1.id)
        self.assertIsNone(winner_card.captured_at)
        self.assertEqual(loser_card.current_holder_id, self.player1.id)
        self.assertTrue(self.player1.black_card_active)

    def test_legacy_final_question_state_finishes_match_on_refresh(self):
        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']
        match_id = create_response.data['id']

        self.client.force_authenticate(user=self.player2)
        self.client.post('/api/matches/join/', {'invite_code': invite_code}, format='json')

        match = Match.objects.get(id=match_id)
        match.player1_score = MATCH_TARGET_SCORE
        match.player2_score = 10
        match.final_question_active = True
        match.final_question_player = self.player2
        match.current_question = self.question_one
        match.save(update_fields=[
            'player1_score',
            'player2_score',
            'final_question_active',
            'final_question_player',
            'current_question',
        ])

        self.client.force_authenticate(user=self.player1)
        response = self.client.get(f'/api/matches/{match_id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'completed')
        self.assertEqual(response.data['winner']['id'], self.player1.id)

        match.refresh_from_db()
        self.assertEqual(match.winner_id, self.player1.id)
        self.assertFalse(match.final_question_active)

    def test_match_cannot_be_finished_before_target_score(self):
        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']
        match_id = create_response.data['id']

        self.client.force_authenticate(user=self.player2)
        self.client.post('/api/matches/join/', {'invite_code': invite_code}, format='json')

        match = Match.objects.get(id=match_id)
        match.player1_score = MATCH_TARGET_SCORE - 10
        match.player2_score = 5
        match.save(update_fields=['player1_score', 'player2_score'])

        self.client.force_authenticate(user=self.player1)
        response = self.client.patch(f'/api/matches/{match_id}/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(str(MATCH_TARGET_SCORE), response.data['error'])

    def test_player_who_lost_card_can_only_join_current_holder(self):
        black_card, _ = BlackCard.objects.get_or_create(owner=self.player2, defaults={'current_holder': self.player2})
        black_card.current_holder = self.player1
        black_card.captured_at = timezone.now()
        black_card.save(update_fields=['current_holder', 'captured_at'])

        self.client.force_authenticate(user=self.player3)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']

        self.client.force_authenticate(user=self.player2)
        blocked_response = self.client.post('/api/matches/join/', {'invite_code': invite_code}, format='json')

        self.assertEqual(blocked_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Only player_one can face you', blocked_response.data['error'])

    @patch('game.views.pick_random_question')
    def test_question_timer_expiry_loads_new_question(self, mock_pick_random_question):
        mock_pick_random_question.return_value = self.question_two

        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']
        match_id = create_response.data['id']

        self.client.force_authenticate(user=self.player2)
        self.client.post('/api/matches/join/', {'invite_code': invite_code}, format='json')

        match = Match.objects.get(id=match_id)
        match.current_question = self.question_one
        match.question_started_at = timezone.now() - timedelta(seconds=QUESTION_TIME_LIMIT_SECONDS + 1)
        match.save(update_fields=['current_question', 'question_started_at'])

        self.client.force_authenticate(user=self.player1)
        response = self.client.get(f'/api/matches/{match_id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['current_question']['id'], self.question_two.id)
        self.assertEqual(response.data['question_time_limit_seconds'], QUESTION_TIME_LIMIT_SECONDS)
        self.assertIsNotNone(response.data['question_deadline'])

    def test_buzz_timeout_applies_penalty_and_opens_steal(self):
        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']
        match_id = create_response.data['id']

        self.client.force_authenticate(user=self.player2)
        self.client.post('/api/matches/join/', {'invite_code': invite_code}, format='json')

        match = Match.objects.get(id=match_id)
        match.current_question = self.question_one
        match.current_buzzer = self.player2
        match.question_started_at = timezone.now() - timedelta(seconds=QUESTION_TIME_LIMIT_SECONDS + 1)
        match.save(update_fields=['current_question', 'current_buzzer', 'question_started_at'])

        self.client.force_authenticate(user=self.player1)
        response = self.client.get(f'/api/matches/{match_id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        match.refresh_from_db()
        self.assertEqual(match.player2_score, -5)
        self.assertIsNone(match.current_buzzer)
        self.assertEqual(match.locked_out_player_id, self.player2.id)
        self.assertEqual(response.data['locked_out_player']['id'], self.player2.id)

    def test_legacy_final_question_timeout_state_finishes_match(self):
        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']
        match_id = create_response.data['id']

        self.client.force_authenticate(user=self.player2)
        self.client.post('/api/matches/join/', {'invite_code': invite_code}, format='json')

        match = Match.objects.get(id=match_id)
        match.player1_score = MATCH_TARGET_SCORE
        match.player2_score = 10
        match.final_question_active = True
        match.final_question_player = self.player2
        match.current_question = self.question_one
        match.question_started_at = timezone.now() - timedelta(seconds=QUESTION_TIME_LIMIT_SECONDS + 1)
        match.save(update_fields=[
            'player1_score',
            'player2_score',
            'final_question_active',
            'final_question_player',
            'current_question',
            'question_started_at',
        ])

        self.client.force_authenticate(user=self.player1)
        response = self.client.get(f'/api/matches/{match_id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        match.refresh_from_db()
        self.assertEqual(match.winner_id, self.player1.id)
        self.assertEqual(match.loser_id, self.player2.id)
        self.assertEqual(response.data['status'], 'completed')
        self.assertFalse(match.final_question_active)

        black_card = BlackCard.objects.get(owner=self.player2)
        self.assertEqual(black_card.current_holder_id, self.player1.id)

class SchemaRepairIntegrationTests(APITransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.player1 = User.objects.create_user(
            username='repair_player_one',
            email='repair1@example.com',
            password='StrongPass123!',
        )
        Leaderboard.objects.create(user=self.player1)
        BlackCard.objects.create(owner=self.player1, current_holder=self.player1)

    @patch.dict(os.environ, {'VERCEL': '1'})
    def test_create_match_repairs_missing_match_column_on_runtime(self):
        RuntimeBootstrapMiddleware._ready = False
        required_opponent_field = Match._meta.get_field('required_opponent')
        table_name = Match._meta.db_table

        with connection.schema_editor() as schema_editor:
            schema_editor.remove_field(Match, required_opponent_field)

        with connection.cursor() as cursor:
            columns_before = {
                column.name for column in connection.introspection.get_table_description(cursor, table_name)
            }
        self.assertNotIn(required_opponent_field.column, columns_before)

        self.client.force_authenticate(user=self.player1)
        response = self.client.post('/api/matches/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'waiting')

        with connection.cursor() as cursor:
            columns_after = {
                column.name for column in connection.introspection.get_table_description(cursor, table_name)
            }
        self.assertIn(required_opponent_field.column, columns_after)


class RuntimeBootstrapMiddlewareTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        RuntimeBootstrapMiddleware._ready = False

    def test_retries_once_after_retryable_schema_error(self):
        attempts = {'count': 0}

        def get_response(request):
            attempts['count'] += 1
            if attempts['count'] == 1:
                raise ProgrammingError('column game_match.required_opponent_id does not exist')
            return HttpResponse('ok')

        middleware = RuntimeBootstrapMiddleware(get_response)
        request = self.factory.post('/api/matches/')

        with patch.object(RuntimeBootstrapMiddleware, 'ensure_runtime_ready') as ensure_runtime_ready_mock:
            response = middleware(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ensure_runtime_ready_mock.assert_called_once_with(force=True)
        self.assertEqual(attempts['count'], 2)

    def test_does_not_retry_non_schema_database_error(self):
        def get_response(request):
            raise ProgrammingError('permission denied for relation game_match')

        middleware = RuntimeBootstrapMiddleware(get_response)
        request = self.factory.post('/api/matches/')

        with patch.object(RuntimeBootstrapMiddleware, 'ensure_runtime_ready') as ensure_runtime_ready_mock:
            with self.assertRaises(ProgrammingError):
                middleware(request)

        ensure_runtime_ready_mock.assert_not_called()

class GoogleAuthTests(APITestCase):
    @patch.dict(os.environ, {'GOOGLE_CLIENT_ID': 'test-google-client-id'})
    @patch('game.views.verify_google_token')
    def test_google_auth_requires_username_for_new_user(self, mock_verify_google_token):
        mock_verify_google_token.return_value = {
            'iss': 'https://accounts.google.com',
            'sub': 'google-sub-123',
            'email': 'googleuser@example.com',
            'email_verified': True,
            'given_name': 'Google',
            'family_name': 'User',
        }

        response = self.client.post(
            '/api/auth/google/',
            {'credential': 'fake-google-token'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['needs_username'])
        self.assertEqual(response.data['email'], 'googleuser@example.com')
        self.assertFalse(User.objects.filter(email='googleuser@example.com').exists())

    @patch.dict(os.environ, {'GOOGLE_CLIENT_ID': 'test-google-client-id'})
    @patch('game.views.verify_google_token')
    def test_google_auth_creates_user_after_username_selected(self, mock_verify_google_token):
        mock_verify_google_token.return_value = {
            'iss': 'https://accounts.google.com',
            'sub': 'google-sub-456',
            'email': 'googleplayer@example.com',
            'email_verified': True,
            'given_name': 'Google',
            'family_name': 'Player',
        }

        response = self.client.post(
            '/api/auth/google/',
            {
                'credential': 'fake-google-token',
                'username': 'google_player',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['username'], 'google_player')

        user = User.objects.get(username='google_player')
        self.assertEqual(user.google_sub, 'google-sub-456')
        self.assertTrue(Leaderboard.objects.filter(user=user).exists())


class QuestionBankAuditTests(APITestCase):
    def test_bundled_question_bank_excludes_removed_prompts(self):
        question_texts = {question['question_text'] for question in bundled_questions}

        self.assertTrue(DEPRECATED_QUESTION_TEXTS.isdisjoint(question_texts))
        self.assertIn("Which singer is known as the 'Godfather of Soul'?", question_texts)
        self.assertIn("Which quarterback became the second Black QB to win a Super Bowl after Doug Williams?", question_texts)
        self.assertIn("Who created and stars in the hit comedy series 'Abbott Elementary'?", question_texts)

    def test_load_questions_removes_deprecated_questions_from_database(self):
        Question.objects.create(
            category='sports',
            difficulty='medium',
            question_text="What NFL quarterback led the San Francisco 49ers to four Super Bowl victories?",
            answer_choices=["Joe Montana", "Steve Young", "Jerry Rice", "Warren Moon"],
            correct_answer="Joe Montana",
        )

        load_questions()

        self.assertFalse(Question.objects.filter(question_text__in=DEPRECATED_QUESTION_TEXTS).exists())
        self.assertTrue(
            Question.objects.filter(
                question_text="Which quarterback became the second Black QB to win a Super Bowl after Doug Williams?"
            ).exists()
        )
