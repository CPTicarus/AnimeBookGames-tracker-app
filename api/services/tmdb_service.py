import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import os

TMDB_API_KEY = os.getenv('TMDB_API_KEY')
TMDB_API_URL = 'https://api.themoviedb.org/3'

def _get_resilient_session():
    """Creates a requests session with automatic retries."""
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"],
        backoff_factor=1
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    return session

def search_movies(query):
    """Searches for movies on TMDB in English using a resilient session."""
    session = _get_resilient_session()
    search_url = f"{TMDB_API_URL}/search/movie"
    params = {
        'api_key': TMDB_API_KEY,
        'query': query,
        'language': 'en-US'
    }
    try:
        response = session.get(search_url, params=params)
        response.raise_for_status()
        return response.json().get('results', []) # Return empty list on failure
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while calling TMDB API: {e}")
        return [] # Return an empty list to prevent crashes

def search_tv_shows(query):
    """Searches for non-anime TV shows on TMDB in English using a resilient session."""
    session = _get_resilient_session()
    search_url = f"{TMDB_API_URL}/search/tv"
    params = {
        'api_key': TMDB_API_KEY,
        'query': query,
        'without_genres': '16',
        'language': 'en-US'
    }
    try:
        response = session.get(search_url, params=params)
        response.raise_for_status()
        return response.json().get('results', []) # Return empty list on failure
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while calling TMDB API: {e}")
        return [] # Return an empty list to prevent crashes
    
def create_request_token():
    """Step 1 of TMDB auth: Get a temporary request token."""
    url = f"{TMDB_API_URL}/authentication/token/new"
    params = {'api_key': TMDB_API_KEY}
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json()['request_token']

def create_session_id(request_token):
    """Step 3 of TMDB auth: Exchange an approved token for a session_id."""
    url = f"{TMDB_API_URL}/authentication/session/new"
    params = {'api_key': TMDB_API_KEY}
    json_body = {'request_token': request_token}
    response = requests.post(url, params=params, json=json_body)
    response.raise_for_status()
    return response.json()['session_id']

def get_account_details(session_id):
    """Gets the TMDB account details to find the account_id."""
    session = _get_resilient_session()
    url = f"{TMDB_API_URL}/account"
    params = {'api_key': TMDB_API_KEY, 'session_id': session_id}
    response = session.get(url, params=params)
    response.raise_for_status()
    return response.json()

def get_movie_watchlist(account_id, session_id):
    """Gets a user's movie watchlist."""
    session = _get_resilient_session()
    url = f"{TMDB_API_URL}/account/{account_id}/watchlist/movies"
    params = {'api_key': TMDB_API_KEY, 'session_id': session_id, 'language': 'en-US'}
    response = session.get(url, params=params)
    response.raise_for_status()
    return response.json().get('results', [])

def get_tv_watchlist(account_id, session_id):
    """Gets a user's TV show watchlist."""
    session = _get_resilient_session()
    url = f"{TMDB_API_URL}/account/{account_id}/watchlist/tv"
    params = {'api_key': TMDB_API_KEY, 'session_id': session_id, 'language': 'en-US'}
    response = session.get(url, params=params)
    response.raise_for_status()
    return response.json().get('results', [])

def get_rated_movies(account_id, session_id):
    """Gets a user's rated movies."""
    session = _get_resilient_session()
    url = f"{TMDB_API_URL}/account/{account_id}/rated/movies"
    params = {'api_key': TMDB_API_KEY, 'session_id': session_id, 'language': 'en-US'}
    response = session.get(url, params=params)
    response.raise_for_status()
    return response.json().get('results', [])

def get_rated_tv(account_id, session_id):
    """Gets a user's rated TV shows."""
    session = _get_resilient_session()
    url = f"{TMDB_API_URL}/account/{account_id}/rated/tv"
    params = {'api_key': TMDB_API_KEY, 'session_id': session_id, 'language': 'en-US'}
    response = session.get(url, params=params)
    response.raise_for_status()
    return response.json().get('results', [])

def get_trending_movies():
    session = _get_resilient_session()
    url = f"{TMDB_API_URL}/trending/movie/week"
    params = {'api_key': TMDB_API_KEY, 'language': 'en-US'}
    response = session.get(url, params=params)
    response.raise_for_status()
    return response.json().get('results', [])[:5] # Get top 5

def get_trending_tv():
    session = _get_resilient_session()
    url = f"{TMDB_API_URL}/trending/tv/week"
    params = {'api_key': TMDB_API_KEY, 'language': 'en-US'}
    response = session.get(url, params=params)
    response.raise_for_status()
    return response.json().get('results', [])[:5] # Get top 5