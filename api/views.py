from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Count
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
import concurrent.futures

from .services import anilist_service, tmdb_service, rawg_service, google_books_service
from .models import Media, Profile, UserMedia, TMDBRequestToken 
from .serializers import UserMediaSerializer


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

class StatsView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        completed_list = UserMedia.objects.filter(profile=profile, status='COMPLETED')

        overall_stats = {
            'total_completed': completed_list.count(),
        }

        per_type_stats = {}
        # --- THIS IS THE KEY CHANGE ---
        # We initialize the dictionary using the constants from the Media model
        # to guarantee the keys are correct.
        time_spent_minutes = {
            'OVERALL': 0,
            Media.ANIME: 0,
            Media.MOVIE: 0,
            Media.TV_SHOW: 0, # Uses 'TV'
            Media.MANGA: 0,
            Media.BOOK: 0,
            Media.GAME: 0,
        }

        for item in completed_list:
            media_type = item.media.media_type
            
            if media_type not in per_type_stats:
                per_type_stats[media_type] = {'total_completed': 0}
            
            per_type_stats[media_type]['total_completed'] += 1

            if media_type == Media.ANIME:
                time_spent_minutes[media_type] += item.progress * 25
            elif media_type == Media.MOVIE:
                time_spent_minutes[media_type] += item.progress * 120
            elif media_type == Media.TV_SHOW: 
                time_spent_minutes[media_type] += item.progress * 45
            elif media_type == Media.GAME:
                time_spent_minutes[media_type] += item.progress * 60
            elif media_type == Media.BOOK:
                time_spent_minutes[media_type] += item.progress * 360
            elif media_type == Media.MANGA:
                time_spent_minutes[media_type] += item.progress * 10
                
        time_spent_minutes['OVERALL'] = sum(time_spent_minutes.values())
        time_spent_hours = {key: round(value / 60, 1) for key, value in time_spent_minutes.items()}

        response_data = {
            'overall': overall_stats,
            'by_type': per_type_stats,
            'time_spent_hours': time_spent_hours,
        }
        
        return Response(response_data)

#------------- media related stuff ------------
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

        sources_str = request.query_params.get('sources', 'ANIME,MANGA,MOVIE,TV_SHOW,GAME,BOOK')
        sources = sources_str.split(',')
        
        results = []
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future_to_source = {}
            
            if 'ANIME' in sources:
                future_to_source[executor.submit(anilist_service.search_anime, query)] = 'ANIME'
            if 'MANGA' in sources:
                future_to_source[executor.submit(anilist_service.search_manga, query)] = 'MANGA'
            if 'MOVIE' in sources:
                future_to_source[executor.submit(tmdb_service.search_movies, query)] = 'MOVIE'
            if 'TV_SHOW' in sources:
                future_to_source[executor.submit(tmdb_service.search_tv_shows, query)] = 'TV_SHOW'
            if 'GAME' in sources:
                future_to_source[executor.submit(rawg_service.search_games, query)] = 'GAME'
            if 'BOOK' in sources:
                future_to_source[executor.submit(google_books_service.search_books, query)] = 'BOOK'

            for future in concurrent.futures.as_completed(future_to_source):
                source_type = future_to_source[future]
                try:
                    data = future.result()
                    
                    if source_type == 'ANIME' or source_type == 'MANGA':
                        for item in data:
                            results.append({
                                "api_source": "ANILIST", "api_id": item['id'],
                                "primary_title": item['title']['romaji'], "secondary_title": item['title']['english'],
                                "media_type": source_type,
                                "cover_image_url": item['coverImage']['large']
                            })
                    elif source_type == 'MOVIE':
                        for item in data:
                            if not item.get('poster_path'): continue
                            results.append({
                                "api_source": "TMDB", "api_id": item['id'], "primary_title": item['title'],
                                "secondary_title": item.get('original_title'), "media_type": "MOVIE",
                                "cover_image_url": f"https://image.tmdb.org/t/p/w500{item['poster_path']}"
                            })
                    elif source_type == 'TV_SHOW':
                        for item in data:
                            if not item.get('poster_path'): continue
                            results.append({
                                "api_source": "TMDB", "api_id": item['id'], "primary_title": item['name'],
                                "secondary_title": item.get('original_name'), "media_type": "TV_SHOW",
                                "cover_image_url": f"https://image.tmdb.org/t/p/w500{item['poster_path']}"
                            })
                    elif source_type == 'GAME':
                        for item in data:
                            if not item.get('background_image'): continue
                            results.append({
                                "api_source": "RAWG", "api_id": item['id'], "primary_title": item['name'],
                                "secondary_title": None, "media_type": "GAME",
                                "cover_image_url": item['background_image']
                            })
                    elif source_type == 'BOOK':
                        for item in data:
                            volume_info = item.get('volumeInfo', {})
                            image_links = volume_info.get('imageLinks', {})
                            if not image_links.get('thumbnail'): continue
                            results.append({
                                "api_source": "GOOGLE", "api_id": item['id'],
                                "primary_title": volume_info.get('title'),
                                "secondary_title": ", ".join(volume_info.get('authors', [])),
                                "media_type": "BOOK",
                                "cover_image_url": image_links.get('thumbnail')
                            })
                except Exception as exc:
                    print(f'{source_type} search generated an exception: {exc}')
        
        return Response(results)

