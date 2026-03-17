from django.core.management.base import BaseCommand

from game.data.load_questions import load_questions


class Command(BaseCommand):
    help = 'Load the bundled Black Trivia question bank into the database.'

    def handle(self, *args, **options):
        load_questions()
