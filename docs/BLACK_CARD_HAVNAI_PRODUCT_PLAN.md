# Black Card × HavnAI Product Plan

## Product direction

Black Card stays a fast, competitive Black-culture trivia game. The Django backend remains the game authority and the Expo client becomes the primary product experience. HavnAI should be additive: identity, AI services, media generation, shared ecosystem surfaces, and optional rewards must never be required for a basic match to work.

## Current product surfaces

Mobile currently has Boot, Login, Register, Start, Home, Game, Match, Leaderboard, and Profile screens. Core multiplayer and Black Card ownership/vault behavior already exist and should be protected while the presentation layer is upgraded.

## Design target

The visual language should feel like a premium private club/game room rather than a generic trivia app:

- obsidian and velvet-black surfaces
- restrained gold metal accents
- deep crimson used for tension and possession states
- warm off-white typography
- physical Black Card as the central object/identity
- subtle grain, depth, glass, edge-lighting, and motion instead of excessive glow
- confident editorial typography and stronger hierarchy
- animation and haptics used for challenge, buzz, answer lock, card capture, win, and loss moments

The mobile client is the design source of truth. Web should converge on the same language after the mobile system stabilizes.

## Phase 1 — Product and visual foundation

1. Consolidate reusable visual tokens beyond raw colors: surfaces, borders, shadows, spacing, motion durations, and semantic states.
2. Build reusable premium components for panels, buttons, stat chips, category cards, player plates, and the physical Black Card.
3. Refine Start/Home/Profile first so the game has a coherent identity before touching match logic.
4. Improve Match/Game presentation without changing server-authoritative rules.
5. Add explicit loading, reconnecting, waiting-for-opponent, card-captured, and match-complete visual states.
6. Keep accessibility: readable contrast, reduced-motion support, scalable type, and non-color-only state indicators.

## Phase 2 — Match experience

Turn the head-to-head match into the hero experience:

- versus intro with both players and the current Black Card owner
- stronger category-selection presentation
- visible round state and score tension
- high-impact buzz/lock feedback
- answer reveal with concise context after scoring
- card-transfer/capture sequence when ownership changes
- rematch and rivalry framing after results

The existing Black Card 24-hour ownership mechanic remains backend-authoritative.

## Phase 3 — AI layer

AI must improve the game without becoming the judge of record for scored answers.

### AI Host

Optional host voice/personality that introduces categories, reacts to streaks, and delivers short transitions. Host text is generated or templated outside the scoring path.

### Answer context

After the backend has already marked an answer correct/incorrect, AI may provide a short explanation, historical/cultural context, and related fact. It never overrides the canonical answer during a live match.

### Question Studio

Use HavnAI models to draft new question candidates by category, difficulty, era, and topic. Candidates enter a review pipeline; they do not go directly into competitive play. Store provenance, source notes, model, review state, and canonical answer.

### Personalized practice

Use match history to recommend practice categories and difficulty. Keep competitive matchmaking/scoring deterministic.

### Rivalry recaps

Generate short post-match summaries from actual match telemetry: comeback, category dominance, streak, card capture, and head-to-head history. No invented stats.

### Dynamic media

Use HavnAI image/video generation for category plates, event art, seasonal packs, promotional assets, and optional player-card cosmetics. Generated media should be curated and cached rather than generated synchronously during a match.

## Phase 4 — HavnAI ecosystem integration

Black Card should appear as a first-class HavnAI app while remaining independently deployable.

Recommended boundary:

- `blackcard.joinhavn.io` remains a distinct product surface
- Black Card backend remains responsible for matches, questions, Black Card ownership, scoring, and leaderboards
- HavnAI core provides shared ecosystem services through narrow APIs
- failures in HavnAI AI/media/reward services must not prevent local/authenticated trivia play

Potential shared services:

- account linking between Black Card identity and HavnAI identity/wallet
- optional shared profile/avatar
- HavnAI credit balance display
- bounded ecosystem achievements/rewards
- AI generation jobs for reviewed content/media
- cross-app activity feed or launch links

Do not replace Black Card's existing JWT/auth model with a wallet-only login. Link identities instead so normal players are not forced into crypto onboarding.

## Phase 5 — HavnAI AI service contract

Introduce a small Black Card integration layer instead of scattering HavnAI calls through screens.

Suggested backend namespace:

- `/api/havnai/status/`
- `/api/havnai/account/link/`
- `/api/havnai/profile/`
- `/api/ai/explain-answer/`
- `/api/ai/match-recap/`
- `/api/ai/question-drafts/` (admin/reviewer only)
- `/api/ai/media-jobs/` (admin/content pipeline first)

The Django backend should call HavnAI server-to-server where secrets or trusted generation policy are involved. Mobile should not hold HavnAI service credentials.

## Phase 6 — Content integrity

Black-culture trivia requires a higher standard than generic generated trivia.

Every production question should retain:

- canonical answer
- accepted aliases where appropriate
- category and difficulty
- source/provenance notes
- review state
- author/generator metadata
- last-reviewed timestamp

AI-generated questions remain drafts until reviewed. Questions involving disputed facts should be excluded or written to avoid ambiguity.

## Phase 7 — Shipping order

### Sprint A — visual system
- Start screen
- Home/vault
- Profile
- shared components/tokens

### Sprint B — match polish
- create/join/waiting room
- versus intro
- category selection
- buzz/answer feedback
- results/card capture

### Sprint C — AI without risk
- post-answer explanations
- post-match rivalry recap
- practice recommendations

### Sprint D — content pipeline
- AI question drafting
- reviewer workflow
- provenance and quality gates

### Sprint E — ecosystem
- HavnAI account linking
- shared balance/profile surfaces
- optional bounded rewards/achievements
- HavnAI launcher/cross-links

### Sprint F — generated media
- category/event art
- cosmetic Black Card variants
- seasonal/promo packages

## Guardrails

- Do not let an LLM decide live-match correctness.
- Do not require HavnAI connectivity to play core trivia.
- Do not force wallet onboarding.
- Do not turn shared credits into uncontrolled play-to-earn farming.
- Do not regenerate strong existing branding just because a generation tool exists.
- Keep game state and ownership backend-authoritative.
- Ship visual and AI changes in small reviewable branches.

## Immediate engineering target

Begin with the mobile visual foundation and a clean HavnAI integration seam. Do not add live AI calls to match gameplay yet. The first visible milestone should make Start → Home → Match feel like one premium product while preserving all current game behavior.