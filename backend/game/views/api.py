import os
import random
import secrets
import string
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from game.models import BlackCard, Leaderboard, Match, PushSubscription, Question, MATCH_TARGET_SCORE, QUESTION_TIME_LIMIT_SECONDS
from game.serializers import (
    CurrentUserSerializer,
    LeaderboardSerializer,
    MatchHistorySerializer,
    MatchStateSerializer,
    QuestionSerializer,
    SubmitMatchResultSerializer,
    UserSerializer,
)

User = get_user_model()


def generate_invite_code():
    alphabet = string.ascii_uppercase + string.digits
    while True:
        invite_code = ''.join(secrets.choice(alphabet) for _ in range(6))
        if not Match.objects.filter(invite_code=invite_code).exists():
            return invite_code


ALL_CATEGORIES = [c[0] for c in Question.CATEGORY_CHOICES]


def get_round_info(match):
    """Return round name and difficulty filter based on max score."""
    max_score = max(match.player1_score, match.player2_score)
    if max_score >= 45:
        return 'Match Point', ['hard']
    if max_score >= 30:
        return 'Final Stretch', ['medium', 'hard']
    if max_score >= 15:
        return 'Heating Up', ['medium']
    return 'Opening Round', ['easy', 'medium']


def pick_random_question(category=None, categories=None, difficulties=None):
    questions = Question.objects.all()
    if category:
        questions = questions.filter(category=category)
    elif categories:
        questions = questions.filter(category__in=categories)
    if difficulties:
        questions = questions.filter(difficulty__in=difficulties)

    count = questions.count()
    if count == 0:
        # Fallback: try without difficulty filter
        if difficulties:
            return pick_random_question(category=category, categories=categories, difficulties=None)
        return None

    random_index = random.randint(0, count - 1)
    return questions[random_index]


def ensure_black_card_for_user(user):
    black_card, _ = BlackCard.objects.get_or_create(
        owner=user,
        defaults={'current_holder': user},
    )
    should_be_active = black_card.current_holder_id == user.id
    if user.black_card_active != should_be_active:
        user.black_card_active = should_be_active
        user.save(update_fields=['black_card_active'])
    return black_card


def reset_expired_black_cards():
    expired_cards = BlackCard.objects.exclude(current_holder=models.F('owner')).filter(
        captured_at__date__lt=timezone.localdate(),
    ).select_related('owner')

    for black_card in expired_cards:
        black_card.current_holder = black_card.owner
        black_card.captured_at = None
        black_card.save(update_fields=['current_holder', 'captured_at'])
        if not black_card.owner.black_card_active:
            black_card.owner.black_card_active = True
            black_card.owner.save(update_fields=['black_card_active'])


def serialize_match(request, match, status_code=status.HTTP_200_OK, **extra):
    payload = MatchStateSerializer(match, context={'request': request}).data
    payload.update(extra)
    return Response(payload, status=status_code)


def get_match_winner_and_loser(match):
    if match.player1_score == match.player2_score:
        return None, None
    if match.player1_score > match.player2_score:
        return match.player1, match.player2
    return match.player2, match.player1


def pick_match_question(match):
    """Pick a question using the match's categories and round-appropriate difficulty."""
    cats = match.categories if match.categories else ALL_CATEGORIES
    _, difficulties = get_round_info(match)
    return pick_random_question(categories=cats, difficulties=difficulties)


def set_match_question(match, question):
    match.current_question = question
    match.question_started_at = timezone.now() if question else None


