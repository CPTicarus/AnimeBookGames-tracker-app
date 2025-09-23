import { useState, useEffect } from 'react';
import api from '../api';

import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  Divider,
  Alert
} from '@mui/material';
import MovieIcon from '@mui/icons-material/Movie';
import SyncIcon from '@mui/icons-material/Sync';
import LinkIcon from '@mui/icons-material/Link';
import ImportContactsIcon from '@mui/icons-material/ImportContacts';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';

function ImportPage({ token }: { token: string }) {
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'success' | 'error'>('info');

  useEffect(() => {
    // Listen specifically for the AniList link event
    window.electronAPI.onAnilistLinkSuccess(() => {
      setMessageType('success');
      setMessage('AniList account successfully linked! You can now sync.');
    });

    window.electronAPI.onTmdbLinkSuccess(() => {
      setMessageType('success');
      setMessage('TMDB account successfully linked! You can now sync.');
    });

    window.electronAPI.onMalLinkSuccess(() => {
      setMessageType('success');
      setMessage('MyAnimeList account successfully linked! You can now sync.');
    });
  }, []);


  const handleAniListConnect = async () => {
    setMessageType('info');
    setMessage('Getting AniList login URL...');
    try {
      const response = await api.get('/api/auth/login/');
      const authUrl = response.data.auth_url;
      window.electronAPI.openLoginWindow(authUrl);
      setMessage('Please complete the login in the popup window.');
    } catch (err) {
      setMessageType('error');
      setMessage('Could not connect to AniList.');
      console.error(err);
    }
  };

  const handleTmdbConnect = async () => {
    setMessageType('info');
    setMessage('Getting TMDB login URL...');
    try {
      const response = await api.post('/api/auth/tmdb/login/');
      const authUrl = response.data.auth_url;
      window.electronAPI.openTmdbLoginWindow(authUrl);
      setMessage('Please complete the TMDB login in the popup window.');
    } catch (err) {
      setMessageType('error');
      setMessage('Could not connect to TMDB.');
    }
  };

  const handleAniListSync = async () => {
    setMessageType('info');
    setMessage('Syncing your AniList library... This may take a moment.');
    try {
      const response = await api.post('/api/sync/anilist/');
      setMessageType('success');
      setMessage(response.data.success);
    } catch (err: any) {
      setMessageType('error');
      setMessage(err.response?.data?.error || 'Failed to sync AniList.');
    }
  };

  const handleTmdbSync = async () => {
    setMessageType('info');
    setMessage('Syncing your TMDB library... This may take a moment.');
    try {
      const response = await api.post('/api/sync/tmdb/');
      setMessageType('success');
      setMessage(response.data.success);
    } catch (err: any) {
      setMessageType('error');
      setMessage(err.response?.data?.error || 'Failed to sync TMDB.');
    }
  };

  const handleMALConnect = async () => {
    setMessageType('info');
    setMessage('Getting MyAnimeList login URL...');
    try {
      const response = await api.post('/api/auth/mal/login/');
      const authUrl = response.data.auth_url;
      // You can reuse the generic login window opener
      window.electronAPI.openMalLoginWindow(authUrl);
      setMessage('Please complete the MyAnimeList login in the popup window.');
    } catch (err) {
      setMessageType('error');
      setMessage('Could not connect to MyAnimeList.');
      console.error(err);
    }
  };

  const handleMALSync = async () => {
    setMessageType('info');
    setMessage('Syncing your MyAnimeList library... This can take a moment.');
    try {
      const response = await api.post('/api/sync/mal/');
      setMessageType('success');
      setMessage(response.data.success);
    } catch (err: any) {
      setMessageType('error');
      setMessage(err.response?.data?.error || 'Failed to sync MyAnimeList.');
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Import & Sync
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Connect your services to enable syncing, then sync your library.
      </Typography>

      <Divider sx={{ my: 3 }} />

      <Stack spacing={3}>
        {/* AniList Card */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ImportContactsIcon color="primary" /> AniList
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                startIcon={<LinkIcon />}
                onClick={handleAniListConnect}
              >
                Connect to AniList
              </Button>
              <Button
                variant="outlined"
                startIcon={<SyncIcon />}
                onClick={handleAniListSync}
              >
                Sync AniList Library
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* TMDB Card */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <MovieIcon color="secondary" /> TMDB (Movies & TV Shows)
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<LinkIcon />}
                onClick={handleTmdbConnect}
              >
                Connect to TMDB
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<SyncIcon />}
                onClick={handleTmdbSync}
              >
                Sync TMDB Library
              </Button>
            </Stack>
          </CardContent>
        </Card>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoStoriesIcon sx={{ color: '#2e51a2' }} /> MyAnimeList
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                startIcon={<LinkIcon />}
                onClick={handleMALConnect}
                sx={{ backgroundColor: '#2e51a2', '&:hover': { backgroundColor: '#254181' } }}
              >
                Connect to MAL
              </Button>
              <Button
                variant="outlined"
                startIcon={<SyncIcon />}
                onClick={handleMALSync}
                sx={{ color: '#2e51a2', borderColor: '#2e51a2' }}
              >
                Sync MAL Library
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* Status Message */}
      {message && (
        <Alert severity={messageType} sx={{ mt: 3 }}>
          {message}
        </Alert>
      )}
    </Box>
  );
}

export default ImportPage;
