import os
import django
from game.models import Question
from game.data.questions_data import questions

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

def load_questions():
    for q in questions:
        if not Question.objects.filter(question_text=q['question_text']).exists():
            Question.objects.create(
                category=q['category'],
                question_text=q['question_text'],
                answer_choices=q['answer_choices'],
                correct_answer=q['correct_answer']
            )
            print(f"Added question: {q['question_text']}")
        else:
            print(f"Question already exists: {q['question_text']}")

if __name__ == "__main__":
    load_questions()
