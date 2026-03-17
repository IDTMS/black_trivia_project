# backend/urls.py

from django.contrib import admin
from django.urls import path, include
from game.views import health, home  # Import the home view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('game.urls')),
    path('health/', health, name='health'),
    path('', home, name='home'),  # Handle the root path
]
