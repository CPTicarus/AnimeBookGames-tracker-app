from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication, SessionAuthentication 

from .services import anilist_service, tmdb_service
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
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', None)
        if not query:
            return Response({"error": "Query parameter 'q' is required."}, status=status.HTTP_400_BAD_REQUEST)

        combined_results = []
        anilist_object = None

        # 1. Always search AniList first.
        try:
            anilist_raw_results = anilist_service.search_anime(query)
            if anilist_raw_results and anilist_raw_results.get('Media'):
                media_data = anilist_raw_results['Media']
                
                # Cache the result in our database
                anilist_object, _ = Media.objects.update_or_create(
                    anilist_id=media_data['id'],
                    defaults={
                        'primary_title': media_data['title']['romaji'],
                        'secondary_title': media_data['title']['english'],
                        'media_type': Media.ANIME,
                        'cover_image_url': media_data['coverImage']['large'],
                    }
                )

                query_lower = query.lower()
                romaji_lower = (media_data['title'].get('romaji') or '').lower()
                english_lower = (media_data['title'].get('english') or '').lower()

                if query_lower == romaji_lower or query_lower == english_lower:
                    # If it's an exact match, this is the only result we need.
                    serializer = MediaSerializer([anilist_object], many=True)
                    return Response(serializer.data, status=status.HTTP_200_OK)
                
                # If not an exact match, add it to our list and search TMDB as well.
                combined_results.append(anilist_object)

        except Exception as e:
            print(f"AniList search failed for query '{query}': {e}")

        # 2. If it wasn't an exact match on AniList, search TMDB.
        try:
            # Search TMDB for Movies
            movie_results = tmdb_service.search_movies(query)
            if movie_results:
                for movie in movie_results[:5]:
                    if not movie.get('poster_path'): continue
                    media_obj, _ = Media.objects.update_or_create(
                        tmdb_id=movie['id'], media_type=Media.MOVIE,
                        defaults={
                            'primary_title': movie['title'], 'secondary_title': movie.get('original_title'),
                            'cover_image_url': f"https://image.tmdb.org/t/p/w500{movie['poster_path']}", 'description': movie.get('overview'),
                        }
                    )
                    combined_results.append(media_obj)

            # Search TMDB for TV Shows
            tv_show_results = tmdb_service.search_tv_shows(query)
            if tv_show_results:
                for show in tv_show_results[:5]:
                    if not show.get('poster_path'): continue
                    media_obj, _ = Media.objects.update_or_create(
                        tmdb_id=show['id'], media_type=Media.TV_SHOW,
                        defaults={
                            'primary_title': show['name'], 'secondary_title': show.get('original_name'),
                            'cover_image_url': f"https://image.tmdb.org/t/p/w500{show['poster_path']}", 'description': show.get('overview'),
                        }
                    )
                    combined_results.append(media_obj)
            
            serializer = MediaSerializer(combined_results, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": "An error occurred during TMDB search", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserMediaAddView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        media_id = request.data.get('media_id')
        if not media_id:
            return Response({"error": "media_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            media_item = Media.objects.get(id=media_id)
            profile = request.user.profile

            # Use get_or_create to avoid adding duplicates
            user_media_item, created = UserMedia.objects.get_or_create(
                profile=profile,
                media=media_item,
                defaults={'status': 'PLANNED'} # Default to 'Planned' status
            )

            if created:
                return Response({"success": f"'{media_item.primary_title}' added to your list."}, status=status.HTTP_201_CREATED)
            else:
                return Response({"message": f"'{media_item.primary_title}' is already in your list."}, status=status.HTTP_200_OK)

        except Media.DoesNotExist:
            return Response({"error": "Media not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": "An error occurred.", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class UserMediaListView(APIView):
    # Tell this view to use TokenAuthentication instead of SessionAuthentication
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        user_media_list = UserMedia.objects.filter(profile=user_profile).order_by('-score')
        serializer = UserMediaSerializer(user_media_list, many=True)
        return Response(serializer.data)

class AniListLoginView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # The user is already authenticated by the classes above.
        # We can get their token directly.
        try:
            token = Token.objects.get(user=request.user)
        except Token.DoesNotExist:
            return Response({"error": "Invalid token for user."}, status=status.HTTP_401_UNAUTHORIZED)

        # Construct the URL with the user's app token as the 'state' parameter
        auth_url = (
            f'https://anilist.co/api/v2/oauth/authorize'
            f'?client_id={settings.ANILIST_CLIENT_ID}'
            f'&response_type=code'
            f'&state={token.key}' # Use the token key as the state
        )
        return Response({"auth_url": auth_url}, status=status.HTTP_200_OK)
    
@method_decorator(csrf_exempt, name='dispatch')
class AniListCallbackView(APIView):
    # This view is now public, its security comes from the 'state' parameter
    authentication_classes = []
    permission_classes = []
    renderer_classes = [JSONRenderer]

    def get(self, request):
        auth_code = request.query_params.get('code')
        # Get the 'state' parameter back from AniList
        app_token_key = request.query_params.get('state')

        if not auth_code or not app_token_key:
            return Response({"error": "Auth code or state missing."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            # Use the app token from 'state' to find the user
            token_obj = Token.objects.get(key=app_token_key)
            user = token_obj.user
            profile = user.profile

            # Exchange AniList code for an AniList token
            anilist_token_data = anilist_service.exchange_code_for_token(auth_code)
            access_token = anilist_token_data['access_token']

            anilist_profile = anilist_service.get_viewer_profile(access_token)
            anilist_username = anilist_profile['name']

            # Update the user's profile with their AniList info
            profile.anilist_username = anilist_username
            profile.anilist_access_token = access_token
            profile.save()

            return Response({
                "success": f"Successfully linked AniList account '{anilist_username}'!",
            }, status=status.HTTP_200_OK)
        except Token.DoesNotExist:
            return Response({"error": "Invalid state token. Authentication failed."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": "Authentication failed", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SyncAniListView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        if not profile.anilist_access_token:
            return Response({"error": "AniList account not linked."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Fetch the full list from the service
            full_list = anilist_service.fetch_full_user_list(profile.anilist_access_token)

            # Process the list and save to the database
            for entry in full_list:
                media_data = entry['media']

                # Get or create the Media item (cache it)
                media_obj, _ = Media.objects.update_or_create(
                    anilist_id=media_data['id'],
                    defaults={
                        # Use the new generic field names
                        'primary_title': media_data['title']['romaji'],
                        'secondary_title': media_data['title']['english'],
                        'media_type': Media.ANIME,
                        'cover_image_url': media_data['coverImage']['large'],
                    }
                )

                # Create or update the user's personal tracking info for this media
                UserMedia.objects.update_or_create(
                    profile=profile,
                    media=media_obj,
                    defaults={
                        'status': entry['status'],
                        'score': entry['score'],
                        'progress': entry['progress'],
                    }
                )

            return Response({"success": f"Sync complete. Processed {len(full_list)} items."}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": "An error occurred during sync", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)