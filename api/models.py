from django.db import models
from django.contrib.auth.models import User

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)

    anilist_username = models.CharField(max_length=100, blank=True, null=True)
    anilist_access_token = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return self.user.username

class Media(models.Model):
    # Define constants for the media type
    ANIME = 'ANIME'
    MOVIE = 'MOVIE'
    BOOK = 'BOOK'
    GAME = 'GAME'
    TV_SHOW = 'TV'
    MEDIA_TYPE_CHOICES = [
        (ANIME, 'Anime'),
        (MOVIE, 'Movie'),
        (BOOK, 'Book'),
        (GAME, 'Game'),
        (TV_SHOW, 'TV Show'),
    ]

    media_type = models.CharField(max_length=7, choices=MEDIA_TYPE_CHOICES)
    
    # Core information
    primary_title = models.CharField(max_length=255)
    # An optional secondary title (e.g., Romaji name, original title, subtitle).
    secondary_title = models.CharField(max_length=255, blank=True, null=True)
    
    description = models.TextField(blank=True, null=True)
    cover_image_url = models.URLField(blank=True, null=True)

    # IDs from external services to prevent duplicates and for syncing
    anilist_id = models.IntegerField(unique=True, blank=True, null=True)
    tmdb_id = models.IntegerField(unique=True, blank=True, null=True)
    # ... add more IDs for other services as needed

    def __str__(self):
        return f"{self.title} ({self.get_media_type_display()})"

class UserMedia(models.Model):
    # Define constants for the user's status
    WATCHING = 'WATCHING'
    COMPLETED = 'COMPLETED'
    PAUSED = 'PAUSED'
    DROPPED = 'DROPPED'
    PLANNED = 'PLANNED'
    STATUS_CHOICES = [
        (WATCHING, 'Watching'),
        (COMPLETED, 'Completed'),
        (PAUSED, 'Paused'),
        (DROPPED, 'Dropped'),
        (PLANNED, 'Planned'),
    ]

    profile = models.ForeignKey(Profile, on_delete=models.CASCADE)
    media = models.ForeignKey(Media, on_delete=models.CASCADE)
    
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, blank=True, null=True)
    score = models.FloatField(blank=True, null=True)
    progress = models.IntegerField(default=0) 
    
    start_date = models.DateField(blank=True, null=True)
    finish_date = models.DateField(blank=True, null=True)
    
    class Meta:
        # A user can only have one entry for each piece of media
        unique_together = ('profile', 'media')

    def __str__(self):
        return f"{self.profile.user.username}'s entry for {self.media.title}"