from django.urls import path
from . import views

urlpatterns = [
    # Frontend UI at root (so visiting / shows the chat page)
    path('', views.chat_view, name='chat_interface'),

    # Backend API
    path('chat/', views.chat_api, name='chat_api'),
]
