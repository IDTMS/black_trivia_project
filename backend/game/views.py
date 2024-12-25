from django.shortcuts import render
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.db import models
from django.db.models import F
from django.contrib.auth import get_user_model
from .models import Question, Match, Leaderboard
from .serializers import (
    UserSerializer,
    QuestionSerializer,
    MatchSerializer,
    LeaderboardSerializer,
    SubmitMatchResultSerializer
)
import random

User = get_user_model()

# -----------------------------
# Home View
# -----------------------------

def home(request):
    return render(request, 'games/home.html')

def dashboard(request):
    return render(request, 'games/dashboard.html')

# -----------------------------
# User Registration and Auth
# -----------------------------

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserSerializer

# -----------------------------
# Question CRUD Operations
# -----------------------------

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
        count = Question.objects.count()
        if count == 0:
            return Response({"detail": "No questions available."}, status=status.HTTP_404_NOT_FOUND)
        random_index = random.randint(0, count - 1)
        question = Question.objects.all()[random_index]
        serializer = QuestionSerializer(question)
        return Response(serializer.data, status=status.HTTP_200_OK)

# -----------------------------
# Match Management
# -----------------------------

class StartMatchView(generics.CreateAPIView):
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        player1 = request.user
        player2 = User.objects.exclude(id=player1.id).order_by('?').first()
        if not player2:
            return Response({"error": "No available players to match with."}, status=status.HTTP_400_BAD_REQUEST)
        match = Match.objects.create(player1=player1, player2=player2)
        serializer = self.get_serializer(match)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class JoinMatchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            match = Match.objects.get(pk=pk)
        except Match.DoesNotExist:
            return Response({"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND)

        player = request.user
        if match.player1 != player and match.player2 != player:
            return Response({"error": "You are not part of this match."}, status=status.HTTP_403_FORBIDDEN)

        return Response({"message": f"Player {player.username} successfully joined match {match.id}."}, status=status.HTTP_200_OK)


class BuzzView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        match = Match.objects.get(pk=pk)
        player = request.user

        if player not in [match.player1, match.player2]:
            return Response({"error": "You are not part of this match."}, status=status.HTTP_403_FORBIDDEN)

        if match.current_buzzer:
            return Response({"error": "Another player has already buzzed."}, status=status.HTTP_400_BAD_REQUEST)

        match.current_buzzer = player
        match.save()

        return Response({"message": f"{player.username} buzzed first!"})
    
class RandomQuestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Question.objects.count()
        if count == 0:
            return Response({"detail": "No questions available."}, status=status.HTTP_404_NOT_FOUND)
        random_index = random.randint(0, count - 1)
        question = Question.objects.all()[random_index]
        serializer = QuestionSerializer(question)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AnswerQuestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        match = Match.objects.get(pk=pk)
        player = request.user

        if match.current_buzzer != player:
            return Response({"error": "You did not buzz first."}, status=status.HTTP_403_FORBIDDEN)

        question_id = request.data.get('question_id')
        answer = request.data.get('answer')

        try:
            question = Question.objects.get(pk=question_id)
        except Question.DoesNotExist:
            return Response({"error": "Invalid question ID."}, status=status.HTTP_400_BAD_REQUEST)

        if answer == question.correct_answer:
            leaderboard = Leaderboard.objects.get(user=player)
            leaderboard.points += 10
            leaderboard.save()
            return Response({"message": "Correct answer!", "next_action": "Pick a category"})
        else:
            return Response({"error": "Incorrect answer!"}, status=status.HTTP_400_BAD_REQUEST)

class ChooseCategoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        match = Match.objects.get(pk=pk)
        player = request.user

        if player != match.current_buzzer:
            return Response({"error": "You are not allowed to pick a category."}, status=status.HTTP_403_FORBIDDEN)

        category = request.data.get('category')
        if not category:
            return Response({"error": "Category is required."}, status=status.HTTP_400_BAD_REQUEST)

        question = Question.objects.filter(category=category).order_by('?').first()
        if not question:
            return Response({"error": "No questions available in this category."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "message": f"Next question in category: {category}",
            "question": {
                "id": question.id,
                "text": question.question_text,
                "choices": question.answer_choices
            }
        })

class SubmitMatchResultView(generics.UpdateAPIView):
    queryset = Match.objects.all()
    serializer_class = SubmitMatchResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Match.objects.filter(
            models.Q(player1=self.request.user) | models.Q(player2=self.request.user)
        )

    def update(self, request, *args, **kwargs):
        match = self.get_object()
        if match.winner or match.loser:
            return Response({"error": "Match result already submitted."}, status=status.HTTP_400_BAD_REQUEST)

        winner_id = request.data.get('winner_id')
        if not winner_id:
            return Response({"error": "Winner ID not provided."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            winner = User.objects.get(id=winner_id)
        except User.DoesNotExist:
            return Response({"error": "Invalid winner ID."}, status=status.HTTP_400_BAD_REQUEST)

        if winner not in [match.player1, match.player2]:
            return Response({"error": "Winner must be a participant of the match."}, status=status.HTTP_400_BAD_REQUEST)

        loser = match.player1 if match.player2 == winner else match.player2
        match.winner = winner
        match.loser = loser
        match.timestamp = timezone.now()
        match.save()

        leaderboard_winner = Leaderboard.objects.get(user=winner)
        leaderboard_winner.wins = F('wins') + 1
        leaderboard_winner.points = F('points') + 10
        leaderboard_winner.save()

        leaderboard_loser = Leaderboard.objects.get(user=loser)
        leaderboard_loser.points = F('points') - 5
        leaderboard_loser.save()

        return Response({"message": "Match result updated successfully!"})

# -----------------------------
# Leaderboard Management
# -----------------------------

class LeaderboardListView(generics.ListAPIView):
    queryset = Leaderboard.objects.all().order_by('-wins', '-points')
    serializer_class = LeaderboardSerializer
    permission_classes = [permissions.IsAuthenticated]

# -----------------------------
# User Status
# -----------------------------

class UserStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        data = {'black_card_active': user.black_card_active}
        return Response(data, status=status.HTTP_200_OK)
