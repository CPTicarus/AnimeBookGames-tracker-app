import requests
import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_BOOKS_API_KEY = os.getenv('GOOGLE_BOOKS_API_KEY')
GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes'

def search_books(query):
    if not GOOGLE_BOOKS_API_KEY:
        print("ERROR: GOOGLE_BOOKS_API_KEY was not loaded in the service.")
        return []

    params = {'q': query, 'key': GOOGLE_BOOKS_API_KEY}
    try:
        # We don't need a resilient session here as Google is very stable
        response = requests.get(GOOGLE_BOOKS_API_URL, params=params)
        response.raise_for_status()
        return response.json().get('items', [])
    except requests.exceptions.RequestException as e:
        # Print the status code if available
        if e.response is not None:
            print(f"Google Books API error: {e.response.status_code} - {e.response.text}")
        else:
            print(f"Google Books API error: {e}")
        return []
    
def get_newest_books():
    params = {
        'q': 'subject:fiction',
        'key': GOOGLE_BOOKS_API_KEY,
        'orderBy': 'newest',
        'maxResults': 15,
    }

    if not GOOGLE_BOOKS_API_KEY:
        print("ERROR: GOOGLE_BOOKS_API_KEY was not loaded in the service.")
        return []

    try:
        resp = requests.get(GOOGLE_BOOKS_API_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        items = data.get('items', [])
        # Ensure we return a list (and cap to 15 if API returns more)
        if isinstance(items, list):
            return items[:15]
        return []
    except requests.exceptions.RequestException as e:
        if e.response is not None:
            print(f"Google Books API error: {e.response.status_code} - {e.response.text}")
        else:
            print(f"Google Books API error: {e}")
        return []