from django.urls import path
from .views import (
    MediaSearchView, AniListLoginView, AniListCallbackView, UserMediaListView,
    csrf_token_view, mal_status,
    RegisterView, LoginView, SyncAniListView, UserMediaAddView,
    UserMediaUpdateView, TMDBLoginView, TMDBCallbackView, SyncTMDBView, 
    StatsView, UserMediaDeleteView, TrendsView, SyncMALView,
    MALLoginView, MALCallbackView, ProfileOptionsView,
)

urlpatterns = [
    # ----------------------------------------
    # User Authentication & Authorization
    # ----------------------------------------
    
    # Local Authentication
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/local-login/', LoginView.as_view(), name='local-login'),
    
    # AniList Authentication
    path('auth/login/', AniListLoginView.as_view(), name='anilist-login'),
    path('auth/callback/', AniListCallbackView.as_view(), name='anilist-callback'),
    
    # MyAnimeList (MAL) Authentication
    path('auth/mal/login/', MALLoginView.as_view(), name='mal-login'),
    path('auth/mal/callback/', MALCallbackView.as_view(), name='mal-callback'),
    path("auth/mal/status/", mal_status, name="mal-status"),

    # The Movie Database (TMDB) Authentication
    path('auth/tmdb/login/', TMDBLoginView.as_view(), name='tmdb-login'),
    path('auth/tmdb/callback/', TMDBCallbackView.as_view(), name='tmdb-callback'),

    # ----------------------------------------
    # User Media & Data Management
    # ----------------------------------------

    # User Media List
    path('user/list/', UserMediaListView.as_view(), name='user-media-list'),
    path('list/add/', UserMediaAddView.as_view(), name='user-media-add'), 
    path('list/update/<int:pk>/', UserMediaUpdateView.as_view(), name='user-media-update'),
    path("list/delete/<int:pk>/", UserMediaDeleteView.as_view(), name="user_media_delete"),
    path('stats/', StatsView.as_view(), name='stats'),
    path("options/", ProfileOptionsView.as_view(), name="profile-options"),

    # ----------------------------------------
    # Third-Party Data Synchronization
    # ----------------------------------------

    path('sync/anilist/', SyncAniListView.as_view(), name='sync-anilist'),
    path('sync/mal/', SyncMALView.as_view(), name='sync-mal'),
    path('sync/tmdb/', SyncTMDBView.as_view(), name='sync-tmdb'),

    # ----------------------------------------
    # General & Utility
    # ----------------------------------------

    path('search/', MediaSearchView.as_view(), name='media-search'),
    path('trends/', TrendsView.as_view(), name='trends'),
    path('csrf/', csrf_token_view, name='csrf-token'),
]