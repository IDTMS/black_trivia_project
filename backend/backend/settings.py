# backend/settings.py

import os
from pathlib import Path
from datetime import timedelta
from urllib.parse import parse_qs, unquote, urlparse

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def env_list(name, default=''):
    raw_value = os.getenv(name, default)
    return [item.strip() for item in raw_value.split(',') if item.strip()]


def postgres_env_config():
    pg_host = os.getenv('PGHOST')
    pg_host_unpooled = os.getenv('PGHOST_UNPOOLED')
    pg_name = os.getenv('PGDATABASE')
    pg_user = os.getenv('PGUSER')
    pg_password = os.getenv('PGPASSWORD')

    if not all([pg_host, pg_name, pg_user, pg_password]):
        return None

    # Prefer the direct Neon host on Vercel unless explicitly disabled.
    if env_bool('VERCEL', False) and env_bool('PG_USE_UNPOOLED_RUNTIME', True) and pg_host_unpooled:
        pg_host = pg_host_unpooled

    conn_max_age_default = '0' if env_bool('VERCEL', False) else '60'

    config = {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': pg_name,
        'USER': pg_user,
        'PASSWORD': pg_password,
        'HOST': pg_host,
        'PORT': os.getenv('PGPORT', '5432'),
        'CONN_MAX_AGE': int(os.getenv('DB_CONN_MAX_AGE', conn_max_age_default)),
    }

    options = {}
    ssl_mode = os.getenv('PGSSLMODE') or os.getenv('DB_SSLMODE')
    if ssl_mode:
        options['sslmode'] = ssl_mode
    channel_binding = os.getenv('PGCHANNELBINDING')
    if channel_binding:
        options['channel_binding'] = channel_binding
    if options:
        config['OPTIONS'] = options

    return config


def database_config():
    database_url = os.getenv('DATABASE_URL')
    postgres_config = postgres_env_config()
    if env_bool('VERCEL', False) and not database_url and not postgres_config:
        raise RuntimeError('DATABASE_URL or PG* database environment variables must be set for Vercel deployments.')

    if postgres_config:
        return postgres_config

    if not database_url:
        return {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }

    parsed = urlparse(database_url)
    scheme = parsed.scheme.split('+', 1)[0]

    if scheme in {'postgres', 'postgresql'}:
        config = {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': parsed.path.lstrip('/'),
            'USER': unquote(parsed.username or ''),
            'PASSWORD': unquote(parsed.password or ''),
            'HOST': parsed.hostname or '',
            'PORT': str(parsed.port or ''),
            'CONN_MAX_AGE': int(os.getenv('DB_CONN_MAX_AGE', '60')),
        }
        query_options = {
            key: values[-1]
            for key, values in parse_qs(parsed.query).items()
            if values
        }
        if query_options:
            config['OPTIONS'] = query_options
        ssl_mode = os.getenv('DB_SSLMODE')
        if ssl_mode:
            config.setdefault('OPTIONS', {})['sslmode'] = ssl_mode
        return config

    if scheme == 'sqlite':
        db_path = unquote(parsed.path or '')
        if not db_path or db_path == '/:memory:':
            db_name = ':memory:'
        else:
            db_name = Path(db_path) if db_path.startswith('/') else BASE_DIR / db_path
        return {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': db_name,
        }

    raise ValueError(f'Unsupported DATABASE_URL scheme: {scheme}')


DEFAULT_DEBUG = not env_bool('VERCEL', False)
DEBUG = env_bool('DJANGO_DEBUG', DEFAULT_DEBUG)

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'dev-secret-key-change-me')
if not DEBUG and SECRET_KEY == 'dev-secret-key-change-me':
    raise RuntimeError('DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is false.')

default_allowed_hosts = {'localhost', '127.0.0.1', 'testserver', '.vercel.app'}
vercel_url = os.getenv('VERCEL_URL')
if vercel_url:
    default_allowed_hosts.add(vercel_url)
ALLOWED_HOSTS = sorted(default_allowed_hosts.union(env_list('DJANGO_ALLOWED_HOSTS')))

# Application definition

INSTALLED_APPS = [
    # Django default apps
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'corsheaders',

    # Your apps
    'game.apps.GameConfig',  # Use the AppConfig class for the 'game' app
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'backend.runtime_bootstrap.RuntimeBootstrapMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / "templates"],  # Global templates directory
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'
ASGI_APPLICATION = 'backend.asgi.application'

# Database
# https://docs.djangoproject.com/en/4.0/ref/settings/#databases

DATABASES = {
    'default': database_config(),
}

# Password validation
# https://docs.djangoproject.com/en/4.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    # Add more validators as needed
]

# Internationalization
# https://docs.djangoproject.com/en/4.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'  # Adjust as needed

USE_I18N = True

USE_TZ = True

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.0/howto/static-files/

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Custom User Model
AUTH_USER_MODEL = 'game.User'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

cors_allowed_origins = env_list('CORS_ALLOWED_ORIGINS')
CORS_ALLOW_ALL_ORIGINS = DEBUG and not cors_allowed_origins
CORS_ALLOWED_ORIGINS = cors_allowed_origins
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS')

# Simple JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    # Add more configurations as needed
}

USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

FORCE_HTTPS = env_bool('FORCE_HTTPS', False)
SECURE_SSL_REDIRECT = FORCE_HTTPS
SESSION_COOKIE_SECURE = FORCE_HTTPS
CSRF_COOKIE_SECURE = FORCE_HTTPS
SECURE_CROSS_ORIGIN_OPENER_POLICY = os.getenv(
    'SECURE_CROSS_ORIGIN_OPENER_POLICY',
    'same-origin-allow-popups',
)
SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '0')) if FORCE_HTTPS else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', FORCE_HTTPS)
SECURE_HSTS_PRELOAD = env_bool('SECURE_HSTS_PRELOAD', FORCE_HTTPS)
