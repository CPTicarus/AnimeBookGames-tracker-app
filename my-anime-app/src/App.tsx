import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import api, { setAuthToken } from './api';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LibraryPage from './pages/LibraryPage';
import ImportPage from './pages/ImportPage';
import Layout from './components/Layout';
import StatsPage from './pages/StatsPage';
import TrendsPage from './pages/TrendsPage';
import OptionsPage from "./pages/OptionsPage";
import CustomListPage from './pages/CustomListPage';

import './App.css';

function App() {

  const [appToken, setAppToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem('app-token');
    return storedToken;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
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

    // Fetch user options to initialize theme mode
    if (token) {
      api.get('/api/options/').then(res => {
        if (typeof res.data.dark_mode === 'boolean') setDarkMode(res.data.dark_mode);
      }).catch(() => {});
    }

    const onThemeChange = (e: any) => {
      setDarkMode(Boolean(e.detail));
    };
    window.addEventListener('theme-change', onThemeChange);
    return () => window.removeEventListener('theme-change', onThemeChange);
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

  const muiTheme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: { main: '#FFA726' },
      background: {
        default: darkMode ? '#121212' : '#ffffff',
        paper: darkMode ? '#1E1E1E' : '#f9f9f9',
      },
    },
  });

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
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
        <Route path="/custom-list" element={<CustomListPage />} />
        <Route path="/custom-lists" element={<CustomListPage />} />
      </Route>
    </Routes>
    </ThemeProvider>

  );
}

export default App;