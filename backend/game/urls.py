from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    RegisterView,
    QuestionListCreateView,
    QuestionRetrieveUpdateDestroyView,
    RandomQuestionView,
    StartMatchView,
    JoinMatchView,
    BuzzView,
    AnswerQuestionView,
    ChooseCategoryView,
    SubmitMatchResultView,
    LeaderboardListView,
    UserStatusView,
    home,
    dashboard,
)

urlpatterns = [
    # User Registration and Authentication
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='login'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Question Management
    path('questions/', QuestionListCreateView.as_view(), name='question-list-create'),
    path('questions/<int:pk>/', QuestionRetrieveUpdateDestroyView.as_view(), name='question-detail'),
    path('questions/random/', RandomQuestionView.as_view(), name='random-question'),

    # Match Management
    path('matches/', StartMatchView.as_view(), name='start-match'),
    path('matches/<int:pk>/join/', JoinMatchView.as_view(), name='join-match'),
    path('matches/<int:pk>/buzz/', BuzzView.as_view(), name='buzz'),
    path('matches/<int:pk>/answer/', AnswerQuestionView.as_view(), name='answer-question'),
    path('matches/<int:pk>/choose-category/', ChooseCategoryView.as_view(), name='choose-category'),

    # Leaderboard and User Status
    path('leaderboard/', LeaderboardListView.as_view(), name='leaderboard'),
    path('user/status/', UserStatusView.as_view(), name='user-status'),

    # Dashboard and Home Pages
    path('dashboard/', dashboard, name='dashboard'),
    path('', home, name='home'),  # Home view at the root path
]
