from django.db import models
from django.contrib.auth.models import User

class Profile(models.Model):
    """
    Extends the default Django User model with additional fields for external
    service integrations.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE)

    # Fields for AniList integration
    anilist_username = models.CharField(max_length=100, blank=True, null=True)
    anilist_access_token = models.CharField(max_length=255, blank=True, null=True)
    
    # Fields for TMDB integration
    tmdb_account_id = models.CharField(max_length=100, blank=True, null=True)
    tmdb_session_id = models.CharField(max_length=255, blank=True, null=True)

    # Fields for MyAnimeList (MAL) integration
    mal_username = models.CharField(max_length=100, blank=True, null=True)
    mal_access_token = models.TextField(blank=True, null=True)
    mal_refresh_token = models.TextField(blank=True, null=True)

    # Options
    keep_local_on_sync = models.BooleanField(default=True)

    def __str__(self):
        return self.user.username

class Media(models.Model):
    """
    Represents a single media item (e.g., a movie, anime, or book).
    Stores core data and unique IDs from external APIs.
    """
    # Define constants for the media type
    ANIME = 'ANIME'
    MOVIE = 'MOVIE'
    BOOK = 'BOOK'
    GAME = 'GAME'
    TV_SHOW = 'TV_SHOW'
    MANGA = 'MANGA'
    
    MEDIA_TYPE_CHOICES = [
        (ANIME, 'Anime'),
        (MOVIE, 'Movie'),
        (BOOK, 'Book'),
        (GAME, 'Game'),
        (TV_SHOW, 'TV Show'),
        (MANGA, 'Manga'),
    ]

    media_type = models.CharField(max_length=7, choices=MEDIA_TYPE_CHOICES)
    
    # Core information fields
    primary_title = models.CharField(max_length=255)
    secondary_title = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    cover_image_url = models.URLField(blank=True, null=True)
    length = models.IntegerField(null=True, blank=True)
    
    # IDs from external services used for syncing and preventing duplicates
    anilist_id = models.IntegerField(unique=True, blank=True, null=True)
    tmdb_id = models.IntegerField(blank=True, null=True) 
    rawg_id = models.IntegerField(unique=True, blank=True, null=True)
    google_book_id = models.CharField(unique=True, blank=True, null=True)
    mal_id = models.IntegerField(unique=True, blank=True, null=True)

    def __str__(self):
        return f"{self.primary_title} ({self.get_media_type_display()})"

    class Meta:
        # Prevents duplicate entries for TMDB and Google Books, which have separate IDs for different media types.
        unique_together = [['tmdb_id', 'media_type'], ['google_book_id', 'media_type']]

class UserMedia(models.Model):
    """
    A through model that links a user's profile to a Media item, storing
    personal data about a user's progress and ratings.
    """
    # Define constants for the user's status
    IN_PROGRESS = 'IN_PROGRESS'
    COMPLETED = 'COMPLETED'
    PAUSED = 'PAUSED'
    DROPPED = 'DROPPED'
    PLANNED = 'PLANNED'
    
    STATUS_CHOICES = [
        (IN_PROGRESS, 'In Progress'),
        (COMPLETED, 'Completed'),
        (PAUSED, 'Paused'),
        (DROPPED, 'Dropped'),
        (PLANNED, 'Planned'),
    ]

    profile = models.ForeignKey(Profile, on_delete=models.CASCADE)
    media = models.ForeignKey(Media, on_delete=models.CASCADE)
    
    status = models.CharField(max_length=11, choices=STATUS_CHOICES, blank=True, null=True)
    score = models.FloatField(blank=True, null=True)
    progress = models.IntegerField(default=0) 
    
    start_date = models.DateField(blank=True, null=True)
    finish_date = models.DateField(blank=True, null=True)
    
    class Meta:
        # Ensures that a user can have only one entry for any given media item.
        unique_together = ('profile', 'media')

    def __str__(self):
        display_title = self.media.primary_title or self.media.secondary_title or "Untitled"
        return f"{self.profile.user.username}'s entry for {display_title}"
    
class TMDBRequestToken(models.Model):
    """
    A temporary model to store TMDB OAuth request tokens during the
    authentication flow.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

class MALAuthRequest(models.Model):
    """
    A temporary model for MyAnimeList's PKCE OAuth flow, storing the
    `code_verifier` linked to a session `state`.
    """
    state = models.CharField(max_length=255, unique=True)
    code_verifier = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)