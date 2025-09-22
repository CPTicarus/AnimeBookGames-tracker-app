import requests
import os

GOOGLE_BOOKS_API_KEY = os.getenv('GOOGLE_BOOKS_API_KEY')
GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes'

def search_books(query):
    if not GOOGLE_BOOKS_API_KEY:
        print("GOOGLE_BOOKS_API_KEY not set.")
        return []

    params = {'q': query, 'key': GOOGLE_BOOKS_API_KEY}
    try:
        response = requests.get(GOOGLE_BOOKS_API_URL, params=params)
        response.raise_for_status()
        return response.json().get('items', [])
    except requests.exceptions.RequestException as e:
        print(f"Google Books API error: {e}")
        return []