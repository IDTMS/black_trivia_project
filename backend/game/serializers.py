# game/serializers.py

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers

from .models import Leaderboard, Match, Question

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'},
    )

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'black_card_active')
        read_only_fields = ('id', 'black_card_active')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )
        Leaderboard.objects.create(user=user)
        return user


class CurrentUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'black_card_active')
        read_only_fields = fields


class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username')
        read_only_fields = fields


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = '__all__'
        read_only_fields = ('id',)


class MatchQuestionSerializer(serializers.ModelSerializer):
    text = serializers.CharField(source='question_text', read_only=True)
    choices = serializers.ListField(source='answer_choices', read_only=True)

    class Meta:
        model = Question
        fields = ('id', 'category', 'difficulty', 'text', 'choices')
        read_only_fields = fields


class MatchStateSerializer(serializers.ModelSerializer):
    player1 = UserSummarySerializer(read_only=True)
    player2 = UserSummarySerializer(read_only=True)
    winner = UserSummarySerializer(read_only=True)
    loser = UserSummarySerializer(read_only=True)
    current_buzzer = UserSummarySerializer(read_only=True)
    current_question = MatchQuestionSerializer(read_only=True)
    status = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = (
            'id',
            'invite_code',
            'status',
            'user_role',
            'player1',
            'player2',
            'player1_score',
            'player2_score',
            'winner',
            'loser',
            'current_buzzer',
            'current_question',
            'timestamp',
        )
        read_only_fields = fields

    def get_status(self, obj):
        if obj.winner_id:
            return 'completed'
        if obj.player2_id:
            return 'live'
        return 'waiting'

    def get_user_role(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        if obj.player1_id == request.user.id:
            return 'player1'
        if obj.player2_id == request.user.id:
            return 'player2'
        return None


class SubmitMatchResultSerializer(serializers.ModelSerializer):
    winner_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Match
        fields = ('winner_id',)

    def validate_winner_id(self, value):
        try:
            winner = User.objects.get(id=value)
        except User.DoesNotExist as exc:
            raise serializers.ValidationError("Winner does not exist.") from exc

        if winner not in [self.instance.player1, self.instance.player2]:
            raise serializers.ValidationError("Winner must be one of the match participants.")
        return value

    def update(self, instance, validated_data):
        winner_id = validated_data.get('winner_id')
        winner = User.objects.get(id=winner_id)
        loser = instance.player1 if instance.player2 == winner else instance.player2
        instance.winner = winner
        instance.loser = loser
        instance.timestamp = timezone.now()
        instance.save(update_fields=['winner', 'loser', 'timestamp'])

        leaderboard_winner, _ = Leaderboard.objects.get_or_create(user=winner)
        leaderboard_winner.wins += 1
        leaderboard_winner.points += 10
        leaderboard_winner.save(update_fields=['wins', 'points'])

        if loser:
            leaderboard_loser, _ = Leaderboard.objects.get_or_create(user=loser)
            leaderboard_loser.points -= 5
            leaderboard_loser.save(update_fields=['points'])
            loser.black_card_active = False
            loser.save(update_fields=['black_card_active'])

        return instance


class LeaderboardSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = Leaderboard
        fields = ('user', 'wins', 'points')
