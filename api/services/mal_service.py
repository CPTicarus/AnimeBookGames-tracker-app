import requests
import secrets
import hashlib
import base64
from urllib.parse import urlencode
from django.conf import settings

API_URL = "https://api.myanimelist.net/v2"
AUTH_URL = "https://myanimelist.net/v1/oauth2/authorize"
TOKEN_URL = "https://myanimelist.net/v1/oauth2/token"

def _get_resilient_session():
    # ... (You can copy this helper function from your anilist_service.py)
    # For brevity, assuming it's here and works.
    return requests.Session()

def generate_pkce_codes():
    """Generates a code_verifier and a code_challenge for PKCE."""
    # Generate a high-entropy cryptographic random string
    code_verifier = secrets.token_urlsafe(100)[:128]

    # Create the code_challenge by SHA256 hashing and base64 encoding
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode("utf-8")).digest()
    ).decode("utf-8").replace("=", "")
    
    return code_verifier, code_challenge

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
        "redirect_uri": settings.MAL_REDIRECT_URI,
        "code_verifier": code_verifier
    }
    response = session.post(TOKEN_URL, data=payload)
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