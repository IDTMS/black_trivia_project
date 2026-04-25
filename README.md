# Black Card

A head-to-head Black culture trivia game with real match stakes.

This repo contains:
- a Django backend and web shell that currently powers the deployed app
- an Expo mobile client with the stronger visual direction for the product

## Current state

The backend is the source of truth and can run today.
The mobile app is further along visually, but it is still being tightened up as a product surface.

If you are touching this repo, assume:
- **backend/web is the current production path**
- **mobile is the likely long-term hero experience**

## Repo layout

```text
api/                  Vercel Python entrypoint
backend/              Django project, game logic, templates, API
mobile/               Expo React Native client
build.py              Vercel build hook
vercel.json           Vercel routing config
```

## Local development

### Backend

From the repo root:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd backend
python manage.py migrate
python manage.py seed_questions
python manage.py runserver
```

The backend will be available at `http://127.0.0.1:8000/`.

### Mobile app

From the repo root:

```bash
cd mobile
npm install
npm start
```

Set the API base URL before running on device or simulator:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
```

For Android emulator, `10.0.2.2` may be the right host instead of `127.0.0.1`.

## Environment variables

Copy `.env.example` and set real values for production:

```bash
DJANGO_SECRET_KEY=replace-with-a-long-random-secret
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=blackcard.joinhavn.io
CORS_ALLOWED_ORIGINS=https://blackcard.joinhavn.io
CSRF_TRUSTED_ORIGINS=https://blackcard.joinhavn.io
GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
FORCE_HTTPS=true
SECURE_HSTS_SECONDS=31536000
DATABASE_URL=postgresql://username:password@hostname:5432/black_trivia
DATABASE_URL_UNPOOLED=postgresql://username:password@hostname:5432/black_trivia
```

Notes:
- `DATABASE_URL` should be treated as required on Vercel
- SQLite is fine for local development, not for public production
- if using Neon, prefer pooled runtime access in `DATABASE_URL` and direct build-time access in `DATABASE_URL_UNPOOLED`
- the app also supports `PGHOST`, `PGHOST_UNPOOLED`, `PGUSER`, `PGDATABASE`, and `PGPASSWORD` as an alternative database config path

## Deployment

### Vercel

1. Import the repo into Vercel.
2. Add the environment variables from `.env.example`.
3. Use a real Postgres database.
4. Deploy.

Relevant routes:
- site root: `/`
- API base: `/api/`
- health check: `/health/`

Implementation notes:
- Vercel entrypoint: `api/index.py`
- Python build hook: `pyproject.toml` -> `build.py`
- Vercel config: `vercel.json`
- the build runs migrations and seeds bundled questions during deploy
- the mobile app should point to the backend with `EXPO_PUBLIC_API_BASE_URL=https://your-domain/api`

## Product rough edges still being cleaned up

- backend views are too centralized
- mobile and backend contracts need another cleanup pass
- repo still has some prototype-era leftovers being removed
- web and mobile experience are not fully aligned yet

## Next cleanup priorities

1. remove tracked dependency junk from git history going forward
2. split oversized backend modules
3. tighten mobile auth and match-state UX
4. unify the product language across web, mobile, and docs
