import { useState, useEffect } from 'react';
import axios from 'axios';

// This makes TypeScript aware of the functions we defined in preload.js
declare global {
  interface Window {
    electronAPI: {
      openLoginWindow: () => void;
      onLoginSuccess: (callback: () => void) => void;
    };
  }
}

// ... (keep the interface definitions for AnimeEntry and List) ...
interface AnimeEntry { media: { id: number; title: { romaji: string; }; }; progress: number; }
interface List { name: string; entries: AnimeEntry[]; }


function AnimeList() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [lists, setLists] =  useState<List[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Add withCredentials to send cookies with our request
      const response = await axios.get('http://127.0.0.1:8000/api/user/list/', { withCredentials: true });
      setLists(response.data.MediaListCollection.lists);
      setIsLoggedIn(true);
    } catch (err) {
      setIsLoggedIn(false);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Try to fetch data on initial load
  useEffect(() => {
    fetchData();

    // Listen for the login-success event from the main process
    window.electronAPI.onLoginSuccess(() => {
      console.log('Login successful, refetching data...');
      fetchData();
    });
  }, []);

  if (loading) return <p>Loading...</p>;

  if (!isLoggedIn) {
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