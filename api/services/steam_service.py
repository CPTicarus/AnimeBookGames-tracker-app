import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import os

STEAM_API_KEY = os.getenv('STEAM_API_KEY')
STEAM_API_URL = 'https://api.steampowered.com'
STEAM_STORE_URL = 'https://store.steampowered.com/api'

def _get_resilient_session():
    """Creates a requests session with automatic retries."""
    session = requests.Session()
    retry_strategy = Retry(total=3, status_forcelist=[429, 500, 502, 503, 504], allowed_methods=["GET"], backoff_factor=1)
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    return session

def search_games(query):
    """Searches for games on Steam."""
    if not query:
        return []

    session = _get_resilient_session()
    search_url = f"{STEAM_STORE_URL}/storesearch/"
    params = {
        'term': query,
        'cc': 'us',
        'l': 'english',
        'category1': '998'  # Games category
    }

    try:
        response = session.get(search_url, params=params)
        response.raise_for_status()
        data = response.json()
        
        if 'items' not in data:
            print(f"No results found for query: {query}")
            return []
            
        # Filter out non-game items and ensure required fields exist
        games = []
        for item in data['items']:
            if (item.get('type') == 'app' and   # Filter for games only
                item.get('id') and              # Ensure ID exists
                item.get('name') and            # Ensure name exists
                item.get('tiny_image')):        # Ensure image exists
                games.append(item)
        
        print(f"Found {len(games)} valid games from Steam search for '{query}'")
        return games[:10]  # Return max 10 results
        
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while calling Steam API: {e}")
        if 'response' in locals():
            print(f"Response content: {response.text}")
        return []
    except Exception as e:
        print(f"Unexpected error searching Steam games: {str(e)}")
        return []

def get_popular_games():
    """Gets top selling games from Steam."""
    session = _get_resilient_session()
    
    try:
        # First, get list of top selling apps
        response = session.get(
            f"{STEAM_API_URL}/ISteamChartsService/GetMostPlayedGames/v1/"
        )
        response.raise_for_status()
        data = response.json()
        
        if 'response' not in data or 'ranks' not in data['response']:
            print("No trending games found in Steam response")
            return []
        
        # Get appids of top 15 games
        top_appids = [str(game['appid']) for game in data['response']['ranks'][:15]]
        if not top_appids:
            return []

        # Get details for these games from store API
        app_details_url = f"{STEAM_STORE_URL}/appdetails"
        games = []
        
        for appid in top_appids:
            try:
                details_response = session.get(
                    app_details_url,
                    params={'appids': appid, 'cc': 'us', 'l': 'english'}
                )
                details_response.raise_for_status()
                details = details_response.json()
                
                if details and details.get(appid, {}).get('success'):
                    app_data = details[appid]['data']
                    if app_data.get('type') == 'game':  # Ensure it's a game
                        games.append({
                            'appid': int(appid),
                            'name': app_data.get('name', ''),
                            'header_image': app_data.get('header_image', '')
                        })
            except Exception as e:
                print(f"Error fetching details for game {appid}: {str(e)}")
                continue
                
        print(f"Found {len(games)} valid trending games")
        return games
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching popular games from Steam: {e}")
        if 'response' in locals():
            print(f"Response content: {response.text}")
        return []
    except Exception as e:
        print(f"Unexpected error getting popular games: {str(e)}")
        return []