from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from game.models import BlackCard, Match, User


class MatchRecapApiTests(APITestCase):
    def setUp(self):
        self.player1 = User.objects.create_user(username="nova", password="pass1234")
        self.player2 = User.objects.create_user(username="rex", password="pass1234")
        self.outsider = User.objects.create_user(username="outsider", password="pass1234")

        BlackCard.objects.create(owner=self.player1, current_holder=self.player1)
        BlackCard.objects.create(owner=self.player2, current_holder=self.player1)
        BlackCard.objects.create(owner=self.outsider, current_holder=self.outsider)

        self.match = Match.objects.create(
            player1=self.player1,
            player2=self.player2,
            player1_score=50,
            player2_score=35,
            winner=self.player1,
            loser=self.player2,
        )
        self.url = reverse("match-recap")

    def test_participant_gets_fact_grounded_recap(self):
        self.client.force_authenticate(self.player1)
        response = self.client.post(self.url, {"match_id": self.match.id}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["match_id"], self.match.id)
        self.assertEqual(response.data["source"], "server_facts")
        self.assertEqual(response.data["viewer_result"], "win")
        self.assertEqual(response.data["telemetry"]["winner"], "nova")
        self.assertEqual(response.data["telemetry"]["loser"], "rex")
        self.assertEqual(response.data["telemetry"]["margin"], 15)
        self.assertTrue(response.data["telemetry"]["card_captured"])
        self.assertIn("50-35", response.data["share_art_prompt"])

    def test_loser_gets_loss_perspective(self):
        self.client.force_authenticate(self.player2)
        response = self.client.post(self.url, {"match_id": self.match.id}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["viewer_result"], "loss")
        self.assertIn("took your Black Card", response.data["headline"])

    def test_outsider_cannot_read_match_recap(self):
        self.client.force_authenticate(self.outsider)
        response = self.client.post(self.url, {"match_id": self.match.id}, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_incomplete_match_does_not_get_recap(self):
        incomplete = Match.objects.create(
            player1=self.player1,
            player2=self.player2,
            player1_score=20,
            player2_score=10,
        )
        self.client.force_authenticate(self.player1)
        response = self.client.post(self.url, {"match_id": incomplete.id}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
