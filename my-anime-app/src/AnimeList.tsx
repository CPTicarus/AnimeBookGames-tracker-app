// src/AnimeList.tsx
import { useState, useEffect } from 'react';
import axios from 'axios';

// This makes TypeScript aware of our simplified preload API
declare global {
  interface Window {
    electronAPI: {
      openLoginWindow: () => void;
      // The callback will now pass our app's token
      onLoginSuccess: (callback: (event: any, token: string) => void) => void;
    };
  }
}

// 1. UPDATE: New interfaces to match our Django Serializers
interface Media {
  id: number;
  title: string;
  cover_image_url: string;
}

interface UserMedia {
  id: number;
  media: Media;
  status: string;
  progress: number;
  score: number | null;
}

function AnimeList() {
  const [appToken, setAppToken] = useState<string | null>(null);
  const [userMediaList, setUserMediaList] = useState<UserMedia[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // This listener now receives our app's token from the main process
    window.electronAPI.onLoginSuccess((_event, token) => {
      console.log('Login successful, received app token:', token);
      setAppToken(token); // Store the token
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!appToken) return; // Only fetch if we have a token

      setLoading(true);
      try {
        const response = await axios.get('/api/user/list/', {
          headers: {
            // Use the token for authorization
            'Authorization': `Token ${appToken}`
          }
        });
        setUserMediaList(response.data);
      } catch (err) {
        console.error("Failed to fetch user list", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [appToken]); // This effect runs whenever the appToken changes

  if (loading) return <p>Loading...</p>;

  if (!appToken) {
    return (
      <div>
        <h1>Welcome</h1>
        <p>Please log in to see your list.</p>
        <button onClick={() => window.electronAPI.openLoginWindow()}>
          Login with AniList
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Your Media List</h1>
      {userMediaList.length === 0 ? (
        <p>Your list is empty. Time to add some media!</p>
      ) : (
        <ul>
          {userMediaList.map((item) => (
            <li key={item.id}>
              {item.media.title} - Status: {item.status}, Progress: {item.progress}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AnimeList;