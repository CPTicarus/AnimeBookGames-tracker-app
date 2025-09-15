from django.urls import path
from .views import AnimeSearchAPIView, AniListLoginView, AniListCallbackView, UserAnimeListView


urlpatterns = [
    path('search/', AnimeSearchAPIView.as_view(), name='anime-search'),
    
    # New Authentication URLs
    path('auth/login/', AniListLoginView.as_view(), name='anilist-login'),
    path('auth/callback/', AniListCallbackView.as_view(), name='anilist-callback'),

    # New Authenticated URL
    path('user/list/', UserAnimeListView.as_view(), name='user-anime-list'),
]