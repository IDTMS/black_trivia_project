import os
from pathlib import Path

from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.shortcuts import render

from game.models import Question

from .api import reset_expired_black_cards

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BLACK_CARD_IMAGE_PATH = PROJECT_ROOT / 'blackcard.png'


def home(request):
    reset_expired_black_cards()
    return render(request, 'games/home.html', {
        'google_client_id': os.getenv('GOOGLE_CLIENT_ID', ''),
        'question_count': Question.objects.count(),
    })


def health(request):
    return JsonResponse({'status': 'ok'})


def service_worker(request):
    sw_content = """
'use strict';

const CACHE_NAME = 'blackcard-v2';
const PRECACHE_URLS = ['/', '/assets/blackcard.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/')) return;
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetched = fetch(event.request).then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached);
            return cached || fetched;
        })
    );
});

self.addEventListener('push', (event) => {
    let data = { title: 'Black Card', body: 'Something happened in your match.' };
    try { data = event.data.json(); } catch (e) {}
    event.waitUntil(
        self.registration.showNotification(data.title || 'Black Card', {
            body: data.body || '',
            icon: '/assets/blackcard.png',
            badge: '/assets/blackcard.png',
            vibrate: [100, 50, 100],
            data: data.url ? { url: data.url } : {},
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
    event.waitUntil(clients.openWindow(url));
});
"""
    return HttpResponse(sw_content.strip(), content_type='application/javascript')


def manifest(request):
    data = {
        'name': 'Black Card',
        'short_name': 'Black Card',
        'description': '1v1 Culture Trivia — Prove your blackness or lose your card.',
        'start_url': '/',
        'id': '/',
        'scope': '/',
        'display': 'standalone',
        'orientation': 'portrait',
        'background_color': '#030303',
        'theme_color': '#0b0b0b',
        'icons': [
            {
                'src': '/assets/blackcard.png',
                'sizes': '1008x1024',
                'type': 'image/png',
                'purpose': 'any',
            }
        ],
    }
    return JsonResponse(data, content_type='application/manifest+json')


def black_card_asset(request):
    if not BLACK_CARD_IMAGE_PATH.exists():
        raise Http404('Black card image not found.')
    return FileResponse(BLACK_CARD_IMAGE_PATH.open('rb'), content_type='image/png')


def dashboard(request):
    return render(request, 'games/dashboard.html')