class UserMediaAddView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        media_data = data.get('media') # The full media object will be nested
        if not media_data:
            return Response({"error": "media object is required"}, status=status.HTTP_400_BAD_REQUEST)

        api_source = media_data.get('api_source')
        api_id = media_data.get('api_id')

        if not api_source or not api_id:
            return Response({"error": "api_source and api_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Create/update the main Media entry
            defaults = {
                'primary_title': media_data.get('primary_title'), 
                'secondary_title': media_data.get('secondary_title'),
                'cover_image_url': media_data.get('cover_image_url'), 
                'description': media_data.get('description'),
            }
            if api_source == 'ANILIST':
                media_obj, _ = Media.objects.update_or_create(anilist_id=api_id, media_type=media_data.get('media_type'), defaults=defaults)
            elif api_source == 'TMDB':
                media_obj, _ = Media.objects.update_or_create(tmdb_id=api_id, media_type=media_data.get('media_type'), defaults=defaults)
            elif api_source == 'RAWG':
                media_obj, _ = Media.objects.update_or_create(rawg_id=api_id, media_type=media_data.get('media_type'), defaults=defaults)
            elif api_source == 'GOOGLE':
                 media_obj, _ = Media.objects.update_or_create(google_book_id=api_id, media_type=media_data.get('media_type'), defaults=defaults)
            else:
                return Response({"error": "Invalid api_source"}, status=status.HTTP_400_BAD_REQUEST)


            user_media_defaults = {
                'status': data.get('status', 'PLANNED'),
                'score': data.get('score'),
                'progress': data.get('progress', 0)
            }

            profile = request.user.profile
            user_media_item, created = UserMedia.objects.get_or_create(
                profile=profile, 
                media=media_obj, 
                defaults=user_media_defaults
            )

            if created:
                return Response({"success": f"'{media_obj.primary_title}' added to your list."}, status=status.HTTP_201_CREATED)
            else:
                return Response({"message": f"'{media_obj.primary_title}' is already in your list."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": "An error occurred.", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class UserMediaDeleteView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            # Find the specific item in the user's list.
            # This check ensures a user can ONLY delete items from their own list.
            user_media_item = UserMedia.objects.get(pk=pk, profile=request.user.profile)
            
            # Delete the item from the database
            user_media_item.delete()
            
            # Return a success response with no content, which is standard for DELETE
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except UserMedia.DoesNotExist:
            return Response({"error": "Item not found in your list."}, status=status.HTTP_404_NOT_FOUND)
        
class UserMediaListView(APIView):
    # Tell this view to use TokenAuthentication instead of SessionAuthentication
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        user_media_list = UserMedia.objects.filter(profile=user_profile).order_by('-score')
        serializer = UserMediaSerializer(user_media_list, many=True)
        return Response(serializer.data)
#----------------------------------------------

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
            with concurrent.futures.ThreadPoolExecutor() as executor:
                anime_future = executor.submit(anilist_service.fetch_full_user_list, profile.anilist_access_token)
                manga_future = executor.submit(anilist_service.fetch_full_user_manga_list, profile.anilist_access_token)

                anime_list = anime_future.result()
                manga_list = manga_future.result()

            full_list = anime_list + manga_list # Combine the results

            # The rest of the logic is the same, but now processes both
            status_map = { 
                            'CURRENT': 'IN_PROGRESS',
                            'PLANNING': 'PLANNED',
                            'COMPLETED': 'COMPLETED',
                            'DROPPED': 'DROPPED',
                            'PAUSED': 'PAUSED', 
                        }

            for entry in full_list:
                media_data = entry['media']

                # Determine media type based on which list it came from
                # (A more robust way would check the 'format' field from AniList)
                media_type = Media.MANGA if entry in manga_list else Media.ANIME

                media_obj, _ = Media.objects.update_or_create(
                    anilist_id=media_data['id'],
                    defaults={
                        'primary_title': media_data['title']['romaji'],
                        'secondary_title': media_data['title']['english'],
                        'media_type': media_type,
                        'cover_image_url': media_data['coverImage']['large'],
                    }
                )

                app_status = status_map.get(entry['status'], 'PLANNED')

                UserMedia.objects.update_or_create(
                    profile=profile,
                    media=media_obj,
                    defaults={'status': app_status, 'score': entry['score'], 'progress': entry['progress']}
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