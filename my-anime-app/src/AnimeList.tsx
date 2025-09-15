import { useState, useEffect } from 'react';
import axios from 'axios';

declare global {
  interface Window {
    electronAPI: {
      openLoginWindow: () => void;
      onLoginSuccess: (callback: (event: any, token: string) => void) => void;
    };
  }
}

interface AnimeEntry { media: { id: number; title: { romaji: string; }; }; progress: number; }
interface List { name: string; entries: AnimeEntry[]; }

function AnimeList() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- THIS IS THE KEY CHANGE ---
  // This function now requires the token to be passed in
  const fetchData = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      // Create an Axios instance with the Authorization header
      const api = axios.create({
        baseURL: 'http://127.0.0.1:8000',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const response = await api.get('/api/user/list/');
      setLists(response.data.MediaListCollection.lists);
      setAccessToken(token);
    } catch (err) {
      setAccessToken(null);
      setError('Failed to fetch data with the provided token.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Listen for the login-success event and the token from the main process
    window.electronAPI.onLoginSuccess((event, token) => {
      console.log('Login successful, received token:', token);
      fetchData(token);
    });
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  if (!accessToken) {
    return (
      <div>
        <h1>Welcome</h1>
        <p>Please log in to see your anime list.</p>
        <button onClick={() => window.electronAPI.openLoginWindow()}>
          Login with AniList
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Your Anime Lists</h1>
      {/* ... (The rest of the rendering code is the same) ... */}
      {lists.map((list) => (
        <div key={list.name}>
          <h2>{list.name}</h2>
          <ul>
            {list.entries.map((entry) => (
              <li key={entry.media.id}>
                {entry.media.title.romaji} - Progress: {entry.progress}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default AnimeList;