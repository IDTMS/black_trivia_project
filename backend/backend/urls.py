# backend/urls.py

from django.contrib import admin
from django.urls import path, include
from game.views import black_card_asset, health, home, manifest

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('game.urls')),
    path('assets/blackcard.png', black_card_asset, name='black-card-asset'),
    path('manifest.json', manifest, name='manifest'),
    path('health/', health, name='health'),
    path('', home, name='home'),  # Handle the root path
]
