from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import BlackCard, Leaderboard, Match


User = get_user_model()


class HavnAIMatchMediaTests(APITestCase):
    def setUp(self):
        self.player1 = User.objects.create_user(
            username="poster_winner",
            email="winner@example.com",
            password="StrongPass123!",
        )
        self.player2 = User.objects.create_user(
            username="poster_loser",
            email="loser@example.com",
            password="StrongPass123!",
        )
        Leaderboard.objects.create(user=self.player1)
        Leaderboard.objects.create(user=self.player2)
        BlackCard.objects.create(owner=self.player1, current_holder=self.player1)
        BlackCard.objects.create(
            owner=self.player2,
            current_holder=self.player1,
            captured_at=timezone.now(),
        )
        self.match = Match.objects.create(
            player1=self.player1,
            player2=self.player2,
            winner=self.player1,
            loser=self.player2,
            player1_score=50,
            player2_score=35,
        )
        self.client.force_authenticate(user=self.player1)

    @patch("game.views.ai.submit_rivalry_art")
    def test_share_art_queues_havnai_job_from_verified_match(self, mock_submit):
        mock_submit.return_value = {
            "job_id": "job-black-card-123",
            "status": "queued",
            "stage": "queued",
            "progress": 0.0,
            "model": "test-model",
            "image_url": None,
            "artifacts": [],
            "error_code": None,
        }

        response = self.client.post(
            "/api/ai/match-share-art/",
            {"match_id": self.match.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["provider"], "havnai")
        self.assertEqual(response.data["job_id"], "job-black-card-123")
        self.assertTrue(response.data["media_token"])
        self.assertEqual(response.data["overlay"]["winner"], "poster_winner")
        self.assertEqual(response.data["overlay"]["loser"], "poster_loser")
        self.assertEqual(response.data["overlay"]["winner_score"], 50)
        self.assertEqual(response.data["overlay"]["loser_score"], 35)

        prompt = mock_submit.call_args.args[0]
        self.assertIn("physical black membership card", prompt)
        self.assertIn("no visible text", prompt)
        self.assertNotIn("poster_winner", prompt)
        self.assertNotIn("50-35", prompt)

    @patch("game.views.ai.get_rivalry_art_job")
    @patch("game.views.ai.submit_rivalry_art")
    def test_signed_media_token_can_poll_only_the_queued_job(self, mock_submit, mock_get):
        mock_submit.return_value = {
            "job_id": "job-black-card-456",
            "status": "queued",
            "stage": "queued",
            "progress": 0.0,
            "model": "test-model",
            "image_url": None,
            "artifacts": [],
            "error_code": None,
        }
        queue_response = self.client.post(
            "/api/ai/match-share-art/",
            {"match_id": self.match.id},
            format="json",
        )
        media_token = queue_response.data["media_token"]

        mock_get.return_value = {
            "job_id": "job-black-card-456",
            "status": "completed",
            "stage": "completed",
            "progress": 100.0,
            "model": "test-model",
            "image_url": "https://api.example.test/static/outputs/job-black-card-456.png",
            "artifacts": [
                {
                    "kind": "image",
                    "url": "https://api.example.test/static/outputs/job-black-card-456.png",
                }
            ],
            "error_code": None,
        }

        response = self.client.get(
            "/api/ai/match-share-art/status/",
            {
                "match_id": self.match.id,
                "job_id": "job-black-card-456",
                "media_token": media_token,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "completed")
        self.assertIn("job-black-card-456.png", response.data["image_url"])

        bad_response = self.client.get(
            "/api/ai/match-share-art/status/",
            {
                "match_id": self.match.id,
                "job_id": "different-job",
                "media_token": media_token,
            },
        )
        self.assertEqual(bad_response.status_code, status.HTTP_403_FORBIDDEN)

    @patch("game.views.ai.submit_rivalry_art")
    def test_non_participant_cannot_generate_share_art(self, mock_submit):
        outsider = User.objects.create_user(
            username="outsider",
            email="outsider@example.com",
            password="StrongPass123!",
        )
        self.client.force_authenticate(user=outsider)

        response = self.client.post(
            "/api/ai/match-share-art/",
            {"match_id": self.match.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        mock_submit.assert_not_called()
