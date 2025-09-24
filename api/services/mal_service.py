import requests
import secrets
import hashlib
import base64
from urllib.parse import urlencode
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

API_URL = "https://api.myanimelist.net/v2"
AUTH_URL = "https://myanimelist.net/v1/oauth2/authorize"
TOKEN_URL = "https://myanimelist.net/v1/oauth2/token"

def _get_resilient_session():
    """Creates and returns a requests.Session with a retry strategy."""
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["POST", "GET"],
        backoff_factor=1
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    return session

def generate_pkce_codes():
    # Generate valid code_verifier (length 64 is safe)
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=').decode('utf-8')

    # Compute challenge
    challenge = hashlib.sha256(verifier.encode('utf-8')).digest()
    challenge_b64 = base64.urlsafe_b64encode(challenge).rstrip(b'=').decode('utf-8')

    return verifier, challenge_b64


def get_auth_url(state, code_challenge):
    """Constructs the authorization URL for the user to visit."""
    params = {
        "response_type": "code",
        "client_id": settings.MAL_CLIENT_ID,
        "state": state,
        "redirect_uri": settings.MAL_REDIRECT_URI,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256"
    }
    return f"{AUTH_URL}?{urlencode(params)}"

def exchange_code_for_token(code, code_verifier):
    """Exchanges the authorization code for an access token."""
    session = _get_resilient_session()
    payload = {
        "client_id": settings.MAL_CLIENT_ID,
        "grant_type": "authorization_code",
        "code": code,
        "code_verifier": code_verifier,
        "redirect_uri": settings.MAL_REDIRECT_URI,
    }
    print("MAL token exchange payload:", payload)
    response = session.post(TOKEN_URL, data=payload, timeout=10)
    print("MAL token response:", response.status_code, response.text)
    response.raise_for_status()
    return response.json()

def get_user_info(access_token):
    """Fetches the authenticated user's profile information."""
    session = _get_resilient_session()
    headers = {"Authorization": f"Bearer {access_token}"}
    response = session.get(f"{API_URL}/users/@me", headers=headers)
    response.raise_for_status()
    return response.json()

def fetch_user_list(access_token, media_type):
    """Fetches a user's full anime or manga list, handling pagination."""
    session = _get_resilient_session()
    list_type = "animelist" if media_type == "ANIME" else "mangalist"
    
    url = f"{API_URL}/users/@me/{list_type}"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Request all relevant fields
    fields = "media{id,title,main_picture},list_status{status,score,num_episodes_watched,num_chapters_read}"
    
    full_list = []
    limit = 100 # MAL's API is more efficient with larger page sizes
    offset = 0

    while True:
        params = {"limit": limit, "offset": offset, "fields": fields}
        response = session.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        
        page_data = data.get("data", [])
        if not page_data:
            break
            
        full_list.extend(page_data)
        offset += limit

        # Check if there is a next page
        if not data.get("paging", {}).get("next"):
            break
            
    return full_list