def finalize_match(match, winner):
    serializer = SubmitMatchResultSerializer(
        instance=match,
        data={'winner_id': winner.id},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    match.refresh_from_db()
    return match


def maybe_finalize_match(match):
    if not match or match.winner_id or not match.player2_id:
        return None, None

    if max(match.player1_score, match.player2_score) < MATCH_TARGET_SCORE:
        if match.final_question_active or match.final_question_player_id or match.card_saved:
            match.final_question_active = False
            match.final_question_player = None
            match.card_saved = False
            match.save(update_fields=['final_question_active', 'final_question_player', 'card_saved'])
        return None, None

    winner, loser = get_match_winner_and_loser(match)
    if not winner or not loser:
        return None, None

    finalize_match(match, winner)
    return winner, loser


def resolve_question_timeout(match):
    if (
        not match
        or match.winner_id
        or not match.player2_id
        or not match.current_question_id
        or not match.question_started_at
    ):
        return

    deadline = match.question_started_at + timedelta(seconds=QUESTION_TIME_LIMIT_SECONDS)
    if timezone.now() < deadline:
        return

    if match.current_buzzer_id:
        penalty = 5
        timed_out_user = match.current_buzzer
        score_field = 'player1_score' if timed_out_user.id == match.player1_id else 'player2_score'
        if timed_out_user.id == match.player1_id:
            match.player1_score -= penalty
        else:
            match.player2_score -= penalty

        match.current_buzzer = None
        if match.locked_out_player_id and match.locked_out_player_id != timed_out_user.id:
            match.locked_out_player = None
            set_match_question(match, pick_match_question(match))
            match.save(update_fields=[score_field, 'current_buzzer', 'locked_out_player', 'current_question', 'question_started_at'])
            maybe_finalize_match(match)
            return

        match.locked_out_player = timed_out_user
        match.question_started_at = timezone.now()
        match.save(update_fields=[score_field, 'current_buzzer', 'locked_out_player', 'question_started_at'])
        maybe_finalize_match(match)
        return

    match.current_buzzer = None
    match.locked_out_player = None
    set_match_question(match, pick_match_question(match))
    match.save(update_fields=['current_buzzer', 'locked_out_player', 'current_question', 'question_started_at'])
    maybe_finalize_match(match)


def build_unique_username(base_username):
    clean_base = ''.join(char for char in base_username.lower() if char.isalnum() or char == '_').strip('_')
    if not clean_base:
        clean_base = 'player'

    candidate = clean_base[:150]
    suffix = 1
    while User.objects.filter(username=candidate).exists():
        suffix += 1
        trimmed_base = clean_base[: max(1, 150 - len(str(suffix)) - 1)]
        candidate = f'{trimmed_base}_{suffix}'
    return candidate


def issue_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


def validate_requested_username(username):
    cleaned_username = (username or '').strip()
    if not cleaned_username:
        raise ValidationError('Username is required.')

    username_field = User._meta.get_field('username')
    for validator in username_field.validators:
        validator(cleaned_username)

    if User.objects.filter(username__iexact=cleaned_username).exists():
        raise ValidationError('That username is already taken.')

    return cleaned_username


def verify_google_token(credential, client_id):
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    return id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)


def get_match_for_user(pk, user):
    reset_expired_black_cards()
    match = Match.objects.filter(
        models.Q(player1=user) | models.Q(player2=user),
        pk=pk,
    ).select_related(
        'player1',
        'player2',
        'winner',
        'loser',
        'current_buzzer',
        'locked_out_player',
        'final_question_player',
        'required_opponent',
        'current_question',
    ).first()
    if not match:
        return None

    # Auto-delete stale live matches with no activity for 2 hours
    if (
        not match.winner_id
        and match.player2_id
        and match.timestamp < timezone.now() - timedelta(hours=2)
    ):
        match.delete()
        return None

    resolve_question_timeout(match)
    maybe_finalize_match(match)

    return Match.objects.filter(
        models.Q(player1=user) | models.Q(player2=user),
        pk=pk,
    ).select_related(
        'player1',
        'player2',
        'winner',
        'loser',
        'current_buzzer',
        'locked_out_player',
        'final_question_player',
        'required_opponent',
        'current_question',
    ).first()


