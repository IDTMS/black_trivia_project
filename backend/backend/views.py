from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from game.models import Match, Question, Leaderboard, User
import random

def start_match(request):
    if request.method == "POST":
        player1 = User.objects.get(username=request.POST.get("player1"))
        player2 = User.objects.get(username=request.POST.get("player2"))
        match = Match.objects.create(player1=player1, player2=player2)
        return JsonResponse({"match_id": match.id, "message": "Match started!"})

def get_question(request, match_id):
    match = get_object_or_404(Match, id=match_id)
    question = random.choice(Question.objects.all())
    return JsonResponse({
        "question_text": question.question_text,
        "answer_choices": question.answer_choices,
        "match_id": match.id,
    })

def submit_answer(request, match_id):
    match = get_object_or_404(Match, id=match_id)
    question_id = request.POST.get("question_id")
    selected_answer = request.POST.get("answer")
    question = get_object_or_404(Question, id=question_id)

    if selected_answer == question.correct_answer:
        # Assign winner and loser for simplicity
        match.winner = match.player1  # Replace with logic to determine winner
        match.loser = match.player2
        match.save()

        # Update leaderboard
        leaderboard, created = Leaderboard.objects.get_or_create(user=match.winner)
        leaderboard.wins += 1
        leaderboard.points += 10  # Example scoring
        leaderboard.save()

        return JsonResponse({"message": "Correct answer! Match finished."})
    else:
        return JsonResponse({"message": "Incorrect answer!"})
