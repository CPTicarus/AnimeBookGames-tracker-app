from rest_framework import serializers
from .models import Media, UserMedia

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