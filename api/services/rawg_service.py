import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import os

RAWG_API_KEY = os.getenv('RAWG_API_KEY')
RAWG_API_URL = 'https://api.rawg.io/api'

def _get_resilient_session():
    """Creates a requests session with automatic retries."""
    session = requests.Session()
    retry_strategy = Retry(total=3, status_forcelist=[429, 500, 502, 503, 504], allowed_methods=["GET"], backoff_factor=1)
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    return session

def search_games(query):
    """Searches for games on RAWG."""
    if not RAWG_API_KEY:
        print("RAWG_API_KEY is not set.")
        return []

    session = _get_resilient_session()
    search_url = f"{RAWG_API_URL}/games"
    params = {
        'key': RAWG_API_KEY,
        'search': query
    }
    try:
        response = session.get(search_url, params=params)
        response.raise_for_status()
        return response.json().get('results', [])
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while calling RAWG API: {e}")
        return []

def get_popular_games():
    session = _get_resilient_session()
    url = f"{RAWG_API_URL}/games"
    params = {'key': RAWG_API_KEY, 'ordering': '-added', 'page_size': 5} # Order by most recently added
    response = session.get(url, params=params)
    response.raise_for_status()
    return response.json().get('results', [])