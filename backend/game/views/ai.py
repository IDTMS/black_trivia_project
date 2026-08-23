from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from game.models import Match
from game.services.havnai_media import (
    HavnAIRequestError,
    HavnAIUnavailable,
    get_rivalry_art_job,
    sign_media_job,
    submit_rivalry_art,
    verify_media_job_signature,
)
from game.services.match_recap import build_match_recap


def _get_completed_match_for_user(request, match_id):
    try:
        match = Match.objects.select_related(
            "player1", "player2", "winner", "loser"
        ).get(pk=match_id)
    except Match.DoesNotExist:
        return None, Response(
            {"error": "Match not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.user.id not in (match.player1_id, match.player2_id):
        return None, Response(
            {"error": "Match not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not match.winner_id:
        return None, Response(
            {"error": "Match recap is available after the match ends."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return match, None


class MatchRecapView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        match_id = request.data.get("match_id")
        if not match_id:
            return Response(
                {"error": "match_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        match, error_response = _get_completed_match_for_user(request, match_id)
        if error_response:
            return error_response

        try:
            payload = build_match_recap(match, request.user)
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(payload, status=status.HTTP_200_OK)


class MatchShareArtView(APIView):
    """Queue HavnAI rivalry artwork from verified completed-match facts."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        match_id = request.data.get("match_id")
        if not match_id:
            return Response(
                {"error": "match_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        match, error_response = _get_completed_match_for_user(request, match_id)
        if error_response:
            return error_response

        recap = build_match_recap(match, request.user)
        try:
            job = submit_rivalry_art(recap["share_art_prompt"])
        except HavnAIUnavailable as exc:
            return Response(
                {"error": "havnai_not_configured", "message": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except HavnAIRequestError as exc:
            return Response(
                {"error": "havnai_request_failed", "message": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        media_token = sign_media_job(match.id, request.user.id, job["job_id"])
        return Response(
            {
                **job,
                "match_id": match.id,
                "provider": "havnai",
                "media_token": media_token,
                "poll_after_ms": 2000,
                "overlay": {
                    "winner": recap["telemetry"]["winner"],
                    "loser": recap["telemetry"]["loser"],
                    "winner_score": recap["telemetry"]["winner_score"],
                    "loser_score": recap["telemetry"]["loser_score"],
                    "viewer_result": recap["viewer_result"],
                },
            },
            status=status.HTTP_202_ACCEPTED,
        )


class MatchShareArtStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        match_id = request.query_params.get("match_id")
        job_id = str(request.query_params.get("job_id") or "").strip()
        media_token = str(request.query_params.get("media_token") or "").strip()
        if not match_id or not job_id or not media_token:
            return Response(
                {"error": "match_id, job_id, and media_token are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        match, error_response = _get_completed_match_for_user(request, match_id)
        if error_response:
            return error_response

        if not verify_media_job_signature(
            match.id, request.user.id, job_id, media_token
        ):
            return Response(
                {"error": "Invalid media token."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            job = get_rivalry_art_job(job_id)
        except HavnAIUnavailable as exc:
            return Response(
                {"error": "havnai_not_configured", "message": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except HavnAIRequestError as exc:
            return Response(
                {"error": "havnai_request_failed", "message": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                **job,
                "match_id": match.id,
                "provider": "havnai",
                "media_token": media_token,
            },
            status=status.HTTP_200_OK,
        )
