from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.contrib.postgres.fields import ArrayField


class User(AbstractUser):
    black_card_active = models.BooleanField(default=True)
    # Additional fields can be added here

    def __str__(self):
        return self.username


class Question(models.Model):
    CATEGORY_CHOICES = [
        ('history', 'History'),
        ('black_culture', 'Black Culture'),
        # Add more categories as needed
    ]

    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    question_text = models.TextField(unique=True)
    answer_choices = ArrayField(models.CharField(max_length=255))  # Requires PostgreSQL
    correct_answer = models.CharField(max_length=255)

    def __str__(self):
        return self.question_text


class Match(models.Model):
    player1 = models.ForeignKey(User, related_name='matches_as_player1', on_delete=models.CASCADE)
    player2 = models.ForeignKey(User, related_name='matches_as_player2', on_delete=models.CASCADE)
    winner = models.ForeignKey(User, related_name='wins', on_delete=models.SET_NULL, null=True, blank=True)
    loser = models.ForeignKey(User, related_name='losses', on_delete=models.SET_NULL, null=True, blank=True)
    current_buzzer = models.ForeignKey(User, related_name='current_buzzer', on_delete=models.SET_NULL, null=True, blank=True)
    current_question = models.ForeignKey(
        'Question',
        related_name='current_question',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )  # Track the current question for the match
    timestamp = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.player1} vs {self.player2} on {self.timestamp}"


class Leaderboard(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    wins = models.IntegerField(default=0)
    points = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.user.username} - Wins: {self.wins}, Points: {self.points}"
