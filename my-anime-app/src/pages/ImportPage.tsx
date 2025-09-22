import { useState, useEffect } from 'react';
import api from '../api';

// The token prop is needed for the AniList connect button
function ImportPage({ token }: { token: string }) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    // This listener correctly waits for the success message from the main process
    window.electronAPI.onTmdbLinkSuccess(() => {
      setMessage('TMDB account successfully linked! You can now sync your library.');
    });
  }, []);

  const handleAniListConnect = async () => {
    setMessage('Getting AniList login URL...');
    try {
      const response = await api.get('/api/auth/login/');
      const authUrl = response.data.auth_url;
      window.electronAPI.openLoginWindow(authUrl);
      setMessage('Please complete the login in the popup window.');
    } catch (err) {
      setMessage('Could not connect to AniList.');
      console.error(err);
    }
  };

  const handleTmdbConnect = async () => {
    setMessage('Getting TMDB login URL...');
    try {
      const response = await api.post('/api/auth/tmdb/login/');
      const authUrl = response.data.auth_url;

      window.electronAPI.openTmdbLoginWindow(authUrl);

      setMessage('Please complete the TMDB login in the popup window.');
    } catch (err) {
      setMessage('Could not connect to TMDB.');
    }
  };

  const handleAniListSync = async () => {
    setMessage('Syncing your AniList library... This may take a moment.');
    try {
      const response = await api.post('/api/sync/anilist/');
      setMessage(response.data.success);
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Failed to sync AniList.');
    }
  };

  const handleTmdbSync = async () => {
    setMessage('Syncing your TMDB library... This may take a moment.');
    try {
      const response = await api.post('/api/sync/tmdb/');
      setMessage(response.data.success);
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Failed to sync TMDB.');
    } 
  };

  return (
    <div>
      <h1>Import & Sync</h1>
      <p>Connect your services to enable syncing, then sync your library.</p>
      
      <hr style={{ margin: '20px 0' }} />
      
      <h3>AniList</h3>
      <button onClick={handleAniListConnect}>Connect to AniList</button>
      <button onClick={handleAniListSync}>Sync AniList Library</button>
      
      <hr style={{ margin: '20px 0' }} />

      <h3>TMDB (Movies & TV Shows)</h3>
      <button onClick={handleTmdbConnect}>Connect to TMDB</button>
      <button onClick={handleTmdbSync}>Sync TMDB Library</button>

      {message && <p>{message}</p>}
    </div>
  );
}

export default ImportPage;