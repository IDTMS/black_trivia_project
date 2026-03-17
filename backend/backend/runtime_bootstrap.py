import os
import threading

from django.core.management import call_command
from django.db import connection


class RuntimeBootstrapMiddleware:
    _lock = threading.Lock()
    _ready = False

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self.should_bootstrap(request):
            self.ensure_runtime_ready()
        return self.get_response(request)

    def should_bootstrap(self, request):
        if not os.getenv('VERCEL'):
            return False
        if self.__class__._ready:
            return False
        return request.path != '/health/'

    def ensure_runtime_ready(self):
        if self.__class__._ready:
            return

        with self.__class__._lock:
            if self.__class__._ready:
                return

            existing_tables = set(connection.introspection.table_names())
            required_tables = {'game_user', 'game_question', 'game_leaderboard', 'game_match'}

            if not required_tables.issubset(existing_tables):
                call_command('migrate', interactive=False, verbosity=0)
                call_command('seed_questions', verbosity=0)

            self.__class__._ready = True
