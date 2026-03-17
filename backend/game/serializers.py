# game/serializers.py

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import BlackCard, Leaderboard, Match, Question

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
        BlackCard.objects.create(owner=user, current_holder=user)
        return user


class WalletCardSerializer(serializers.ModelSerializer):
    owner = serializers.StringRelatedField()
    current_holder = serializers.StringRelatedField()

    class Meta:
        model = BlackCard
        fields = ('owner', 'current_holder', 'captured_at')
        read_only_fields = fields


class CurrentUserSerializer(serializers.ModelSerializer):
    card_holder = serializers.SerializerMethodField()
    wallet_cards = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'black_card_active', 'card_holder', 'wallet_cards')
        read_only_fields = fields

    def get_card_holder(self, obj):
        black_card = getattr(obj, 'owned_black_card', None)
        if not black_card or black_card.current_holder_id == obj.id:
            return None
        return black_card.current_holder.username

    def get_wallet_cards(self, obj):
        cards = obj.wallet_black_cards.exclude(owner=obj).order_by('owner__username')
        return WalletCardSerializer(cards, many=True).data


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
    locked_out_player = UserSummarySerializer(read_only=True)
    final_question_player = UserSummarySerializer(read_only=True)
    required_opponent = UserSummarySerializer(read_only=True)
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
            'locked_out_player',
            'final_question_player',
            'required_opponent',
            'final_question_active',
            'card_saved',
            'current_question',
            'timestamp',
        )
        read_only_fields = fields

    def get_status(self, obj):
        if obj.winner_id:
            return 'completed'
        if obj.final_question_active:
            return 'final_question'
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
        with transaction.atomic():
            instance.winner = winner
            instance.loser = loser
            instance.timestamp = timezone.now()
            instance.final_question_active = False
            instance.final_question_player = None
            instance.current_buzzer = None
            instance.locked_out_player = None
            instance.save(update_fields=[
                'winner',
                'loser',
                'timestamp',
                'final_question_active',
                'final_question_player',
                'current_buzzer',
                'locked_out_player',
            ])

            leaderboard_winner, _ = Leaderboard.objects.get_or_create(user=winner)
            leaderboard_winner.wins += 1
            leaderboard_winner.points += 10
            leaderboard_winner.save(update_fields=['wins', 'points'])

            if loser:
                leaderboard_loser, _ = Leaderboard.objects.get_or_create(user=loser)
                leaderboard_loser.points -= 5
                leaderboard_loser.save(update_fields=['points'])

                black_card, _ = BlackCard.objects.get_or_create(owner=loser, defaults={'current_holder': loser})
                if instance.card_saved:
                    black_card.current_holder = loser
                    black_card.captured_at = None
                    loser.black_card_active = True
                else:
                    black_card.current_holder = winner
                    black_card.captured_at = timezone.now()
                    loser.black_card_active = False
                black_card.save(update_fields=['current_holder', 'captured_at'])
                loser.save(update_fields=['black_card_active'])

            winner.black_card_active = True
            winner.save(update_fields=['black_card_active'])

        return instance


class MatchHistorySerializer(serializers.ModelSerializer):
    player1 = UserSummarySerializer(read_only=True)
    player2 = UserSummarySerializer(read_only=True)
    winner = UserSummarySerializer(read_only=True)
    loser = UserSummarySerializer(read_only=True)

    class Meta:
        model = Match
        fields = (
            'id', 'player1', 'player2', 'player1_score', 'player2_score',
            'winner', 'loser', 'card_saved', 'timestamp',
        )
        read_only_fields = fields


class LeaderboardSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = Leaderboard
        fields = ('user', 'wins', 'points')
