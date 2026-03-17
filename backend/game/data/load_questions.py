from game.data.questions_data import questions


def load_questions():
    from game.models import Question

    added = 0
    skipped = 0
    for q in questions:
        if not Question.objects.filter(question_text=q['question_text']).exists():
            Question.objects.create(
                category=q['category'],
                difficulty=q.get('difficulty', 'medium'),
                question_text=q['question_text'],
                answer_choices=q['answer_choices'],
                correct_answer=q['correct_answer']
            )
            added += 1
        else:
            skipped += 1
    print(f"Done! Added {added} new questions, skipped {skipped} duplicates.")
    print(f"Total questions in database: {Question.objects.count()}")


if __name__ == "__main__":
    import os
    import django

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    django.setup()
    load_questions()
