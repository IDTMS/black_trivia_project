from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Leaderboard

User = get_user_model()


class AuthAndLeaderboardTests(APITestCase):
    def test_register_creates_user_and_leaderboard(self):
        response = self.client.post(
            '/api/register/',
            {
                'username': 'newplayer',
                'email': 'newplayer@example.com',
                'password': 'StrongPass123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username='newplayer')
        self.assertEqual(user.email, 'newplayer@example.com')
        self.assertTrue(Leaderboard.objects.filter(user=user).exists())

    def test_leaderboard_is_public(self):
        user = User.objects.create_user(
            username='leaderboard_user',
            email='leaderboard@example.com',
            password='StrongPass123!',
        )
        Leaderboard.objects.create(user=user, wins=3, points=25)

        response = self.client.get('/api/leaderboard/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['user'], 'leaderboard_user')
