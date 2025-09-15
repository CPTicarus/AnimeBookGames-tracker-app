from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from . import anilist_service
from django.shortcuts import redirect
from django.conf import settings
import requests 


class AnimeSearchAPIView(APIView):
    def get(self, request):
        query = request.query_params.get('q', None)

        if not query:
            return Response(
                {"error": "Query parameter 'q' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Try to call the service
            result = anilist_service.search_anime(query)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            # If ANY exception happens in the service, catch it here
            return Response(
                {
                    "error": "An error occurred while fetching data from AniList.",
                    # Convert the exception to a string to see what it is.
                    "details": str(e) 
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
class AniListLoginView(APIView):
    def get(self, request):
        # The URL the user needs to be redirected to for authorization
        auth_url = (
            f'https://anilist.co/api/v2/oauth/authorize'
            f'?client_id={settings.ANILIST_CLIENT_ID}'
            f'&response_type=code'
        )
        # Redirect the user's browser to that URL
        return redirect(auth_url)

class AniListCallbackView(APIView):
    def get(self, request):
        # AniList will send the user back with a 'code' in the URL
        auth_code = request.query_params.get('code')
        
        if not auth_code:
            return Response({"error": "Authorization code not provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Exchange the code for an access token
            token_data = anilist_service.exchange_code_for_token(auth_code)
            access_token = token_data.get('access_token')

            # IMPORTANT: Store the access token in the user's session
            # This is how we'll remember they are logged in
            request.session['anilist_token'] = access_token
            
            return Response({"success": "Successfully authenticated!", "token": access_token}, status=status.HTTP_200_OK)
        
        except requests.exceptions.RequestException as e:
            return Response({"error": "Failed to get token", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserAnimeListView(APIView):
    def get(self, request):
        # Retrieve the token we stored in the session
        access_token = request.session.get('anilist_token')
        
        if not access_token:
            return Response({"error": "User not authenticated. Please login first."}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            user_list = anilist_service.get_user_anime_list(access_token)
            return Response(user_list, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": "Failed to fetch user list", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)