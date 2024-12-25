from django.contrib import admin
from .models import Question

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'category', 'question_text')
    search_fields = ('category', 'question_text')
