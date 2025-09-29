from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from unittest.mock import patch


from .models import Profile, CustomList, Media, UserMedia, CustomListEntry


class CustomListModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.profile = Profile.objects.create(user=self.user)


    def test_create_custom_list_model(self):
        custom_list = CustomList.objects.create(user=self.user, name='Favorites')
        self.assertEqual(custom_list.name, 'Favorites')
        self.assertEqual(custom_list.user, self.user)


    def test_custom_list_str(self):
        custom_list = CustomList.objects.create(user=self.user, name='Watchlist')
        self.assertIn('Watchlist', str(custom_list))
        self.assertIn(self.user.username, str(custom_list))


class CustomListAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='apitest', password='apipass')
        self.profile = Profile.objects.create(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)


    def test_create_and_list_custom_list(self):
        url = reverse('custom-list-list')
        # Create via API (serializer expects only 'name')
        resp = self.client.post(url, {'name': 'API Favorites'}, format='json')
        self.assertEqual(resp.status_code, 201)
        # List and ensure it appears
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        names = [item['name'] for item in resp.json()]
        self.assertIn('API Favorites', names)


    def test_create_custom_list_entry_via_api(self):
        # Create a CustomList and Media/UserMedia
        cl = CustomList.objects.create(user=self.user, name='EntryList')
        media = Media.objects.create(media_type=Media.ANIME, primary_title='My Test Anime')
        um = UserMedia.objects.create(profile=self.profile, media=media)


        url = reverse('custom-list-entry-list')
        resp = self.client.post(url, {'custom_list': cl.id, 'user_media': um.id}, format='json')  # type: ignore
        self.assertEqual(resp.status_code, 201)
        # Confirm entry exists
        entry = CustomListEntry.objects.get(custom_list=cl, user_media=um)
        self.assertIsNotNone(entry)
        self.assertIn('EntryList', str(entry))
        self.assertIn(self.user.username, str(entry))