def get_incomplete_match_for_user(user, exclude_match_id=None):
    reset_expired_black_cards()

    # Auto-cancel stale waiting matches (no opponent joined within 30 minutes)
    try:
        stale_cutoff = timezone.now() - timedelta(minutes=30)
        Match.objects.filter(
            player1=user,
            player2__isnull=True,
            winner__isnull=True,
            timestamp__lt=stale_cutoff,
        ).delete()
    except Exception:
        pass

    # Auto-cancel stale live matches (no activity for 2 hours)
    try:
        live_stale_cutoff = timezone.now() - timedelta(hours=2)
        Match.objects.filter(
            models.Q(player1=user) | models.Q(player2=user),
            player2__isnull=False,
            winner__isnull=True,
            timestamp__lt=live_stale_cutoff,
        ).delete()
    except Exception:
        pass

    queryset = Match.objects.filter(
        models.Q(player1=user) | models.Q(player2=user),
        winner__isnull=True,
    )
    if exclude_match_id is not None:
        queryset = queryset.exclude(pk=exclude_match_id)

    select_related = queryset.select_related(
        'player1',
        'player2',
        'winner',
        'loser',
        'current_buzzer',
        'locked_out_player',
        'final_question_player',
        'required_opponent',
        'current_question',
    ).order_by('-timestamp')

    matches = list(select_related)
    for match in matches:
        try:
            resolve_question_timeout(match)
            maybe_finalize_match(match)
        except Exception:
            pass

    # Re-query to exclude matches that were just finalized (winner set)
    finalized_ids = [m.pk for m in matches if m.winner_id is not None]
    if exclude_match_id is not None:
        finalized_ids.append(exclude_match_id)
    return Match.objects.filter(
        models.Q(player1=user) | models.Q(player2=user),
        winner__isnull=True,
    ).exclude(
        pk__in=finalized_ids,
    ).select_related(
        'player1',
        'player2',
        'winner',
        'loser',
        'current_buzzer',
        'locked_out_player',
        'final_question_player',
        'required_opponent',
        'current_question',
    ).order_by(
        models.Case(
            models.When(player2__isnull=False, then=models.Value(0)),
            default=models.Value(1),
            output_field=models.IntegerField(),
        ),
        '-timestamp',
    ).first()


