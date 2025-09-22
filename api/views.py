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
from rest_framework.authentication import TokenAuthentication
from difflib import SequenceMatcher
import concurrent.futures

from .services import anilist_service, tmdb_service
from .models import Media, Profile, UserMedia, TMDBRequestToken 
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

class UserMediaUpdateView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            # Find the specific item in the user's list
            user_media_item = UserMedia.objects.get(pk=pk, profile=request.user.profile)
        except UserMedia.DoesNotExist:
            return Response({"error": "Item not found in your list."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data

        # Update fields if they are provided in the request
        if 'status' in data:
            user_media_item.status = data['status']
        if 'score' in data:
            # Allow clearing the score
            score = data['score']
            user_media_item.score = float(score) if score is not None and score != '' else None
        if 'progress' in data:
            user_media_item.progress = int(data['progress']) if data['progress'] is not None and data['progress'] != '' else 0

        user_media_item.save()

        # Return the updated item
        serializer = UserMediaSerializer(user_media_item)
        return Response(serializer.data, status=status.HTTP_200_OK)

class MediaSearchView(APIView): 
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', None)
        if not query:
            return Response([])

        results = []
        with concurrent.futures.ThreadPoolExecutor() as executor:
            anilist_future = executor.submit(anilist_service.search_anime, query)
            movies_future = executor.submit(tmdb_service.search_movies, query)
            tv_shows_future = executor.submit(tmdb_service.search_tv_shows, query)

            anilist_data = anilist_future.result()
            movie_data = movies_future.result()
            tv_data = tv_shows_future.result()

        if anilist_data:
            for item in anilist_data:
                results.append({
                    "api_source": "ANILIST", "api_id": item['id'], "primary_title": item['title']['romaji'],
                    "secondary_title": item['title']['english'], "media_type": "ANIME",
                    "cover_image_url": item['coverImage']['large']
                })
        
        if movie_data:
            for item in movie_data:
                if not item.get('poster_path'): continue
                results.append({
                    "api_source": "TMDB", "api_id": item['id'], "primary_title": item['title'],
                    "secondary_title": item.get('original_title'), "media_type": "MOVIE",
                    "cover_image_url": f"https://image.tmdb.org/t/p/w500{item['poster_path']}"
                })
        
        if tv_data:
            for item in tv_data:
                if not item.get('poster_path'): continue
                results.append({
                    "api_source": "TMDB", "api_id": item['id'], "primary_title": item['name'],
                    "secondary_title": item.get('original_name'), "media_type": "TV_SHOW",
                    "cover_image_url": f"https://image.tmdb.org/t/p/w500{item['poster_path']}"
                })
                
        for item in anilist_data:
            results.append({
                "api_source": "ANILIST", "api_id": item['id'], "primary_title": item['title']['romaji'],
                "secondary_title": item['title']['english'], "media_type": "ANIME",
                "cover_image_url": item['coverImage']['large']
            })
        for item in movie_data:
            if not item.get('poster_path'): continue
            results.append({
                "api_source": "TMDB", "api_id": item['id'], "primary_title": item['title'],
                "secondary_title": item.get('original_title'), "media_type": "MOVIE",
                "cover_image_url": f"https://image.tmdb.org/t/p/w500{item['poster_path']}"
            })
        for item in tv_data:
            if not item.get('poster_path'): continue
            results.append({
                "api_source": "TMDB", "api_id": item['id'], "primary_title": item['name'],
                "secondary_title": item.get('original_name'), "media_type": "TV_SHOW",
                "cover_image_url": f"https://image.tmdb.org/t/p/w500{item['poster_path']}"
            })
        return Response(results)

class UserMediaAddView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        api_source = data.get('api_source')
        api_id = data.get('api_id')

        if not api_source or not api_id:
            return Response({"error": "api_source and api_id are required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            defaults = {
                'primary_title': data.get('primary_title'), 'secondary_title': data.get('secondary_title'),
                'cover_image_url': data.get('cover_image_url'), 'description': data.get('description'),
            }
            if api_source == 'ANILIST':
                media_obj, _ = Media.objects.update_or_create(anilist_id=api_id, media_type=Media.ANIME, defaults=defaults)
            elif api_source == 'TMDB':
                media_obj, _ = Media.objects.update_or_create(tmdb_id=api_id, media_type=data.get('media_type'), defaults=defaults)
            else:
                return Response({"error": "Invalid api_source"}, status=status.HTTP_400_BAD_REQUEST)

            profile = request.user.profile
            user_media_item, created = UserMedia.objects.get_or_create(profile=profile, media=media_obj, defaults={'status': 'PLANNED'})

            if created:
                return Response({"success": f"'{media_obj.primary_title}' added to your list."}, status=status.HTTP_201_CREATED)
            else:
                return Response({"message": f"'{media_obj.primary_title}' is already in your list."}, status=status.HTTP_200_OK)
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

#------------ for imorting lists --------------
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

class TMDBLoginView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            request_token = tmdb_service.create_request_token()

            TMDBRequestToken.objects.create(user=request.user, token=request_token)

            auth_url = f"https://www.themoviedb.org/authenticate/{request_token}?redirect_to={settings.TMDB_REDIRECT_URI}"

            return Response({"auth_url": auth_url})
        except Exception as e:
            # THIS WILL PRINT THE REAL ERROR TO YOUR DJANGO TERMINAL
            print("!!! TMDB AUTH FAILED:", e) 
            return Response({"error": "Failed to initiate TMDB auth", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class TMDBCallbackView(APIView):
    def get(self, request):
        approved_token = request.query_params.get('request_token')
        if not approved_token:
            return Response({"error": "Request token not found in callback."})

        try:
            # Find the user by looking up the token in our database
            token_entry = TMDBRequestToken.objects.get(token=approved_token)
            user = token_entry.user
            profile = user.profile

            session_id = tmdb_service.create_session_id(approved_token)

            profile.tmdb_session_id = session_id
            profile.save()

            # Clean up the temporary token from the database
            token_entry.delete()

            return Response({"success": "TMDB account successfully linked!"})
        except TMDBRequestToken.DoesNotExist:
            return Response({"error": "Invalid or expired request token. Please try again."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": "Failed to create TMDB session", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
#-------------------------------------------------

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
        
class SyncTMDBView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        if not profile.tmdb_session_id:
            return Response({"error": "TMDB account not linked."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            account_details = tmdb_service.get_account_details(profile.tmdb_session_id)
            account_id = account_details['id']
            profile.tmdb_account_id = account_id
            profile.save()

            movie_watchlist = tmdb_service.get_movie_watchlist(account_id, profile.tmdb_session_id)
            tv_watchlist = tmdb_service.get_tv_watchlist(account_id, profile.tmdb_session_id)
            rated_movies = tmdb_service.get_rated_movies(account_id, profile.tmdb_session_id)
            rated_tv = tmdb_service.get_rated_tv(account_id, profile.tmdb_session_id)

            processed_items = {}

            for item in movie_watchlist + tv_watchlist:
                item_type = Media.MOVIE if 'title' in item else Media.TV_SHOW
                processed_items[item['id']] = {'data': item, 'type': item_type, 'status': 'PLANNED', 'score': None}

            for item in rated_movies + rated_tv:
                item_type = Media.MOVIE if 'title' in item else Media.TV_SHOW
                processed_items[item['id']] = {'data': item, 'type': item_type, 'status': 'COMPLETED', 'score': item.get('rating')}

            # --- KEY CHANGE IS IN THIS LOOP ---
            items_processed_count = 0
            for tmdb_id, item_info in processed_items.items():
                item_data = item_info['data']
                item_type = item_info['type']
                
                # Safely skip any item that doesn't have a poster image
                if not item_data.get('poster_path'):
                    continue

                defaults = {
                    'primary_title': item_data.get('title') or item_data.get('name'),
                    'secondary_title': item_data.get('original_title') or item_data.get('original_name'),
                    'cover_image_url': f"https://image.tmdb.org/t/p/w500{item_data.get('poster_path')}",
                    'description': item_data.get('overview'),
                }
                media_obj, _ = Media.objects.update_or_create(
                    tmdb_id=tmdb_id, media_type=item_type, defaults=defaults
                )

                UserMedia.objects.update_or_create(
                    profile=profile, media=media_obj,
                    defaults={
                        'status': item_info['status'],
                        'score': item_info['score'],
                        'progress': 0, 
                    }
                )
                items_processed_count += 1
            
            return Response({"success": f"Sync complete. Processed {items_processed_count} items."}, status=status.HTTP_200_OK)
        except Exception as e:
            print("!!! TMDB SYNC FAILED:", e)
            return Response({"error": "An error occurred during TMDB sync", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)