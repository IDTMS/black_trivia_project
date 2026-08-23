import sys

from . import api as _api
from .ai import MatchRecapView, MatchShareArtStatusView, MatchShareArtView
from .api import (
    AnswerQuestionView,
    BuzzView,
    ChooseCategoryView,
    CurrentUserView,
    GoogleAuthView,
    JoinMatchByCodeView,
    JoinMatchView,
    LeaderboardListView,
    LeaveMatchView,
    MatchDetailView,
    MatchHistoryView,
    PushSubscribeView,
    QuestionListCreateView,
    QuestionRetrieveUpdateDestroyView,
    RandomQuestionView,
    RegisterView,
    StartMatchView,
    UserStatusView,
    VapidKeyView,
)
from .web import black_card_asset, dashboard, health, home, manifest, service_worker


# Compatibility seams for tests and older imports that patched helpers through
# ``game.views`` before the views module was split into ``game.views.api``.
# Keep the implementation in api.py while letting those patch points continue
# to affect the actual runtime call sites.
_original_verify_google_token = _api.verify_google_token
_original_pick_random_question = _api.pick_random_question


def _verify_google_token_proxy(*args, **kwargs):
    current = getattr(sys.modules[__name__], 'verify_google_token', None)
    if current is not _verify_google_token_proxy:
        return current(*args, **kwargs)
    return _original_verify_google_token(*args, **kwargs)


def _pick_random_question_proxy(*args, **kwargs):
    current = getattr(sys.modules[__name__], 'pick_random_question', None)
    if current is not _pick_random_question_proxy:
        return current(*args, **kwargs)
    return _original_pick_random_question(*args, **kwargs)


verify_google_token = _verify_google_token_proxy
pick_random_question = _pick_random_question_proxy
_api.verify_google_token = _verify_google_token_proxy
_api.pick_random_question = _pick_random_question_proxy
