import os
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import BlackCard, Leaderboard, Match, Question

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

        Question.objects.create(
            category='history',
            difficulty='easy',
            question_text='What year did Juneteenth mark the arrival of emancipation news in Texas?',
            answer_choices=['1863', '1865', '1870', '1876'],
            correct_answer='1865',
        )
        Question.objects.create(
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

    def test_final_question_can_save_black_card(self):
        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']
        match_id = create_response.data['id']

        self.client.force_authenticate(user=self.player2)
        join_response = self.client.post('/api/matches/join/', {'invite_code': invite_code}, format='json')
        match = Match.objects.get(id=match_id)
        match.player1_score = 20
        match.player2_score = 10
        match.current_question = Question.objects.first()
        match.save(update_fields=['player1_score', 'player2_score', 'current_question'])

        self.client.force_authenticate(user=self.player1)
        finish_response = self.client.patch(f'/api/matches/{match_id}/', {}, format='json')
        self.assertEqual(finish_response.status_code, status.HTTP_200_OK)
        self.assertEqual(finish_response.data['status'], 'final_question')

        match.refresh_from_db()
        final_question = match.current_question

        self.client.force_authenticate(user=self.player2)
        save_response = self.client.post(
            f'/api/matches/{match_id}/answer/',
            {'answer': final_question.correct_answer},
            format='json',
        )

        self.assertEqual(save_response.status_code, status.HTTP_200_OK)
        self.assertEqual(save_response.data['result'], 'card_saved')

        match.refresh_from_db()
        self.assertEqual(match.winner_id, self.player1.id)
        self.assertEqual(match.loser_id, self.player2.id)
        self.assertTrue(match.card_saved)

        black_card = BlackCard.objects.get(owner=self.player2)
        self.assertEqual(black_card.current_holder_id, self.player2.id)
        self.assertIsNone(black_card.captured_at)

    def test_losing_final_question_transfers_black_card(self):
        self.client.force_authenticate(user=self.player1)
        create_response = self.client.post('/api/matches/', {}, format='json')
        invite_code = create_response.data['invite_code']
        match_id = create_response.data['id']

        self.client.force_authenticate(user=self.player2)
        self.client.post('/api/matches/join/', {'invite_code': invite_code}, format='json')
        match = Match.objects.get(id=match_id)
        match.player1_score = 20
        match.player2_score = 10
        match.current_question = Question.objects.first()
        match.save(update_fields=['player1_score', 'player2_score', 'current_question'])

        self.client.force_authenticate(user=self.player1)
        self.client.patch(f'/api/matches/{match_id}/', {}, format='json')

        match.refresh_from_db()
        wrong_choice = next(choice for choice in match.current_question.answer_choices if choice != match.current_question.correct_answer)

        self.client.force_authenticate(user=self.player2)
        lose_response = self.client.post(
            f'/api/matches/{match_id}/answer/',
            {'answer': wrong_choice},
            format='json',
        )

        self.assertEqual(lose_response.status_code, status.HTTP_200_OK)
        self.assertEqual(lose_response.data['result'], 'card_lost')

        black_card = BlackCard.objects.get(owner=self.player2)
        self.assertEqual(black_card.current_holder_id, self.player1.id)
        self.assertIsNotNone(black_card.captured_at)

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
