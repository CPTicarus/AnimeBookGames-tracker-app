from django.urls import path
from .views import MediaSearchView, AniListLoginView, AniListCallbackView, UserMediaListView, csrf_token_view, RegisterView, LoginView, SyncAniListView, UserMediaAddView, UserMediaUpdateView, TMDBLoginView, TMDBCallbackView, SyncTMDBView, StatsView, UserMediaDeleteView, TrendsView, SyncMALView, MALLoginView, MALCallbackView

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/local-login/', LoginView.as_view(), name='local-login'),
    
    path('csrf/', csrf_token_view, name='csrf-token'),
    path('search/', MediaSearchView.as_view(), name='media-search'),
    path('user/list/', UserMediaListView.as_view(), name='user-media-list'),
    path('list/add/', UserMediaAddView.as_view(), name='user-media-add'), 
    path('list/update/<int:pk>/', UserMediaUpdateView.as_view(), name='user-media-update'),
    path('stats/', StatsView.as_view(), name='stats'),
    path("list/delete/<int:pk>/", UserMediaDeleteView.as_view(), name="user_media_delete"),
    path('trends/', TrendsView.as_view(), name='trends'),

    #-------- sync and login to services ---
    path('auth/mal/login/', MALLoginView.as_view(), name='mal-login'),
    path('auth/mal/callback/', MALCallbackView.as_view(), name='mal-callback'),
    path('sync/mal/', SyncMALView.as_view(), name='sync-mal'),

    path('sync/tmdb/', SyncTMDBView.as_view(), name='sync-tmdb'),

    path('sync/anilist/', SyncAniListView.as_view(), name='sync-anilist'),

    #--------- import list urls ------------
    path('auth/tmdb/login/', TMDBLoginView.as_view(), name='tmdb-login'),
    path('auth/tmdb/callback/', TMDBCallbackView.as_view(), name='tmdb-callback'),
    path('auth/login/', AniListLoginView.as_view(), name='anilist-login'),
    path('auth/callback/', AniListCallbackView.as_view(), name='anilist-callback'),
]