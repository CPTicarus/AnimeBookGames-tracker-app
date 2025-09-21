from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import os

ANILIST_API_URL = "https://graphql.anilist.co"

class ResilientRequestsHTTPTransport(RequestsHTTPTransport):
    """
    A custom transport that initializes with a pre-configured,
    resilient session for handling retries.
    """
    def __init__(self, *args, **kwargs):
        # Create the resilient session here
        session = requests.Session()
        retry_strategy = Retry(
            total=3,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST", "GET"],
            backoff_factor=1
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        
        # Manually assign the session and initialize the parent class
        self._session = session
        super().__init__(*args, **kwargs)

def search_anime(query_string):
    transport = ResilientRequestsHTTPTransport(url=ANILIST_API_URL)
    
    client = Client(transport=transport, fetch_schema_from_transport=False)
    
    query = gql('''
        query ($search: String) {
            Page(page: 1, perPage: 5) {
                media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                    id,
                    title { romaji, english },
                    coverImage { large }
                }
            }
        }
    ''')
    params = {"search": query_string}
    result = client.execute(query, variable_values=params)
    return result.get('Page', {}).get('media', [])

def get_viewer_profile(access_token):
    headers = {'Authorization': f'Bearer {access_token}'}

    transport = ResilientRequestsHTTPTransport(url=ANILIST_API_URL, headers=headers)

    client = Client(transport=transport, fetch_schema_from_transport=False)
    
    query = gql('query { Viewer { id, name } }')
    result = client.execute(query)
    return result['Viewer']

def exchange_code_for_token(auth_code):
    # This function uses requests directly and does not need to change,
    # but for consistency, we can update it.
    session = ResilientRequestsHTTPTransport(url="").session
    token_url = 'https://anilist.co/api/v2/oauth/token'
    payload = {
        'grant_type': 'authorization_code',
        'client_id': os.getenv('ANILIST_CLIENT_ID'),
        'client_secret': os.getenv('ANILIST_CLIENT_SECRET'),
        'redirect_uri': os.getenv('ANILIST_REDIRECT_URI'),
        'code': auth_code,
    }
    response = session.post(token_url, json=payload)
    response.raise_for_status()
    return response.json()

def fetch_full_user_list(access_token):
    headers = {'Authorization': f'Bearer {access_token}'}

    transport = ResilientRequestsHTTPTransport(url=ANILIST_API_URL, headers=headers)

    client = Client(transport=transport, fetch_schema_from_transport=False)
    
    viewer_profile = get_viewer_profile(access_token)
    user_name = viewer_profile['name']

    query = gql('''
        query ($userName: String, $page: Int, $perPage: Int) {
            Page (page: $page, perPage: $perPage) {
                pageInfo { hasNextPage }
                mediaList (userName: $userName, type: ANIME) {
                    status, score, progress,
                    media { 
                        id,
                        title { romaji, english },
                        coverImage { large } 
                    }
                }
            }
        }
    ''')
    all_entries = []
    page = 1
    while True:
        params = {"userName": user_name, "page": page, "perPage": 50}
        result = client.execute(query, variable_values=params)
        page_data = result['Page']
        all_entries.extend(page_data['mediaList'])
        if not page_data['pageInfo']['hasNextPage']:
            break
        page += 1
    return all_entries