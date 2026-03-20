from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


QUESTION_TIME_LIMIT_SECONDS = 15
MATCH_TARGET_SCORE = 50


class User(AbstractUser):
    black_card_active = models.BooleanField(default=True)
    google_sub = models.CharField(max_length=255, unique=True, null=True, blank=True)
    # Additional fields can be added here

    def __str__(self):
        return self.username


class Question(models.Model):
    CATEGORY_CHOICES = [
        ('history', 'History'),
        ('black_culture', 'Black Culture'),
        ('hip_hop', 'Hip-Hop & Music'),
        ('sports', 'Sports'),
        ('film_tv', 'Film & TV'),
        ('science', 'Science & Innovation'),
        ('food_culture', 'Food & Culture'),
        ('literature', 'Literature & Art'),
        ('current_events', 'Current Events'),
    ]

    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
    ]

    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES, default='medium')
    question_text = models.TextField(unique=True)
    answer_choices = models.JSONField()  # Works with both SQLite and PostgreSQL
    correct_answer = models.CharField(max_length=255)

    def __str__(self):
        return self.question_text


class Match(models.Model):
    invite_code = models.CharField(max_length=6, unique=True, null=True, blank=True)
    player1 = models.ForeignKey(User, related_name='matches_as_player1', on_delete=models.CASCADE)
    player2 = models.ForeignKey(
        User,
        related_name='matches_as_player2',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    winner = models.ForeignKey(User, related_name='wins', on_delete=models.SET_NULL, null=True, blank=True)
    loser = models.ForeignKey(User, related_name='losses', on_delete=models.SET_NULL, null=True, blank=True)
    current_buzzer = models.ForeignKey(User, related_name='current_buzzer', on_delete=models.SET_NULL, null=True, blank=True)
    locked_out_player = models.ForeignKey(
        User,
        related_name='locked_out_matches',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    final_question_player = models.ForeignKey(
        User,
        related_name='final_question_matches',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    required_opponent = models.ForeignKey(
        User,
        related_name='required_opponent_matches',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    player1_score = models.IntegerField(default=0)
    player2_score = models.IntegerField(default=0)
    final_question_active = models.BooleanField(default=False)
    card_saved = models.BooleanField(default=False)
    categories = models.JSONField(default=list, blank=True)
    question_started_at = models.DateTimeField(null=True, blank=True)
    current_question = models.ForeignKey(
        'Question',
        related_name='current_question',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )  # Track the current question for the match
    timestamp = models.DateTimeField(default=timezone.now)

    def __str__(self):
        opponent = self.player2.username if self.player2 else "Open Seat"
        return f"{self.player1} vs {opponent} on {self.timestamp}"


class Leaderboard(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    wins = models.IntegerField(default=0)
    points = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.user.username} - Wins: {self.wins}, Points: {self.points}"


class PushSubscription(models.Model):
    user = models.ForeignKey(User, related_name='push_subscriptions', on_delete=models.CASCADE)
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Push sub for {self.user.username}"


class BlackCard(models.Model):
    owner = models.OneToOneField(User, related_name='owned_black_card', on_delete=models.CASCADE)
    current_holder = models.ForeignKey(User, related_name='wallet_black_cards', on_delete=models.CASCADE)
    captured_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.owner.username} card held by {self.current_holder.username}"
