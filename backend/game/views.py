import random
import secrets
import string

from django.contrib.auth import get_user_model
from django.db import models
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Leaderboard, Match, Question
from .serializers import (
    CurrentUserSerializer,
    LeaderboardSerializer,
    MatchStateSerializer,
    QuestionSerializer,
    SubmitMatchResultSerializer,
    UserSerializer,
)

User = get_user_model()


def home(request):
    return render(request, 'games/home.html')


def health(request):
    return JsonResponse({"status": "ok"})


def dashboard(request):
    return render(request, 'games/dashboard.html')


def generate_invite_code():
    alphabet = string.ascii_uppercase + string.digits
    while True:
        invite_code = ''.join(secrets.choice(alphabet) for _ in range(6))
        if not Match.objects.filter(invite_code=invite_code).exists():
            return invite_code


def pick_random_question(category=None):
    questions = Question.objects.all()
    if category:
        questions = questions.filter(category=category)

    count = questions.count()
    if count == 0:
        return None

    random_index = random.randint(0, count - 1)
    return questions[random_index]


def serialize_match(request, match, status_code=status.HTTP_200_OK, **extra):
    payload = MatchStateSerializer(match, context={'request': request}).data
    payload.update(extra)
    return Response(payload, status=status_code)


def get_match_for_user(pk, user):
    return Match.objects.filter(
        models.Q(player1=user) | models.Q(player2=user),
        pk=pk,
    ).select_related(
        'player1',
        'player2',
        'winner',
        'loser',
        'current_buzzer',
        'current_question',
    ).first()


def join_match(match, player):
    if match.winner_id:
        return None, Response(
            {"error": "This match has already been completed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if match.player1_id == player.id or match.player2_id == player.id:
        if match.player2_id and not match.current_question_id:
            match.current_question = pick_random_question()
            match.save(update_fields=['current_question'])
        return match, None

    if match.player1_id == player.id:
        return None, Response(
            {"error": "Use a different account to join this match."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if match.player2_id:
        return None, Response(
            {"error": "This match is already full."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    match.player2 = player
    if not match.current_question_id:
        question = pick_random_question()
        if not question:
            return None, Response(
                {"error": "No questions available."},
                status=status.HTTP_404_NOT_FOUND,
            )
        match.current_question = question
    match.current_buzzer = None
    match.save(update_fields=['player2', 'current_question', 'current_buzzer'])
    return match, None


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserSerializer


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = CurrentUserSerializer(request.user)
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
        match = Match.objects.create(
            player1=request.user,
            invite_code=generate_invite_code(),
        )
        return serialize_match(
            request,
            match,
            status_code=status.HTTP_201_CREATED,
            message="Match created. Share the code so another player can join.",
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

        winner_id = request.data.get('winner_id')
        if not winner_id:
            if match.player1_score == match.player2_score:
                return Response({"error": "Winner ID is required when the score is tied."}, status=status.HTTP_400_BAD_REQUEST)
            winner_id = match.player1_id if match.player1_score > match.player2_score else match.player2_id

        serializer = SubmitMatchResultSerializer(
            instance=match,
            data={'winner_id': winner_id},
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        match.refresh_from_db()
        return serialize_match(request, match, message="Match finished.")


class JoinMatchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            match = Match.objects.get(pk=pk)
        except Match.DoesNotExist:
            return Response({"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND)

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

        match.current_buzzer = request.user
        match.save(update_fields=['current_buzzer'])
        return serialize_match(request, match, message=f"{request.user.username} buzzed first.")


class AnswerQuestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        match = get_match_for_user(pk, request.user)
        if not match:
            return Response({"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND)
        if match.current_buzzer_id != request.user.id:
            return Response({"error": "You did not buzz first."}, status=status.HTTP_403_FORBIDDEN)
        if not match.current_question_id:
            return Response({"error": "No active question."}, status=status.HTTP_400_BAD_REQUEST)

        answer = (request.data.get('answer') or '').strip()
        if not answer:
            return Response({"error": "Answer is required."}, status=status.HTTP_400_BAD_REQUEST)

        question = match.current_question
        is_correct = answer.casefold() == question.correct_answer.strip().casefold()

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
            match.current_question = pick_random_question()
            match.save(update_fields=[score_field, 'current_buzzer', 'current_question'])
            return serialize_match(
                request,
                match,
                message="Correct answer. New question loaded.",
                result='correct',
            )

        match.current_buzzer = None
        match.save(update_fields=['current_buzzer'])
        return serialize_match(
            request,
            match,
            message="Incorrect answer. The question stays on the board.",
            result='incorrect',
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

        match.current_question = question
        match.current_buzzer = None
        match.save(update_fields=['current_question', 'current_buzzer'])
        return serialize_match(request, match, message=f"New {category} question loaded.")


class LeaderboardListView(generics.ListAPIView):
    queryset = Leaderboard.objects.all().order_by('-wins', '-points')
    serializer_class = LeaderboardSerializer
    permission_classes = [permissions.AllowAny]


class UserStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        data = {'black_card_active': user.black_card_active}
        return Response(data, status=status.HTTP_200_OK)
