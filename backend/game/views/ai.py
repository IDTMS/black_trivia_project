from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from game.models import Match
from game.services.match_recap import build_match_recap


class MatchRecapView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        match_id = request.data.get("match_id")
        if not match_id:
            return Response(
                {"error": "match_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            match = Match.objects.select_related(
                "player1", "player2", "winner", "loser"
            ).get(pk=match_id)
        except Match.DoesNotExist:
            return Response(
                {"error": "Match not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.user.id not in (match.player1_id, match.player2_id):
            # Keep participant-only match data opaque to other users.
            return Response(
                {"error": "Match not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not match.winner_id:
            return Response(
                {"error": "Match recap is available after the match ends."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = build_match_recap(match, request.user)
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(payload, status=status.HTTP_200_OK)
