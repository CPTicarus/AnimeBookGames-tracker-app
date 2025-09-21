import requests
import os

TMDB_API_KEY = os.getenv('TMDB_API_KEY')
TMDB_API_URL = 'https://api.themoviedb.org/3'

def search_movies(query):
    search_url = f"{TMDB_API_URL}/search/movie"
    params = { 
        'api_key': TMDB_API_KEY,
        'query': query ,
        'language': 'en-US'
    }
    try:
        response = requests.get(search_url, params=params)
        response.raise_for_status()
        return response.json().get('results', [])
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while calling TMDB API: {e}")
        return None

def search_tv_shows(query):
    """
    Searches for non-anime TV shows on TMDB.
    """
    if not TMDB_API_KEY:
        raise Exception("TMDB_API_KEY is not set in the environment.")

    search_url = f"{TMDB_API_URL}/search/tv"
    params = {
        'api_key': TMDB_API_KEY,
        'query': query,
        'language': 'en-US'
    }

    try:
        response = requests.get(search_url, params=params)
        response.raise_for_status()
        return response.json().get('results', [])
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while calling TMDB API: {e}")
        return None