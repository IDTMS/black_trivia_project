# game/serializers.py

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Question, Match, Leaderboard
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, 
        required=True, 
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'black_card_active')
        read_only_fields = ('id', 'black_card_active')  # black_card_active is managed internally
    
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        # Initialize leaderboard for the new user
        Leaderboard.objects.create(user=user)
        return user

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = '__all__'
        read_only_fields = ('id',)  # id is read-only

class MatchSerializer(serializers.ModelSerializer):
    player1 = serializers.StringRelatedField(read_only=True)  # Represent players by username
    player2 = serializers.StringRelatedField(read_only=True)
    winner = serializers.StringRelatedField(read_only=True)
    loser = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = Match
        fields = ('id', 'player1', 'player2', 'winner', 'loser', 'timestamp')
        read_only_fields = ('id', 'player1', 'player2', 'winner', 'loser', 'timestamp')

class SubmitMatchResultSerializer(serializers.ModelSerializer):
    winner_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = Match
        fields = ('winner_id',)
    
    def validate_winner_id(self, value):
        user = self.context['request'].user
        try:
            winner = User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("Winner does not exist.")
        if winner not in [self.instance.player1, self.instance.player2]:
            raise serializers.ValidationError("Winner must be one of the match participants.")
        return value
    
    def update(self, instance, validated_data):
        winner_id = validated_data.get('winner_id')
        try:
            winner = User.objects.get(id=winner_id)
        except User.DoesNotExist:
            raise serializers.ValidationError({"winner_id": "Invalid winner ID."})
        
        loser = instance.player1 if instance.player2 == winner else instance.player2
        instance.winner = winner
        instance.loser = loser
        instance.timestamp = timezone.now()
        instance.save()
        
        # Update Leaderboard for Winner
        leaderboard_winner = Leaderboard.objects.get(user=winner)
        leaderboard_winner.wins = F('wins') + 1
        leaderboard_winner.points = F('points') + 10  # Example point increment
        leaderboard_winner.save()
        
        # Update Leaderboard for Loser
        leaderboard_loser = Leaderboard.objects.get(user=loser)
        leaderboard_loser.points = F('points') - 5  # Example point deduction
        leaderboard_loser.save()
        
        # Update User Status for Loser
        loser.black_card_active = False
        loser.save()
        
        return instance

class LeaderboardSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()  # Display username instead of ID
    
    class Meta:
        model = Leaderboard
        fields = ('user', 'wins', 'points')