class ProfileOptionsAPITest(TestCase):
    """Tests that simulate the frontend interaction with the /api/options/ endpoint.


    Covers:
    - GET returns the profile options payload
    - POST updates boolean options like `use_steam_or_rawg`
    - POST with `keep_user_logged_in` turned off revokes auth tokens
    """


    def setUp(self):
        self.user = User.objects.create_user(username='optuser', password='optpass')
        self.profile = Profile.objects.create(user=self.user)
        # Create one token to simulate a logged-in device
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)


    def test_get_options_returns_profile_fields(self):
        url = reverse('profile-options')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # The serializer exposes these keys
        for key in ("keep_local_on_sync", "dark_mode", "keep_user_logged_in", "use_steam_or_rawg"):
            self.assertIn(key, data)


    def test_post_updates_use_steam_or_rawg(self):
        url = reverse('profile-options')
        # Toggle the flag via API (frontend sends boolean)
        resp = self.client.post(url, {'use_steam_or_rawg': False}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.profile.refresh_from_db()
        self.assertFalse(self.profile.use_steam_or_rawg)


    def test_post_keep_user_logged_in_revokes_tokens(self):
        url = reverse('profile-options')
        # Ensure token exists
        self.assertTrue(Token.objects.filter(user=self.user).exists())


        # Frontend may send string values; ensure the view handles boolean-like strings
        resp = self.client.post(url, {'keep_user_logged_in': 'false'}, format='json')
        self.assertEqual(resp.status_code, 200)


        # All tokens should be removed for this user
        self.assertFalse(Token.objects.filter(user=self.user).exists())




class SearchAndSyncAPITest(TestCase):
    """Tests for search, user list loading, adding media, and Steam sync.


    These tests patch external service calls so they run offline and verify
    the request/response shape matches what the frontend expects.
    """


    def setUp(self):
        self.user = User.objects.create_user(username='syncuser', password='syncpass')
        self.profile = Profile.objects.create(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)


    @patch('api.views.anilist_service.search_anime')
    @patch('api.views.tmdb_service.search_movies')
    @patch('api.views.steam_service.search_games')
    @patch('api.views.google_books_service.search_books')
    def test_media_search_combines_sources(self, mock_books, mock_steam, mock_tmdb, mock_anilist):
        # Prepare mocked responses
        mock_anilist.return_value = [
            {'id': 111, 'title': {'romaji': 'Ani A', 'english': 'Ani A Eng'}, 'coverImage': {'large': 'http://a'}},
        ]
        mock_tmdb.return_value = [
            {'id': 222, 'title': 'Movie B', 'poster_path': '/m.jpg', 'original_title': 'Movie B Orig'},
        ]
        mock_steam.return_value = [
            {'id': 333, 'name': 'Game C', 'tiny_image': 'http://g_small', 'header_image': 'http://g_header'},
        ]
        mock_books.return_value = [
            {'id': 'vol1', 'volumeInfo': {'title': 'Book D', 'authors': ['Author'], 'imageLinks': {'thumbnail': 'http://b_thumb'}}}
        ]


        url = reverse('media-search') + '?q=test&sources=ANIME,MOVIE,GAME,BOOK'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # Ensure all four mocked items are present (order may vary)
        titles = [item['primary_title'] for item in data]
        self.assertTrue(any('Ani A' in t or 'Ani A Eng' in t for t in titles))
        self.assertTrue(any('Movie B' in t for t in titles))
        self.assertTrue(any('Game C' in t for t in titles))
        self.assertTrue(any('Book D' in t for t in titles))


    def test_user_media_list_returns_created_items(self):
        # Create two media and usermedia entries with scores to check ordering
        m1 = Media.objects.create(media_type=Media.ANIME, primary_title='A1')
        m2 = Media.objects.create(media_type=Media.ANIME, primary_title='A2')
        UserMedia.objects.create(profile=self.profile, media=m1, status='COMPLETED', score=8)
        UserMedia.objects.create(profile=self.profile, media=m2, status='COMPLETED', score=5)


        url = reverse('user-media-list')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        items = resp.json()
        # Expect two entries ordered by -score (8 then 5)
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]['media']['primary_title'], 'A1')


    def test_user_media_add_creates_entry_for_rawg(self):
        url = reverse('user-media-add')
        payload = {
            'media': {
                'api_source': 'RAWG',
                'api_id': 999,
                'primary_title': 'Rawg Game',
                'secondary_title': None,
                'cover_image_url': 'http://img',
                'media_type': Media.GAME,
            },
            'status': 'PLANNED'
        }


        resp = self.client.post(url, payload, format='json')
        self.assertIn(resp.status_code, (200, 201))
        # Confirm the media and usermedia exist
        media = Media.objects.filter(rawg_id=999).first()
        self.assertIsNotNone(media)
        um = UserMedia.objects.filter(profile=self.profile, media=media).first()
        self.assertIsNotNone(um)


    @patch('api.views.steam_service.get_user_library')
    def test_steam_sync_imports_games(self, mock_get_library):
        # Provide a steam_id and mock the library
        self.profile.steam_id = 'STEAM_1'
        self.profile.save()


        mock_get_library.return_value = [
            {'appid': 444, 'name': 'Steam Game 1', 'header_image': 'http://s1', 'playtime_minutes': 120},
            {'appid': 555, 'name': 'Steam Game 2', 'header_image': 'http://s2', 'playtime_minutes': 0},
        ]


        url = reverse('steam-sync')
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('Successfully imported', data.get('success', '') or '')


        # Check that Media and UserMedia entries were created
        self.assertTrue(Media.objects.filter(steam_appid=444).exists())
        self.assertTrue(Media.objects.filter(steam_appid=555).exists())
        self.assertTrue(UserMedia.objects.filter(profile=self.profile, media__steam_appid=444).exists())

