import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import os
from typing import Dict, List, Optional

STEAM_API_KEY = os.getenv('STEAM_API_KEY')
STEAM_API_URL = 'https://api.steampowered.com'
STEAM_STORE_URL = 'https://store.steampowered.com/api'

def get_steam_id_from_username(username: str) -> Optional[str]:
    """Convert Steam username/vanity URL to Steam ID."""
    if not STEAM_API_KEY:
        raise ValueError("Steam API key not configured")
        
    session = _get_resilient_session()
    url = f"{STEAM_API_URL}/ISteamUser/ResolveVanityURL/v1/"
    
    try:
        response = session.get(url, params={
            'key': STEAM_API_KEY,
            'vanityurl': username
        })
        response.raise_for_status()
        data = response.json()
        
        if data['response']['success'] == 1:
            return data['response']['steamid']
        return None
    except Exception as e:
        print(f"Error resolving Steam vanity URL: {e}")
        return None

def get_user_library(steam_id: str) -> List[Dict]:
    """Get user's Steam library with playtime information."""
    if not STEAM_API_KEY:
        raise ValueError("Steam API key not configured")
        
    session = _get_resilient_session()
    url = f"{STEAM_API_URL}/IPlayerService/GetOwnedGames/v1/"
    
    try:
        response = session.get(url, params={
            'key': STEAM_API_KEY,
            'steamid': steam_id,
            'include_appinfo': 1,
            'include_played_free_games': 1
        })
        response.raise_for_status()
        data = response.json()
        
        if 'response' not in data or 'games' not in data['response']:
            return []
            
        games = []
        for game in data['response']['games']:
            # Convert playtime from minutes to hours and round to 1 decimal
            playtime = round(game.get('playtime_forever', 0) / 60, 1)
            
            # Get additional game details from store API
            try:
                details_response = session.get(
                    f"{STEAM_STORE_URL}/appdetails",
                    params={'appids': game['appid'], 'cc': 'us', 'l': 'english'}
                )
                details_response.raise_for_status()
                details = details_response.json()
                
                if details and details.get(str(game['appid']), {}).get('success'):
                    app_data = details[str(game['appid'])]['data']
                    games.append({
                        'appid': game['appid'],
                        'name': game['name'],
                        'playtime_hours': playtime,
                        'header_image': app_data.get('header_image', ''),
                        'description': app_data.get('short_description', '')
                    })
            except Exception as e:
                print(f"Error fetching details for game {game['appid']}: {e}")
                # Add basic info even if detailed fetch fails
                games.append({
                    'appid': game['appid'],
                    'name': game['name'],
                    'playtime_hours': playtime,
                    'header_image': '',
                    'description': ''
                })
                
        return games
    except Exception as e:
        print(f"Error fetching Steam library: {e}")
        return []

def _get_resilient_session():
    """Creates a requests session with automatic retries."""
    session = requests.Session()
    retry_strategy = Retry(total=3, status_forcelist=[429, 500, 502, 503, 504], allowed_methods=["GET"], backoff_factor=1)
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    return session

def get_user_profile(steam_id: str):
    """Get a Steam user's profile information."""
    if not STEAM_API_KEY:
        raise ValueError("Steam API key not configured")
    
    session = _get_resilient_session()
    url = f"{STEAM_API_URL}/ISteamUser/GetPlayerSummaries/v2/"
    
    try:
        response = session.get(url, params={
            'key': STEAM_API_KEY,
            'steamids': steam_id
        })
        response.raise_for_status()
        data = response.json()
        
        if data.get('response', {}).get('players'):
            return data['response']['players'][0]
        return None
    except Exception as e:
        print(f"Error fetching Steam profile: {e}")
        return None

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