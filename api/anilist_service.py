# api/anilist_service.py
from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport
import requests
from django.conf import settings

# Define the AniList API URL
ANILIST_API_URL = "https://graphql.anilist.co"

# Set up the transport
transport = RequestsHTTPTransport(url=ANILIST_API_URL)

# Create the GQL client
client = Client(transport=transport, fetch_schema_from_transport=False)

def search_anime(query_string):
    """
    Searches for an anime on AniList.
    Lets exceptions bubble up to be handled by the view.
    """
    query = gql('''
        query ($search: String) {
            Media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
                id
                title {
                    romaji
                    english
                }
                format
                episodes
                coverImage {
                    large
                }
            }
        }
    ''')
    params = {"search": query_string}

    # We removed the try/except block. If this fails, it will raise an exception.
    result = client.execute(query, variable_values=params)
    return result

def exchange_code_for_token(auth_code):
    """
    Exchanges the authorization code for an access token from AniList.
    """
    token_url = 'https://anilist.co/api/v2/oauth/token'
    
    payload = {
        'grant_type': 'authorization_code',
        'client_id': settings.ANILIST_CLIENT_ID,
        'client_secret': settings.ANILIST_CLIENT_SECRET,
        'redirect_uri': settings.ANILIST_REDIRECT_URI,
        'code': auth_code,
    }
    
    response = requests.post(token_url, json=payload)
    
    # Raise an exception if the request was unsuccessful
    response.raise_for_status()
    
    return response.json()

def get_user_anime_list(access_token):
    """
    Fetches the logged-in user's anime list using their access token.
    This version dynamically finds the username first.
    """
    authed_transport = RequestsHTTPTransport(
        url=ANILIST_API_URL,
        headers={'Authorization': f'Bearer {access_token}'}
    )
    authed_client = Client(transport=authed_transport, fetch_schema_from_transport=False)

    # First, create a query to get the logged-in user's details
    viewer_query = gql('''
        query {
            Viewer {
                id
                name
            }
        }
    ''')

    # Execute the query to get the user's name
    viewer_result = authed_client.execute(viewer_query)
    user_name = viewer_result['Viewer']['name']

    # Now, create the second query to get the user's list using their name
    list_query = gql('''
        query ($userName: String) {
            MediaListCollection(userName: $userName, type: ANIME) {
                lists {
                    name
                    entries {
                        media {
                            id
                            title { romaji }
                        }
                        score
                        progress
                    }
                }
            }
        }
    ''')

    # Execute the second query with the user's name as a variable
    params = {"userName": user_name}
    list_result = authed_client.execute(list_query, variable_values=params)

    return list_result