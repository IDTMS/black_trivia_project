# Black Trivia Project

This repo is now wired for a Django-on-Vercel deployment using the Python runtime. The React frontend is still incomplete, so the intended production path is the Django app itself serving the mobile-style game shell at `/`.

## Local development

From the repo root:

```bash
cd backend
../venv/bin/python manage.py migrate
../venv/bin/python manage.py seed_questions
../venv/bin/python manage.py runserver
```

The app will be available at `http://127.0.0.1:8000/`.

## Production environment variables

Copy `.env.example` and set real values:

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

`DATABASE_URL` should be treated as required on Vercel. SQLite is still fine for local work, but it is not the right persistence layer for a public site.
If you are using Neon, set `DATABASE_URL` to the pooled connection string for runtime and `DATABASE_URL_UNPOOLED` to the direct connection string for build-time migrations.
If your Neon integration gives you `PGHOST`, `PGHOST_UNPOOLED`, `PGUSER`, `PGDATABASE`, and `PGPASSWORD` instead, the app now supports those directly as an alternative to `DATABASE_URL`.

## Deployment notes

- Health check: `/health/`
- API base path: `/api/`
- Vercel entrypoint: [api/index.py](/Users/marcuslit/Documents/source-code/black_trivia_project/api/index.py)
- Vercel Python build hook: [pyproject.toml](/Users/marcuslit/Documents/source-code/black_trivia_project/pyproject.toml) -> [build.py](/Users/marcuslit/Documents/source-code/black_trivia_project/build.py)
- Vercel config: [vercel.json](/Users/marcuslit/Documents/source-code/black_trivia_project/vercel.json)
- The Vercel build runs migrations and seeds bundled questions during deploy via the Python build hook, and will prefer `DATABASE_URL_UNPOOLED` or `PGHOST_UNPOOLED` if provided.
- The mobile app can point to this backend by setting `EXPO_PUBLIC_API_BASE_URL=https://blackcard.joinhavn.io/api`
- Google sign-in on the web UI needs a Google OAuth Web client ID in `GOOGLE_CLIENT_ID`, with `https://blackcard.joinhavn.io` and `http://127.0.0.1:8000` added as authorized JavaScript origins.

## Vercel

1. Import the repo into Vercel with the project root set to this folder.
2. Add the environment variables from `.env.example`.
3. Use a real Postgres `DATABASE_URL`.
4. Deploy.

After the deploy finishes, Vercel should serve the Django app at the site root and all Django routes through the Python function.
