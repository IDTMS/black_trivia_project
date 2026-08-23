from game.models import BlackCard


def _score_for(match, user_id):
    if user_id == match.player1_id:
        return match.player1_score
    if user_id == match.player2_id:
        return match.player2_score
    return None


def _margin_language(margin):
    if margin <= 5:
        return "It came down to one swing. Nobody at that table had room to breathe."
    if margin <= 15:
        return "It stayed competitive deep into the match, but the winner created separation when it mattered."
    return "That was a statement table. The winner took control and never really gave it back."


def build_match_recap(match, viewer):
    """Build a recap from server-authoritative match facts only.

    This deliberately does not call an LLM. The returned payload is safe to
    show directly and is structured so a future text model can rewrite the
    prose without becoming the source of truth for scores, winners, or card
    ownership.
    """
    if not match.winner_id or not match.loser_id:
        raise ValueError("Match must be completed before a recap can be built.")

    if viewer.id not in (match.player1_id, match.player2_id):
        raise PermissionError("Viewer is not a participant in this match.")

    viewer_won = viewer.id == match.winner_id
    winner_score = _score_for(match, match.winner_id)
    loser_score = _score_for(match, match.loser_id)
    margin = abs((winner_score or 0) - (loser_score or 0))

    loser_card = BlackCard.objects.filter(owner_id=match.loser_id).select_related(
        "owner", "current_holder"
    ).first()
    card_captured = bool(
        loser_card and loser_card.current_holder_id == match.winner_id
    )

    if viewer_won:
        headline = f"You took {match.loser.username}'s Black Card."
        perspective = (
            f"{match.winner.username} closed the table {winner_score}-{loser_score}. "
            f"{_margin_language(margin)}"
        )
    else:
        headline = f"{match.winner.username} took your Black Card."
        perspective = (
            f"The table closed {winner_score}-{loser_score}. "
            f"{_margin_language(margin)}"
        )

    scoreline = f"{match.winner.username} {winner_score} – {loser_score} {match.loser.username}"
    card_line = (
        f"{match.winner.username} now holds {match.loser.username}'s card."
        if card_captured
        else "Card ownership is still syncing with the match result."
    )

    share_art_prompt = (
        "Premium Black Card rivalry poster, private members club atmosphere, "
        "obsidian black lacquer, restrained brushed gold, deep crimson edge light, "
        f"winner {match.winner.username}, loser {match.loser.username}, final score "
        f"{winner_score}-{loser_score}, physical black membership card as the hero object, "
        "cinematic editorial sports-poster composition, no fake logos, no extra statistics"
    )

    return {
        "match_id": match.id,
        "source": "server_facts",
        "ai_ready": True,
        "viewer_result": "win" if viewer_won else "loss",
        "headline": headline,
        "summary": perspective,
        "facts": [
            {"label": "FINAL", "value": scoreline},
            {"label": "MARGIN", "value": str(margin)},
            {"label": "CARD", "value": card_line},
        ],
        "telemetry": {
            "winner": match.winner.username,
            "loser": match.loser.username,
            "winner_score": winner_score,
            "loser_score": loser_score,
            "margin": margin,
            "card_captured": card_captured,
            "timestamp": match.timestamp.isoformat() if match.timestamp else None,
        },
        "share_art_prompt": share_art_prompt,
    }
