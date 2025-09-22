from django.urls import path
from .views import MediaSearchView, AniListLoginView, AniListCallbackView, UserMediaListView, csrf_token_view, RegisterView, LoginView, SyncAniListView, UserMediaAddView, UserMediaUpdateView, TMDBLoginView, TMDBCallbackView, SyncTMDBView, StatsView
urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/local-login/', LoginView.as_view(), name='local-login'),
    
    path('csrf/', csrf_token_view, name='csrf-token'),
    path('search/', MediaSearchView.as_view(), name='media-search'),
    path('user/list/', UserMediaListView.as_view(), name='user-media-list'),
    path('sync/anilist/', SyncAniListView.as_view(), name='sync-anilist'),
    path('list/add/', UserMediaAddView.as_view(), name='user-media-add'), 
    path('list/update/<int:pk>/', UserMediaUpdateView.as_view(), name='user-media-update'),
    path('sync/tmdb/', SyncTMDBView.as_view(), name='sync-tmdb'),
    path('stats/', StatsView.as_view(), name='stats'),
    
    #--------- import list urls ------------
    path('auth/tmdb/login/', TMDBLoginView.as_view(), name='tmdb-login'),
    path('auth/tmdb/callback/', TMDBCallbackView.as_view(), name='tmdb-callback'),
    path('auth/login/', AniListLoginView.as_view(), name='anilist-login'),
    path('auth/callback/', AniListCallbackView.as_view(), name='anilist-callback'),
]