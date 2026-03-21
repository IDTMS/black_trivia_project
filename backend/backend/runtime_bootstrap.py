import os
import threading

from django.core.management import call_command
from django.db import DEFAULT_DB_ALIAS, connections
from django.db.utils import OperationalError, ProgrammingError
from django.db.migrations.executor import MigrationExecutor


SCHEMA_ERROR_HINTS = (
    'does not exist',
    'undefined column',
    'undefined table',
    'no such column',
    'no such table',
)


def should_enable_runtime_bootstrap():
    return bool(os.getenv('VERCEL') or os.getenv('VERCEL_ENV') or os.getenv('VERCEL_URL'))


def is_retryable_schema_error(exc):
    message = str(exc).lower()
    return any(hint in message for hint in SCHEMA_ERROR_HINTS)


def ensure_runtime_ready(force=False):
    if not force and not should_enable_runtime_bootstrap():
        return
    RuntimeBootstrapMiddleware._ensure_runtime_ready(force=force)


class RuntimeBootstrapMiddleware:
    _lock = threading.Lock()
    _ready = False

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self.should_bootstrap(request):
            self.ensure_runtime_ready()
        try:
            return self.get_response(request)
        except (OperationalError, ProgrammingError) as exc:
            if getattr(request, '_runtime_bootstrap_retried', False) or not is_retryable_schema_error(exc):
                raise

            request._runtime_bootstrap_retried = True
            self.ensure_runtime_ready(force=True)
            return self.get_response(request)

    def should_bootstrap(self, request):
        if not should_enable_runtime_bootstrap():
            return False
        if self.__class__._ready:
            return False
        return request.path != '/health/'

    def ensure_runtime_ready(self, force=False):
        self.__class__._ensure_runtime_ready(force=force)

    @classmethod
    def _ensure_runtime_ready(cls, force=False):
        if cls._ready and not force:
            return

        with cls._lock:
            if cls._ready and not force:
                return

            if force or cls.requires_runtime_setup():
                call_command('migrate', interactive=False, verbosity=0)
                call_command('seed_questions', verbosity=0)

            cls._ready = True

    @classmethod
    def requires_runtime_setup(cls):
        connection = connections[DEFAULT_DB_ALIAS]
        existing_tables = set(connection.introspection.table_names())
        required_tables = {
            'game_user',
            'game_question',
            'game_leaderboard',
            'game_match',
            'game_blackcard',
        }

        if not required_tables.issubset(existing_tables):
            return True

        executor = MigrationExecutor(connection)
        targets = executor.loader.graph.leaf_nodes()
        return bool(executor.migration_plan(targets))
