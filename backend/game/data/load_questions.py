from game.data.questions_data import DEPRECATED_QUESTION_TEXTS, questions


def load_questions():
    from game.models import Question

    added = 0
    synced = 0
    removed = 0

    if DEPRECATED_QUESTION_TEXTS:
        removed, _ = Question.objects.filter(question_text__in=DEPRECATED_QUESTION_TEXTS).delete()

    for q in questions:
        _, created = Question.objects.update_or_create(
            question_text=q['question_text'],
            defaults={
                'category': q['category'],
                'difficulty': q.get('difficulty', 'medium'),
                'answer_choices': q['answer_choices'],
                'correct_answer': q['correct_answer'],
            },
        )
        if created:
            added += 1
        else:
            synced += 1

    print(f"Done! Added {added} questions, synced {synced} existing questions, removed {removed} deprecated questions.")
    print(f"Total questions in database: {Question.objects.count()}")


if __name__ == "__main__":
    import os
    import django

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    django.setup()
    load_questions()
