import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { setAuthToken } from './api';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LibraryPage from './pages/LibraryPage';
import ImportPage from './pages/ImportPage';
import Layout from './components/Layout';
import StatsPage from './pages/StatsPage';
import TrendsPage from './pages/TrendsPage';
import OptionsPage from "./pages/OptionsPage";

import './App.css';

function App() {

  const [appToken, setAppToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem('app-token');
    return storedToken;
  });

  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('app-token');
    
    if (token) {
      setAuthToken(token);
    }
    setIsLoading(false);

    window.electronAPI.onLoginSuccess((_event, newToken) => {
      handleLogin(newToken);
    });
  }, []);

  const handleLogin = (token: string) => {
    localStorage.setItem('app-token', token);
    setAuthToken(token);
    setAppToken(token);
    navigate('/library');
  };

  const handleLogout = () => {
    localStorage.removeItem('app-token');
    setAuthToken(null);
    setAppToken(null);
    navigate('/');
  };


  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      {/* If logged in → go to library, else show login */}
      <Route
        path="/"
        element={
          appToken
            ? <Navigate to="/library" replace />
            : <LoginPage onLogin={handleLogin} />
        }
      />

      {/* If logged in → go to library, else show register */}
      <Route
        path="/register"
        element={
          appToken
            ? <Navigate to="/library" replace />
            : <RegisterPage onLogin={handleLogin} />
        }
      />

      {/* Protected routes wrapped in Layout */}
      <Route
        element={appToken ? <Layout onLogout={handleLogout} /> : <Navigate to="/" replace />}
      >
        <Route path="/library" element={<LibraryPage token={appToken!} />} />
        <Route path="/import" element={<ImportPage token={appToken!} />} />
        <Route path="/stats" element={<StatsPage />} /> 
        <Route path="/trends" element={<TrendsPage />} />
        <Route path="/options" element={<OptionsPage />} />
      </Route>
    </Routes>

  );
}

export default App;