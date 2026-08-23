# Black Card AI Recap Contract

Black Card match results remain server-authoritative. AI may rewrite or enhance presentation only after a match has ended.

## Current source

`POST /api/ai/match-recap/` accepts a completed participant `match_id` and returns a fact-grounded recap containing:

- winner and loser
- final score
- score margin
- verified Black Card capture state
- viewer win/loss perspective
- deterministic headline/summary
- a share-art prompt built only from those verified facts

The response uses `source: server_facts` and `ai_ready: true`.

## Future text AI

A future text model may receive only the recap payload/telemetry and produce alternate host copy, rivalry commentary, or social captions. The generated text must not introduce statistics or events that are absent from the payload.

AI never decides:

- whether an answer was correct
- score changes
- winner or loser
- Black Card ownership
- match completion

## HavnAI role

HavnAI currently provides the strongest fit for asynchronous generated media. The `share_art_prompt` can later feed a HavnAI image/video job to produce a cached rivalry poster or match-card visual. Media generation must remain outside the live scoring path, and failure must never block match completion or the normal recap.
