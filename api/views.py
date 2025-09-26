from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.db.models import Count
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from .authentication import ExpiringTokenAuthentication
from rest_framework.decorators import api_view, permission_classes, authentication_classes
import concurrent.futures
import traceback

from .services import (
    anilist_service, tmdb_service, steam_service, google_books_service, mal_service, rawg_service
)
from .models import Media, Profile, UserMedia, TMDBRequestToken, MALAuthRequest
from .serializers import UserMediaSerializer, ProfileOptionsSerializer


# ==============================================================================
# Steam Integration Views
# ==============================================================================

class SteamConnectView(APIView):
    authentication_classes = [ExpiringTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get the user's token to use as state
            token = Token.objects.get(user=request.user)

            # Steam OpenID URL with state parameter
            login_url = (
                "https://steamcommunity.com/openid/login"
                "?openid.ns=http://specs.openid.net/auth/2.0"
                "&openid.mode=checkid_setup"
                f"&openid.return_to=http://127.0.0.1:8000/api/auth/steam/callback/?state={token.key}"
                "&openid.realm=http://127.0.0.1:8000"
                "&openid.identity=http://specs.openid.net/auth/2.0/identifier_select"
                "&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select"
            )
            return Response({"auth_url": login_url})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SteamCallbackView(APIView):
    authentication_classes = []  # No authentication required for the callback
    permission_classes = []      # No permissions required for the callback

    def get(self, request):
        try:
            # Get claimed ID from Steam's response
            claimed_id = request.GET.get('openid.claimed_id', '')
            if not claimed_id:
                return Response({"error": "Steam authentication failed"}, status=status.HTTP_400_BAD_REQUEST)

            # Get the app token from the state parameter
            app_token = request.GET.get('state', '')
            if not app_token:
                return Response({"error": "No authentication state provided"}, status=status.HTTP_400_BAD_REQUEST)

            # Get the user from the token
            try:
                token = Token.objects.get(key=app_token)
                user = token.user
                profile = user.profile
            except Token.DoesNotExist:
                return Response({"error": "Invalid authentication token"}, status=status.HTTP_401_UNAUTHORIZED)

            # Extract Steam ID from the claimed ID URL
            steam_id = claimed_id.split('/')[-1]
            
            # Update the user's profile with Steam ID
            profile.steam_id = steam_id
            
            # Get additional Steam profile info
            try:
                steam_user_response = steam_service.get_user_profile(steam_id)
                if steam_user_response:
                    profile.steam_username = steam_user_response.get('personaname', '')
            except Exception as e:
                print(f"Error getting Steam profile: {e}")
            
            profile.save()

            # Return success response that will trigger the window to close
            return Response(
                "<html><body><script>window.close();</script>Steam account linked successfully!</body></html>",
                content_type="text/html"
            )
        except Exception as e:
            print(f"Steam callback error: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SteamSyncView(APIView):
    authentication_classes = [ExpiringTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        if not profile.steam_id:
            return Response({"error": "Steam account not connected"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            games = steam_service.get_user_library(profile.steam_id)
            games_added = 0

            for game in games:
                # Create or update the game in our database
                media, created = Media.objects.get_or_create(
                    media_type=Media.GAME,
                    steam_appid=game['appid'],  # Use Steam's appid as the unique identifier
                    defaults={
                        'primary_title': game['name'],
                        'cover_image_url': game['header_image'],
                        'description': game.get('description', ''),
                    }
                )
                
                # Update the title and cover image even if the game exists
                if not created:
                    media.primary_title = game['name']
                    media.cover_image_url = game['header_image']
                    media.description = game.get('description', '')
                    media.save()

                # Create or update user's game entry with playtime
                user_media, created = UserMedia.objects.get_or_create(
                    profile=profile,
                    media=media,
                    defaults={
                        'status': UserMedia.IN_PROGRESS if game['playtime_minutes'] > 0 else UserMedia.PLANNED,
                        'progress': game['playtime_minutes']  # Already in minutes from Steam
                    }
                )

                if not created:
                    # Update existing entry's playtime
                    user_media.progress = game['playtime_minutes']
                    # Update status if needed
                    if game['playtime_minutes'] > 0 and user_media.status == UserMedia.PLANNED:
                        user_media.status = UserMedia.IN_PROGRESS
                    user_media.save()

                games_added += 1

            return Response({
                "success": f"Successfully imported {games_added} games from Steam library"
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ==============================================================================
# General & Utility Views
# ==============================================================================

def csrf_token_view(request):
    """
    A simple view to ensure the CSRF cookie is set.
    """
    return JsonResponse({"detail": "CSRF cookie set."})


class ProfileOptionsView(APIView):
    authentication_classes = [ExpiringTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        return Response(ProfileOptionsSerializer(profile).data)

    def post(self, request):
        profile = request.user.profile
        serializer = ProfileOptionsSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            # Save the preference
            serializer.save()

            # If the user explicitly turned OFF "keep_user_logged_in", revoke tokens
            if 'keep_user_logged_in' in request.data:
                try:
                    keep_val = request.data.get('keep_user_logged_in')
                    # normalize possible string values from form submissions
                    if isinstance(keep_val, str):
                        keep_val = keep_val.lower() in ('1', 'true', 'yes', 'on')
                    if keep_val is False:
                        # Delete all tokens for this user to force re-login
                        Token.objects.filter(user=request.user).delete()
                except Exception:
                    # Don't block the response on token deletion errors
                    pass

            return Response(serializer.data)
        return Response(serializer.errors, status=400)
    
class StatsView(APIView):
    authentication_classes = [ExpiringTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        
        # Get all items for time calculation
        all_items = UserMedia.objects.filter(profile=profile)
        # Get only completed items with scores for score calculation
        completed_list = UserMedia.objects.filter(profile=profile, status='COMPLETED', score__isnull=False)

        overall_stats = {'total_completed': completed_list.count(), 'weighted_average_score': 0}
        per_type_stats = {}
        
        time_spent_minutes = {
            'OVERALL': 0, Media.ANIME: 0, Media.MOVIE: 0, Media.TV_SHOW: 0,
            Media.MANGA: 0, Media.BOOK: 0, Media.GAME: 0,
        }
        total_weighted_score = 0
        total_weight = 0
        type_weighted_scores = {}
        type_weights = {}

        # First calculate time spent from all items
        for item in all_items:
            if item.progress <= 0:  # Skip items with no progress
                continue
                
            media_type = item.media.media_type
            
            # Calculate time in minutes for this item
            minutes = 0
            if media_type == Media.ANIME: minutes = item.progress * 25
            elif media_type == Media.MOVIE: minutes = item.progress * 120
            elif media_type == Media.TV_SHOW: minutes = item.progress * (20 if item.progress > 100 else 45)
            elif media_type == Media.GAME: minutes = item.progress  # Already in minutes from Steam
            elif media_type == Media.BOOK: minutes = item.progress * 360
            elif media_type == Media.MANGA: minutes = item.progress * 10
            
            # Add to total time if there's any progress
            if minutes > 0:
                time_spent_minutes[media_type] += minutes

        # Then calculate scores from completed items
        for item in completed_list:
            media_type = item.media.media_type
            score = item.score
            
            # Calculate weight for scoring (keeping original logic)
            weight = 0
            if media_type == Media.ANIME: weight = item.progress * 25
            elif media_type == Media.MOVIE: weight = item.progress * 120
            elif media_type == Media.TV_SHOW: weight = item.progress * (20 if item.progress > 100 else 45)
            elif media_type == Media.GAME: weight = item.progress  # Already in minutes from Steam
            elif media_type == Media.BOOK: weight = item.progress * 360
            elif media_type == Media.MANGA: weight = item.progress * 10
            
            # Use a default weight of 1 for items with 0 progress to include them in the average
            if weight == 0: weight = 1

            # 2. Add this weight to our totals
            time_spent_minutes[media_type] += weight
            total_weight += weight
            total_weighted_score += score * weight #type: ignore

            # Initialize per-type dictionaries
            if media_type not in per_type_stats:
                per_type_stats[media_type] = {'total_completed': 0, 'weighted_average_score': 0}
                type_weighted_scores[media_type] = 0
                type_weights[media_type] = 0
            
            # Per-type calculation
            type_weighted_scores[media_type] += score * weight #type: ignore
            type_weights[media_type] += weight
            per_type_stats[media_type]['total_completed'] += 1

        # Finalize averages
        if total_weight > 0:
            overall_stats['weighted_average_score'] = round(total_weighted_score / total_weight, 2) #type: ignore
        
        for media_type, weighted_score in type_weighted_scores.items():
            if type_weights.get(media_type, 0) > 0:
                avg = round(weighted_score / type_weights[media_type], 2)
                per_type_stats[media_type]['weighted_average_score'] = avg
        
        time_spent_minutes['OVERALL'] = sum(time_spent_minutes.values())
        time_spent_hours = {key: round(value / 60, 1) for key, value in time_spent_minutes.items()}

        response_data = {
            'overall': overall_stats, 'by_type': per_type_stats, 'time_spent_hours': time_spent_hours,
        }
        
        return Response(response_data)

class TrendsView(APIView):
    authentication_classes = [ExpiringTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        trends = {}
        with concurrent.futures.ThreadPoolExecutor() as executor:
            # Submit all tasks
            anime_future = executor.submit(anilist_service.get_trending_anime)
            manga_future = executor.submit(anilist_service.get_trending_manga)
            movie_future = executor.submit(tmdb_service.get_trending_movies)
            tv_future = executor.submit(tmdb_service.get_trending_tv)
            #game_future = executor.submit(rawg_service.get_popular_games)
            game_future = executor.submit(steam_service.get_popular_games)
            book_future = executor.submit(google_books_service.get_newest_books)

            # Collect results
            trends['ANIME'] = anime_future.result()
            trends['MANGA'] = manga_future.result()
            trends['MOVIE'] = movie_future.result()
            trends['TV_SHOW'] = tv_future.result()
            games = game_future.result()
            trends['GAME'] = [
                {
                    'id': game['appid'],
                    'name': game['name'],
                    'header_image': game['header_image']
                }
                for game in games
                if all(key in game for key in ['appid', 'name', 'header_image'])
            ]
            trends['BOOK'] = book_future.result()

        # Here we would normally process/format the data, but for now we'll send it raw
        return Response(trends)
    
# ==============================================================================
# Authentication Views (Local & Third-Party)
# ==============================================================================

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
               
class AniListLoginView(APIView):
    authentication_classes = [ExpiringTokenAuthentication]
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
    authentication_classes = []
    permission_classes = []
    renderer_classes = [JSONRenderer]

    def get(self, request):
        auth_code = request.query_params.get('code')
        app_token_key = request.query_params.get('state')

        if not auth_code or not app_token_key:
            return Response({"error": "Auth code or state missing."}, status=400)

        try:
            token_obj = Token.objects.get(key=app_token_key)
            user = token_obj.user
            profile = user.profile

            anilist_token_data = anilist_service.exchange_code_for_token(auth_code)
            access_token = anilist_token_data['access_token']

            anilist_profile = anilist_service.get_viewer_profile(access_token)
            profile.anilist_username = anilist_profile['name']
            profile.anilist_access_token = access_token
            profile.save()

            return Response(
                "<html><body><script>window.close();</script>Login successful, you can close this window.</body></html>",
                content_type="text/html"
            )

        except Token.DoesNotExist:
            return Response({"error": "Invalid state token."}, status=400)
        except Exception as e:
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)
        
class TMDBLoginView(APIView):
    authentication_classes = [ExpiringTokenAuthentication]
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
            profile = user.profile # type: ignore[attr-defined]

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
        
class MALLoginView(APIView):
    authentication_classes = [ExpiringTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token_key = request.auth.key

        # Always generate a fresh verifier/challenge to ensure pairing with the new auth code
        code_verifier, code_challenge = mal_service.generate_pkce_codes()
        MALAuthRequest.objects.update_or_create(
            state=token_key,
            defaults={'code_verifier': code_verifier}
        )
        print("MAL PKCE: generated new verifier and challenge", {
            "state": token_key,
            "code_verifier": code_verifier,
            "code_challenge": code_challenge,
        })

        auth_url = mal_service.get_auth_url(token_key, code_challenge)
        print("MAL Auth URL params", {"state": token_key, "code_challenge": code_challenge})
        return Response({"auth_url": auth_url})    

class MALCallbackView(APIView):
    def get(self, request):
        code = request.query_params.get('code')
        state = request.query_params.get('state')

        try:
            # Retrieve the code_verifier using the state
            auth_request = MALAuthRequest.objects.get(state=state)
            code_verifier = auth_request.code_verifier
            # For debugging, recompute challenge to ensure consistency with what would have been sent
            recomputed_challenge = mal_service.generate_code_challenge_from_verifier(code_verifier)
            print("MAL PKCE: callback recomputed challenge", {
                "state": state,
                "code_verifier": code_verifier,
                "recomputed_challenge": recomputed_challenge,
            })

            # Exchange code for token
            token_data = mal_service.exchange_code_for_token(code, code_verifier)
            access_token = token_data['access_token']
            refresh_token = token_data['refresh_token']
            
            # Get the user associated with the state token
            user = Token.objects.get(key=state).user
            profile = user.profile
            
            # Get user info and save tokens
            user_info = mal_service.get_user_info(access_token)
            profile.mal_username = user_info['name']
            profile.mal_access_token = access_token
            profile.mal_refresh_token = refresh_token
            profile.save()

            # Clean up the temporary auth request
            auth_request.delete()
            print("DB verifier:", code_verifier)
            print("Code received:", code)
            print("State received:", state)
            return Response({"success": "MyAnimeList account successfully linked!"})

        except MALAuthRequest.DoesNotExist:
            return Response({"error": "Invalid or expired state token."}, status=400)
        except Exception as e:
            traceback.print_exc()
            return Response({"error": "Failed to link MyAnimeList account.", "details": str(e)}, status=500)

@api_view(["GET"])
@authentication_classes([ExpiringTokenAuthentication])
@permission_classes([IsAuthenticated])
def mal_status(request):
    """
    Return whether the user has linked their MAL account.
    """
    profile = request.user.profile
    linked = bool(profile.mal_access_token)
    return Response({"linked": linked})

# ==============================================================================
# Media & Search Views
# ==============================================================================

class UserMediaUpdateView(APIView):
    authentication_classes = [ExpiringTokenAuthentication]
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
    authentication_classes = [ExpiringTokenAuthentication]
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
                # future_to_source[executor.submit(rawg_service.search_games, query)] = 'GAME'
                future_to_source[executor.submit(steam_service.search_games, query)] = 'GAME'
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
                            if not item.get('tiny_image'): continue
                            results.append({
                                "api_source": "STEAM", "api_id": item['id'], "primary_title": item['name'],
                                "secondary_title": None, "media_type": "GAME",
                                "cover_image_url": item['tiny_image']
                            })
                    # elif source_type == 'GAME':
                    #     for item in data:
                    #         if not item.get('background_image'): continue
                    #         results.append({
                    #             "api_source": "RAWG", "api_id": item['id'], "primary_title": item['name'],
                    #             "secondary_title": None, "media_type": "GAME",
                    #             "cover_image_url": item['background_image']
                    #         })
                    elif source_type == 'BOOK':
                        for item in data:
                            volume_info = item.get('volumeInfo', {})
                            image_links = volume_info.get('imageLinks', {})
                            thumbnail_url = image_links.get('thumbnail')
                            if not thumbnail_url:
                                continue
                            results.append({
                                "api_source": "GOOGLE", "api_id": item['id'],
                                "primary_title": volume_info.get('title'),
                                "secondary_title": ", ".join(volume_info.get('authors', [])),
                                "media_type": "BOOK",
                                "cover_image_url": thumbnail_url.replace('http://', 'https://')
                            })
                except Exception as exc:
                    print(f'{source_type} search generated an exception: {exc}')
        
        return Response(results)

class UserMediaAddView(APIView):
    authentication_classes = [ExpiringTokenAuthentication]
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
    authentication_classes = [ExpiringTokenAuthentication]
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
    # Tell this view to use ExpiringTokenAuthentication instead of SessionAuthentication
    authentication_classes = [ExpiringTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        user_media_list = UserMedia.objects.filter(profile=user_profile).order_by('-score')
        serializer = UserMediaSerializer(user_media_list, many=True)
        return Response(serializer.data)

# ==============================================================================
# Synchronization Views (Importing Lists from External APIs)
# ==============================================================================

class SyncMALView(APIView):
    authentication_classes = [ExpiringTokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        profile = request.user.profile
        if not profile.mal_access_token:
            return Response({"error": "MyAnimeList account not linked."}, status=400)

        try:
            with concurrent.futures.ThreadPoolExecutor() as executor:
                anime_future = executor.submit(mal_service.fetch_user_list, profile.mal_access_token, "ANIME")
                manga_future = executor.submit(mal_service.fetch_user_list, profile.mal_access_token, "MANGA")
                
                anime_list = anime_future.result()
                manga_list = manga_future.result()
            
            full_list = anime_list + manga_list
            status_map = {
                'watching': 'IN_PROGRESS', 'reading': 'IN_PROGRESS',
                'completed': 'COMPLETED',
                'on_hold': 'PAUSED',
                'dropped': 'DROPPED',
                'plan_to_watch': 'PLANNED', 'plan_to_read': 'PLANNED',
            }

            for entry in full_list:
                node = entry['node']
                list_status = entry['list_status']
                media_type = Media.ANIME if 'num_episodes_watched' in list_status else Media.MANGA

                media_obj, _ = Media.objects.update_or_create(
                    mal_id=node['id'],
                    defaults={
                        'media_type': media_type,
                        'primary_title': node['title'],
                        'cover_image_url': node.get('main_picture', {}).get('large')
                    }
                )
                
                if profile.keep_local_on_sync:
                    # Don't overwrite existing entries; only create if missing
                    UserMedia.objects.get_or_create(
                        profile=profile,
                        media=media_obj,
                        defaults={
                            'status': status_map.get(list_status['status'], 'PLANNED'),
                            'score': list_status['score'],
                            'progress': list_status.get('num_episodes_watched') or list_status.get('num_chapters_read', 0)
                        }
                    )
                else:
                    # Overwrite with remote data
                    UserMedia.objects.update_or_create(
                        profile=profile,
                        media=media_obj,
                        defaults={
                            'status': status_map.get(list_status['status'], 'PLANNED'),
                            'score': list_status['score'],
                            'progress': list_status.get('num_episodes_watched') or list_status.get('num_chapters_read', 0)
                        }
                    )

            return Response({"success": f"MyAnimeList sync complete. Processed {len(full_list)} items."})
        except Exception as e:
            traceback.print_exc()
            return Response({"error": "An error occurred during MAL sync.", "details": str(e)}, status=500)

class SyncAniListView(APIView):
    authentication_classes = [ExpiringTokenAuthentication]
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

                if profile.keep_local_on_sync:
                    UserMedia.objects.get_or_create(
                        profile=profile,
                        media=media_obj,
                        defaults={'status': app_status, 'score': entry['score'], 'progress': entry['progress']}
                    )
                else:
                    UserMedia.objects.update_or_create(
                        profile=profile,
                        media=media_obj,
                        defaults={'status': app_status, 'score': entry['score'], 'progress': entry['progress']}
                    )

            return Response({"success": f"Sync complete. Processed {len(full_list)} items."}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": "An error occurred during sync", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class SyncTMDBView(APIView):
    authentication_classes = [ExpiringTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        if not profile.tmdb_session_id:
            return Response({"error": "TMDB account not linked."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            account_details = tmdb_service.get_account_details(profile.tmdb_session_id)
            account_id = account_details['id']
            profile.tmdb_account_id = str(account_id) # Store as string for consistency
            profile.save()

            # Fetch all lists
            movie_watchlist = tmdb_service.get_movie_watchlist(account_id, profile.tmdb_session_id)
            tv_watchlist = tmdb_service.get_tv_watchlist(account_id, profile.tmdb_session_id)
            rated_movies = tmdb_service.get_rated_movies(account_id, profile.tmdb_session_id)
            rated_tv = tmdb_service.get_rated_tv(account_id, profile.tmdb_session_id)

            processed_items = {}

            # Process watchlist
            for item in movie_watchlist: processed_items[f"movie-{item['id']}"] = {'data': item, 'type': Media.MOVIE, 'status': 'PLANNED', 'score': None}
            for item in tv_watchlist: processed_items[f"tv-{item['id']}"] = {'data': item, 'type': Media.TV_SHOW, 'status': 'PLANNED', 'score': None}
            
            # Process rated list (will overwrite watchlist entries if they exist, which is correct)
            for item in rated_movies: processed_items[f"movie-{item['id']}"] = {'data': item, 'type': Media.MOVIE, 'status': 'COMPLETED', 'score': item.get('rating')}
            for item in rated_tv: processed_items[f"tv-{item['id']}"] = {'data': item, 'type': Media.TV_SHOW, 'status': 'COMPLETED', 'score': item.get('rating')}

            items_processed_count = 0
            for _unique_id, item_info in processed_items.items():
                try:
                    item_data = item_info['data']
                    item_type = item_info['type']
                    
                    if not item_data.get('poster_path') or not item_data.get('id'):
                        continue

                    defaults = {
                        'primary_title': item_data.get('title') or item_data.get('name'),
                        'secondary_title': item_data.get('original_title') or item_data.get('original_name'),
                        'cover_image_url': f"https://image.tmdb.org/t/p/w500{item_data.get('poster_path')}",
                        'description': item_data.get('overview'),
                    }
                    media_obj, _ = Media.objects.update_or_create(
                        tmdb_id=item_data['id'], media_type=item_type, defaults=defaults
                    )

                    if profile.keep_local_on_sync:
                        # Only create if missing; do not overwrite existing local data
                        _, created = UserMedia.objects.get_or_create(
                            profile=profile, media=media_obj,
                            defaults={'status': item_info['status'], 'score': item_info['score'], 'progress': 0}
                        )
                        if created:
                            items_processed_count += 1
                    else:
                        UserMedia.objects.update_or_create(
                            profile=profile, media=media_obj,
                            defaults={'status': item_info['status'], 'score': item_info['score'], 'progress': 0}
                        )
                        items_processed_count += 1
                except Exception as item_error:
                    print(f"Failed to process item {item_data.get('id')}: {item_error}") #type: ignore
                    continue # Continue to the next item
            
            return Response({"success": f"Sync complete. Processed {items_processed_count} items."}, status=status.HTTP_200_OK)
        except Exception as e:
            traceback.print_exc()
            return Response({"error": "An error occurred during TMDB sync", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
