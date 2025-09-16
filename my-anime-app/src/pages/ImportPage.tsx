import { useState } from 'react';
import api from '../api'; 

function ImportPage() {
  const [message, setMessage] = useState('');

  const handleConnect = async () => {
    setMessage('Getting AniList login URL...');
    try {
      // Change this from api.post to api.get
      const response = await api.get('/api/auth/login/');
      const authUrl = response.data.auth_url;
      window.electronAPI.openLoginWindow(authUrl);
      setMessage('Please complete the login in the popup window.');
    } catch (err) {
      setMessage('Could not connect to AniList.');
      console.error(err);
    }
  };

  const handleSync = async () => {
    setMessage('Syncing your AniList library... This may take a moment.');
    try {
      // The Authorization header is now added automatically!
      const response = await api.post('/api/sync/anilist/');
      setMessage(response.data.success);
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Failed to sync.');
    }
  };

  return (
    <div>
      <h1>Import & Sync</h1>
      <p>Connect your services to enable syncing.</p>

      <button onClick={handleConnect}>
        1. Connect to AniList Account
      </button>

      <hr style={{ margin: '20px 0' }} />

      <p>Once your account is connected, you can sync your library.</p>
      <button onClick={handleSync}>
        2. Sync AniList Library Now
      </button>

      {message && <p>{message}</p>}
    </div>
  );
}

export default ImportPage;