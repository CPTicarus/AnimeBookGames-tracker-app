from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from . import anilist_service
from django.shortcuts import redirect
from django.conf import settings
import requests 
from rest_framework.renderers import JSONRenderer


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
    renderer_classes = [JSONRenderer] 

    def get(self, request):
        auth_code = request.query_params.get('code')

        if not auth_code:
            return Response({"error": "Authorization code not provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token_data = anilist_service.exchange_code_for_token(auth_code)
            access_token = token_data.get('access_token')

            # Store the token in the server-side session as before
            request.session['anilist_token'] = access_token

            return Response({
                "success": "Successfully authenticated!",
                "access_token": access_token 
            }, status=status.HTTP_200_OK)

        except requests.exceptions.RequestException as e:
            return Response({"error": "Failed to get token", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserAnimeListView(APIView):
    def get(self, request):
        # 1. Get the token from the 'Authorization' header sent by React
        auth_header = request.headers.get('Authorization')

        if not auth_header or not auth_header.startswith('Bearer '):
            return Response(
                {"error": "Authorization header missing or invalid."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # 2. Extract the token itself (it comes after "Bearer ")
        access_token = auth_header.split(' ')[1]

        # 3. Use that token to fetch data from our service
        try:
            user_list = anilist_service.get_user_anime_list(access_token)
            return Response(user_list, status=status.HTTP_200_OK)
        except Exception as e:
            # This could happen if the token is expired or invalid
            return Response(
                {"error": "Failed to fetch user list from AniList.", "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )