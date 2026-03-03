from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Question, Match, Leaderboard

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'black_card_active', 'is_staff')

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'category', 'difficulty', 'question_text')
    search_fields = ('category', 'question_text')

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ('player1', 'player2', 'winner', 'timestamp')

@admin.register(Leaderboard)
class LeaderboardAdmin(admin.ModelAdmin):
    list_display = ('user', 'wins', 'points')
