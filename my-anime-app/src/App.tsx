// src/App.tsx
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { setAuthToken } from './api';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LibraryPage from './pages/LibraryPage';
import ImportPage from './pages/ImportPage';
import Layout from './components/Layout';
import './App.css';

function App() {
  const [appToken, setAppToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // When the app starts, check for a token in storage
    const token = localStorage.getItem('app-token');
    if (token) {
      setAuthToken(token); // Set the token on our api instance
      setAppToken(token);
    }
    setIsLoading(false); // We're done checking

    // Set up the listener for new AniList logins
    window.electronAPI.onLoginSuccess((_event, newToken) => {
      // This part is for after the AniList link, to refresh the user's data
      // For now, we just log it. A full implementation would maybe refresh the profile.
      console.log('AniList flow successful, received a DRF token:', newToken);
    });

  }, []);

  const handleLogin = (token: string) => {
    localStorage.setItem('app-token', token);
    setAuthToken(token); // Set the token on our api instance
    setAppToken(token);
    navigate('/library');
  };

  const handleLogout = () => {
    localStorage.removeItem('app-token');
    setAuthToken(null); // Clear the token from our api instance
    setAppToken(null);
    navigate('/');
  };

  if (isLoading) {
    return <div>Loading...</div>; // Show a loading screen while we check for a token
  }

  return (
    <Routes>
      <Route path="/" element={<LoginPage onLogin={handleLogin} />} />
      <Route path="/register" element={<RegisterPage onLogin={handleLogin} />} />

      <Route element={appToken ? <Layout onLogout={handleLogout} /> : <Navigate to="/" />}>
      <Route path="/library" element={<LibraryPage  />} />
      <Route path="/import" element={<ImportPage token={appToken!} />} />
      </Route>
    </Routes>
  );
}

export default App;