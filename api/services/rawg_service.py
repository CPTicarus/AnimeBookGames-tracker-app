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
    """Return new & trending games from RAWG.


    RAWG doesn't provide a single "new and trending" flag via the simple /games endpoint,
    so we approximate by requesting games released in the recent window and ordering by
    how recently they were added to RAWG. This typically surfaces new and currently-trending
    titles.
    """
    if not RAWG_API_KEY:
        print("RAWG_API_KEY is not set.")
        return []


    from datetime import datetime, timedelta


    session = _get_resilient_session()
    url = f"{RAWG_API_URL}/games"


    # Look back ~90 days to surface new/recent titles
    today = datetime.utcnow().date()
    start = today - timedelta(days=90)
    dates = f"{start},{today}"


    params = {
        'key': RAWG_API_KEY,
        'dates': dates,
        'ordering': '-added',
        'page_size': 15,
    }


    try:
        response = session.get(url, params=params)
        response.raise_for_status()
        data = response.json().get('results', [])


        # Normalize: ensure consumer sees 'id', 'name', 'background_image'
        normalized = []
        for item in data:
            if not item:
                continue
            if not item.get('id') or not item.get('name'):
                continue
            normalized.append({
                'id': item.get('id'),
                'name': item.get('name'),
                'background_image': item.get('background_image')
            })


        return normalized
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while calling RAWG API: {e}")
        return []
