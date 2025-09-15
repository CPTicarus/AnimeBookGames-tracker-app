from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.shortcuts import redirect
from django.http import JsonResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication

from . import anilist_service
from .models import Media, Profile, UserMedia
from .serializers import MediaSerializer, UserMediaSerializer


def csrf_token_view(request):
    """
    A simple view to ensure the CSRF cookie is set.
    """
    return JsonResponse({"detail": "CSRF cookie set."})

class RegisterView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        if not username or not password:
            return Response({"error": "Username and password are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.create_user(username=username, password=password)
            # Also create the associated profile
            Profile.objects.create(user=user)
            # Create a token for the new user
            token, _ = Token.objects.get_or_create(user=user)
            return Response({"success": "User created successfully", "token": token.key}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

# ADD THIS NEW VIEW FOR LOCAL LOGIN
class LoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)

        if user:
            token, _ = Token.objects.get_or_create(user=user)
            return Response({"token": token.key}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid Credentials"}, status=status.HTTP_400_BAD_REQUEST)

class MediaSearchView(APIView):
    """
    Searches for media. Implements caching logic.
    """
    def get(self, request):
        query = request.query_params.get('q', None)
        if not query:
            return Response({"error": "Query parameter 'q' is required."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. First, try to find the media in our local database (the cache)
        # Note: This is a very simple search. A real app would use a more robust search tool.
        local_results = Media.objects.filter(title__icontains=query, media_type=Media.ANIME)
        if local_results.exists():
            serializer = MediaSerializer(local_results, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # 2. If not in our DB, fetch from AniList
        try:
            anilist_data = anilist_service.search_anime(query)
            media_data = anilist_data.get('Media')

            if not media_data:
                return Response({"message": "Not found on AniList"}, status=status.HTTP_404_NOT_FOUND)

            # 3. Save the result to our database to cache it for next time
            media_obj, created = Media.objects.get_or_create(
                anilist_id=media_data['id'],
                defaults={
                    'title': media_data['title']['romaji'],
                    'media_type': Media.ANIME,
                    'cover_image_url': media_data['coverImage']['large'],
                }
            )
            
            serializer = MediaSerializer(media_obj)
            return Response([serializer.data], status=status.HTTP_200_OK) # Return as a list
        except Exception as e:
            return Response({"error": "An error occurred", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AniListLoginView(APIView):
    """
    This view doesn't need to change. Its only job is to redirect.
    """
    def get(self, request):
        auth_url = (
            f'https://anilist.co/api/v2/oauth/authorize'
            f'?client_id={settings.ANILIST_CLIENT_ID}'
            f'&response_type=code'
        )
        return redirect(auth_url)


class AniListCallbackView(APIView):
    renderer_classes = [JSONRenderer]
    def get(self, request):
        auth_code = request.query_params.get('code')
        if not auth_code:
            return Response({"error": "Auth code missing."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            # ... (code to get anilist_profile is the same)
            anilist_token_data = anilist_service.exchange_code_for_token(auth_code)
            access_token = anilist_token_data['access_token']
            anilist_profile = anilist_service.get_viewer_profile(access_token)
            anilist_username = anilist_profile['name']

            user, created = User.objects.get_or_create(username=anilist_username)
            if created:
                Profile.objects.create(user=user, anilist_username=anilist_username)

            # --- THIS IS THE KEY CHANGE ---
            # Instead of logging into a session, create or get a DRF token for this user
            token, _ = Token.objects.get_or_create(user=user)

            return Response({
                "success": "Successfully authenticated!",
                "token": token.key, # Return our app's token
                "username": user.username,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": "Authentication failed", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserMediaListView(APIView):
    # Tell this view to use TokenAuthentication instead of SessionAuthentication
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        user_media_list = UserMedia.objects.filter(profile=user_profile)
        serializer = UserMediaSerializer(user_media_list, many=True)
        return Response(serializer.data)