def join_match(match, player):
    reset_expired_black_cards()
    player_black_card = ensure_black_card_for_user(player)

    if match.winner_id:
        return None, Response(
            {"error": "This match has already been completed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    resolve_question_timeout(match)

    if match.player2_id == player.id:
        if not match.current_question_id:
            set_match_question(match, pick_match_question(match))
            match.save(update_fields=['current_question', 'question_started_at'])
        return match, None

    if match.player1_id == player.id:
        return None, Response(
            {"error": "You created this match. Have another player join with the invite code from their device."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if match.player2_id:
        return None, Response(
            {"error": "This match is already full."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if player_black_card.current_holder_id != player.id and player_black_card.current_holder_id != match.player1_id:
        return None, Response(
            {"error": f"Only {player_black_card.current_holder.username} can face you until the daily reset because they hold your black card."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if match.required_opponent_id and match.required_opponent_id != player.id:
        return None, Response(
            {"error": f"Only {match.required_opponent.username} can answer this challenge because they currently hold the host's black card."},
            status=status.HTTP_403_FORBIDDEN,
        )

    match.player2 = player
    # Notify host that opponent joined
    send_push_to_user(
        match.player1,
        'Opponent Joined!',
        f'{player.username} joined your match. Game on!',
    )
    if not match.current_question_id:
        question = pick_match_question(match)
        if not question:
            return None, Response(
                {"error": "No questions available."},
                status=status.HTTP_404_NOT_FOUND,
            )
        set_match_question(match, question)
    match.current_buzzer = None
    match.locked_out_player = None
    match.final_question_active = False
    match.final_question_player = None
    match.card_saved = False
    match.save(update_fields=[
        'player2',
        'current_question',
        'question_started_at',
        'current_buzzer',
        'locked_out_player',
        'final_question_active',
        'final_question_player',
        'card_saved',
    ])
    return match, None


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserSerializer


class GoogleAuthView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        if not client_id:
            return Response({"error": "Google sign-in is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        credential = request.data.get('credential')
        if not credential:
            return Response({"error": "Google credential is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = verify_google_token(credential, client_id)
        except Exception:
            return Response({"error": "Google token verification failed."}, status=status.HTTP_400_BAD_REQUEST)

        if payload.get('iss') not in {'accounts.google.com', 'https://accounts.google.com'}:
            return Response({"error": "Invalid Google issuer."}, status=status.HTTP_400_BAD_REQUEST)

        google_sub = payload.get('sub')
        email = (payload.get('email') or '').strip().lower()
        if not google_sub or not email or not payload.get('email_verified'):
            return Response({"error": "Google account email is unavailable or unverified."}, status=status.HTTP_400_BAD_REQUEST)

        requested_username = request.data.get('username')
        user = User.objects.filter(google_sub=google_sub).first()
        if not user:
            user = User.objects.filter(email__iexact=email).first()

        if user:
            updated_fields = []
            if user.google_sub != google_sub:
                user.google_sub = google_sub
                updated_fields.append('google_sub')
            if not user.email:
                user.email = email
                updated_fields.append('email')
            if payload.get('given_name') and not user.first_name:
                user.first_name = payload.get('given_name')
                updated_fields.append('first_name')
            if payload.get('family_name') and not user.last_name:
                user.last_name = payload.get('family_name')
                updated_fields.append('last_name')
            if updated_fields:
                user.save(update_fields=updated_fields)
        else:
            suggested_username = build_unique_username(email.split('@', 1)[0] if email else payload.get('name', 'player'))
            if not requested_username:
                return Response({
                    'needs_username': True,
                    'email': email,
                    'suggested_username': suggested_username,
                    'message': 'Choose a username to finish Google sign-in.',
                }, status=status.HTTP_200_OK)

            try:
                username = validate_requested_username(requested_username)
            except ValidationError as exc:
                return Response({
                    'error': exc.messages[0],
                    'needs_username': True,
                    'email': email,
                    'suggested_username': suggested_username,
                }, status=status.HTTP_400_BAD_REQUEST)

            user = User.objects.create_user(
                username=username,
                email=email,
                password=None,
            )
            user.google_sub = google_sub
            user.first_name = payload.get('given_name', '')
            user.last_name = payload.get('family_name', '')
            user.save(update_fields=['google_sub', 'first_name', 'last_name'])
            Leaderboard.objects.create(user=user)
            BlackCard.objects.create(owner=user, current_holder=user)

        response_payload = issue_tokens_for_user(user)
        response_payload['user'] = CurrentUserSerializer(user).data
        return Response(response_payload, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        reset_expired_black_cards()
        ensure_black_card_for_user(request.user)
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        user = request.user
        requested_username = request.data.get('username')

        try:
            username = validate_requested_username(requested_username)
        except ValidationError as exc:
            return Response({'error': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        if user.username.lower() == username.lower():
            serializer = CurrentUserSerializer(user)
            return Response(serializer.data, status=status.HTTP_200_OK)

        user.username = username
        user.save(update_fields=['username'])
        serializer = CurrentUserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class QuestionListCreateView(generics.ListCreateAPIView):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.request.method == 'POST':
            self.permission_classes = [permissions.IsAdminUser]
        return super().get_permissions()


class QuestionRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            self.permission_classes = [permissions.IsAdminUser]
        return super().get_permissions()


class RandomQuestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        question = pick_random_question()
        if not question:
            return Response({"detail": "No questions available."}, status=status.HTTP_404_NOT_FOUND)
        serializer = QuestionSerializer(question)
        return Response(serializer.data, status=status.HTTP_200_OK)


class StartMatchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        import traceback
        try:
            reset_expired_black_cards()
            existing_match = get_incomplete_match_for_user(request.user)
            if existing_match:
                return serialize_match(
                    request,
                    existing_match,
                    message="You already have an active match. Finish it or cancel it before opening another room.",
                    result='active_match_exists',
                )
            black_card = ensure_black_card_for_user(request.user)
            required_opponent = black_card.current_holder if black_card.current_holder_id != request.user.id else None
            # Accept optional category selection
            selected_categories = request.data.get('categories', [])
            if not selected_categories or not isinstance(selected_categories, list):
                selected_categories = ALL_CATEGORIES
            else:
                selected_categories = [c for c in selected_categories if c in ALL_CATEGORIES]
                if not selected_categories:
                    selected_categories = ALL_CATEGORIES
            create_kwargs = {
                'player1': request.user,
                'invite_code': generate_invite_code(),
                'required_opponent': required_opponent,
            }
            try:
                create_kwargs['categories'] = selected_categories
                match = Match.objects.create(**create_kwargs)
            except Exception:
                # Fallback if categories column doesn't exist yet
                create_kwargs.pop('categories', None)
                match = Match.objects.create(**create_kwargs)
            message = "Match created. Share the code so another player can join."
            if required_opponent:
                message = (
                    f"Your black card is held by {required_opponent.username}. "
                    f"Only they can accept this challenge until the next reset."
                )
            return serialize_match(
                request,
                match,
                status_code=status.HTTP_201_CREATED,
                message=message,
            )
        except Exception:
            return Response(
                {"error": f"Match creation failed: {traceback.format_exc()}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class JoinMatchByCodeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        invite_code = (request.data.get('invite_code') or '').strip().upper()
        if not invite_code:
            return Response({"error": "Invite code is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            match = Match.objects.get(invite_code=invite_code)
        except Match.DoesNotExist:
            return Response({"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND)

        existing_match = get_incomplete_match_for_user(request.user, exclude_match_id=match.id)
        if existing_match:
            return serialize_match(
                request,
                existing_match,
                message="You already have an active match. Leave or cancel it before joining another room.",
                result='active_match_exists',
            )

        match, error_response = join_match(match, request.user)
        if error_response:
            return error_response

        return serialize_match(request, match, message="Match joined.")


class MatchDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, request, pk):
        match = get_match_for_user(pk, request.user)
        if not match:
            return None
        return match

    def get(self, request, pk):
        match = self.get_object(request, pk)
        if not match:
            return Response({"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND)
        return serialize_match(request, match)

    def patch(self, request, pk):
        match = self.get_object(request, pk)
        if not match:
            return Response({"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND)

        if not match.player2_id:
            return Response({"error": "A second player has not joined yet."}, status=status.HTTP_400_BAD_REQUEST)
        if match.winner_id:
            return Response({"error": "Match result already submitted."}, status=status.HTTP_400_BAD_REQUEST)
        if max(match.player1_score, match.player2_score) < MATCH_TARGET_SCORE:
            return Response(
                {"error": f"The match ends when a player reaches {MATCH_TARGET_SCORE} points."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        winner, loser = get_match_winner_and_loser(match)
        if not winner or not loser:
            return Response({"error": "The final score is tied. Play another question before finishing the match."}, status=status.HTTP_400_BAD_REQUEST)
        maybe_finalize_match(match)
        match.refresh_from_db()
        return serialize_match(
            request,
            match,
            message=f"{winner.username} reached {MATCH_TARGET_SCORE} and claimed {loser.username}'s black card.",
            result='match_finished',
        )

    def delete(self, request, pk):
        match = self.get_object(request, pk)
        if not match:
            return Response({"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND)

        if match.winner_id:
            return Response(
                {"error": "Completed matches stay in your history."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if match.player1_id != request.user.id:
            return Response(
                {"error": "Only the host can cancel this room."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if match.player2_id:
            return Response(
                {"error": "Once another player joins, this match can't be canceled from the lobby."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        match.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class JoinMatchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            match = Match.objects.get(pk=pk)
        except Match.DoesNotExist:
            return Response({"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND)

        existing_match = get_incomplete_match_for_user(request.user, exclude_match_id=match.id)
        if existing_match:
            return serialize_match(
                request,
                existing_match,
                message="You already have an active match. Leave or cancel it before joining another room.",
                result='active_match_exists',
            )

        match, error_response = join_match(match, request.user)
        if error_response:
            return error_response

        return serialize_match(request, match, message="Match joined.")


class BuzzView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        match = get_match_for_user(pk, request.user)
        if not match:
            return Response({"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND)
        if not match.player2_id:
            return Response({"error": "Waiting for another player to join."}, status=status.HTTP_400_BAD_REQUEST)
        if match.winner_id:
            return Response({"error": "This match is already completed."}, status=status.HTTP_400_BAD_REQUEST)
        if match.current_buzzer_id:
            return Response({"error": "Another player has already buzzed."}, status=status.HTTP_400_BAD_REQUEST)
        if match.locked_out_player_id == request.user.id:
            return Response({"error": "You missed this question already. Your opponent can steal now."}, status=status.HTTP_400_BAD_REQUEST)

        match.current_buzzer = request.user
        match.save(update_fields=['current_buzzer'])
        return serialize_match(request, match, message=f"{request.user.username} buzzed first.")


class AnswerQuestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        match = get_match_for_user(pk, request.user)
        if not match:
            return Response({"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND)
        if not match.current_question_id:
            return Response({"error": "No active question."}, status=status.HTTP_400_BAD_REQUEST)

        answer = (request.data.get('answer') or '').strip()
        if not answer:
            return Response({"error": "Answer is required."}, status=status.HTTP_400_BAD_REQUEST)

        question = match.current_question
        correct_answer_text = question.correct_answer.strip()
        is_correct = answer.casefold() == correct_answer_text.casefold()

        if match.current_buzzer_id != request.user.id:
            return Response({"error": "You did not buzz first."}, status=status.HTTP_403_FORBIDDEN)

        if is_correct:
            if request.user.id == match.player1_id:
                match.player1_score += 10
                score_field = 'player1_score'
            else:
                match.player2_score += 10
                score_field = 'player2_score'

            leaderboard, _ = Leaderboard.objects.get_or_create(user=request.user)
            leaderboard.points += 10
            leaderboard.save(update_fields=['points'])

            match.current_buzzer = None
            match.locked_out_player = None
            match.save(update_fields=[score_field, 'current_buzzer', 'locked_out_player'])
            winner, loser = maybe_finalize_match(match)
            if winner and loser:
                match.refresh_from_db()
                return serialize_match(
                    request,
                    match,
                    message=f"{winner.username} hit {MATCH_TARGET_SCORE} and claimed {loser.username}'s black card.",
                    result='match_finished',
                )

            set_match_question(match, pick_match_question(match))
            match.save(update_fields=[score_field, 'current_buzzer', 'locked_out_player', 'current_question', 'question_started_at'])
            return serialize_match(
                request,
                match,
                message="Correct answer. New question loaded.",
                result='correct',
            )

        penalty = 5
        match.current_buzzer = None
        is_player1 = request.user.id == match.player1_id
        score_field = 'player1_score' if is_player1 else 'player2_score'
        if is_player1:
            match.player1_score -= penalty
        else:
            match.player2_score -= penalty

        if match.locked_out_player_id and match.locked_out_player_id != request.user.id:
            match.locked_out_player = None
            match.save(update_fields=[score_field, 'current_buzzer', 'locked_out_player'])
            winner, loser = maybe_finalize_match(match)
            if winner and loser:
                match.refresh_from_db()
                return serialize_match(
                    request,
                    match,
                    message=f"{winner.username} reached {MATCH_TARGET_SCORE} and claimed {loser.username}'s black card.",
                    result='match_finished',
                )

            set_match_question(match, pick_match_question(match))
            match.save(update_fields=[score_field, 'current_buzzer', 'locked_out_player', 'current_question', 'question_started_at'])
            return serialize_match(
                request,
                match,
                message=f"Wrong answer. -{penalty} points. Both players missed, so a new question is live.",
                result='double_miss',
                correct_answer=correct_answer_text,
            )

        match.locked_out_player = request.user
        match.question_started_at = timezone.now()
        match.save(update_fields=[score_field, 'current_buzzer', 'locked_out_player', 'question_started_at'])
        winner, loser = maybe_finalize_match(match)
        if winner and loser:
            match.refresh_from_db()
            return serialize_match(
                request,
                match,
                message=f"{winner.username} reached {MATCH_TARGET_SCORE} and claimed {loser.username}'s black card.",
                result='match_finished',
            )

        return serialize_match(
            request,
            match,
            message=f"Wrong answer. -{penalty} points. Your opponent can steal the black card round.",
            result='steal_open',
        )


class ChooseCategoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        match = get_match_for_user(pk, request.user)
        if not match:
            return Response({"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND)
        if match.current_buzzer_id != request.user.id:
            return Response({"error": "You are not allowed to pick a category."}, status=status.HTTP_403_FORBIDDEN)

        category = request.data.get('category')
        if not category:
            return Response({"error": "Category is required."}, status=status.HTTP_400_BAD_REQUEST)

        question = pick_random_question(category=category)
        if not question:
            return Response({"error": "No questions available in this category."}, status=status.HTTP_404_NOT_FOUND)

        set_match_question(match, question)
        match.current_buzzer = None
        match.locked_out_player = None
        match.save(update_fields=['current_question', 'question_started_at', 'current_buzzer', 'locked_out_player'])
        return serialize_match(request, match, message=f"New {category} question loaded.")


class LeaveMatchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        match = get_match_for_user(pk, request.user)
        if not match:
            return Response({"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND)

        if match.winner_id:
            return Response({"error": "This match is already completed."}, status=status.HTTP_400_BAD_REQUEST)

        if not match.player2_id:
            return Response(
                {"error": "No opponent has joined yet. Cancel the match instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # The opponent of the leaving player wins by forfeit
        if request.user.id == match.player1_id:
            winner = match.player2
        else:
            winner = match.player1

        finalize_match(match, winner)
        return serialize_match(
            request,
            match,
            message=f"{request.user.username} left the match. {winner.username} wins by forfeit.",
            result='forfeit',
        )


class LeaderboardListView(generics.ListAPIView):
    queryset = Leaderboard.objects.all().order_by('-wins', '-points')
    serializer_class = LeaderboardSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        reset_expired_black_cards()
        return super().get_queryset()


class MatchHistoryView(generics.ListAPIView):
    serializer_class = MatchHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Match.objects.filter(
            models.Q(player1=self.request.user) | models.Q(player2=self.request.user),
            winner__isnull=False,
        ).select_related('player1', 'player2', 'winner', 'loser').order_by('-timestamp')[:20]


class UserStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        reset_expired_black_cards()
        ensure_black_card_for_user(request.user)
        user = request.user
        data = {'black_card_active': user.black_card_active}
        return Response(data, status=status.HTTP_200_OK)


class VapidKeyView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        public_key = os.getenv('VAPID_PUBLIC_KEY', '')
        return Response({'public_key': public_key})


class PushSubscribeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        endpoint = request.data.get('endpoint', '')
        keys = request.data.get('keys', {})
        p256dh = keys.get('p256dh', '')
        auth = keys.get('auth', '')

        if not endpoint or not p256dh or not auth:
            return Response({'error': 'Invalid subscription data.'}, status=status.HTTP_400_BAD_REQUEST)

        PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                'user': request.user,
                'p256dh': p256dh,
                'auth': auth,
            },
        )
        return Response({'message': 'Subscribed to push notifications.'})


def send_push_to_user(user, title, body, url='/'):
    """Send push notification to all of a user's subscriptions. Silently fails."""
    vapid_private_key = os.getenv('VAPID_PRIVATE_KEY', '')
    vapid_email = os.getenv('VAPID_EMAIL', '')
    if not vapid_private_key or not vapid_email:
        return

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        return

    import json
    payload = json.dumps({'title': title, 'body': body, 'url': url})
    subs = PushSubscription.objects.filter(user=user)

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    'endpoint': sub.endpoint,
                    'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
                },
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims={'sub': f'mailto:{vapid_email}'},
            )
        except Exception:
            # Subscription may be expired — clean it up
            sub.delete()
