from django.urls import path
from .views import MediaSearchView, AniListLoginView, AniListCallbackView, UserMediaListView, csrf_token_view, RegisterView, LoginView, SyncAniListView

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/local-login/', LoginView.as_view(), name='local-login'),
    
    path('csrf/', csrf_token_view, name='csrf-token'),
    path('search/', MediaSearchView.as_view(), name='media-search'),
    path('auth/login/', AniListLoginView.as_view(), name='anilist-login'),
    path('auth/callback/', AniListCallbackView.as_view(), name='anilist-callback'),
    path('user/list/', UserMediaListView.as_view(), name='user-media-list'),
    path('sync/anilist/', SyncAniListView.as_view(), name='sync-anilist'),
]