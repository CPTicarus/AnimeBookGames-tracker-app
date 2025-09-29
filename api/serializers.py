from rest_framework import serializers
from .models import Media, UserMedia, Profile
from .models import CustomList, CustomListEntry

class MediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Media
        fields = ['id', 'primary_title', 'secondary_title', 'description', 'cover_image_url', 'media_type', 'anilist_id']
        
class UserMediaSerializer(serializers.ModelSerializer):
    # We include a nested serializer to show the full media details
    media = MediaSerializer(read_only=True)

    class Meta:
        model = UserMedia
        fields = ['id', 'media', 'status', 'score', 'progress']

class ProfileOptionsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["keep_local_on_sync", "dark_mode", "keep_user_logged_in", "use_steam_or_rawg"]
        
class CustomListEntrySerializer(serializers.ModelSerializer):
    user_media = UserMediaSerializer(read_only=True)

    class Meta:
        model = CustomListEntry
        fields = ['id', 'user_media', 'added_at']


class CustomListSerializer(serializers.ModelSerializer):
    entries = CustomListEntrySerializer(many=True, read_only=True)
    class Meta:
        model = CustomList
        fields = ['id', 'name', 'created_at', 'entries']