# pegpo/urls.py
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # Root UI (so http://127.0.0.1:8000/ serves your chat)
    path("", include("ui.urls")),

    # API namespace (keeps /api/... working)
    path("api/", include("ui.urls")),

    path("admin/", admin.site.urls),
]
