import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { setAuthToken } from './api';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LibraryPage from './pages/LibraryPage';
import ImportPage from './pages/ImportPage';
import Layout from './components/Layout';
import StatsPage from './pages/StatsPage';
import './App.css';

function App() {
  console.log('--- App Component Render ---');

  const [appToken, setAppToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem('app-token');
    console.log('useState Initializer: Token from localStorage is:', storedToken);
    return storedToken;
  });

  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('useEffect runs ONCE on mount.');
    const token = localStorage.getItem('app-token');
    console.log('useEffect: Token from localStorage on mount is:', token);
    
    if (token) {
      console.log('useEffect: Setting auth token for API helper.');
      setAuthToken(token);
    }
    setIsLoading(false);

    window.electronAPI.onLoginSuccess((_event, newToken) => {
      console.log('onLoginSuccess event triggered. New token received.');
      handleLogin(newToken);
    });
  }, []);

  const handleLogin = (token: string) => {
    console.log('handleLogin called. SAVING token to localStorage:', token);
    localStorage.setItem('app-token', token);
    setAuthToken(token);
    setAppToken(token);
    navigate('/library');
  };

  const handleLogout = () => {
    console.log('handleLogout called. REMOVING token from localStorage.');
    localStorage.removeItem('app-token');
    setAuthToken(null);
    setAppToken(null);
    navigate('/');
  };

  console.log('Rendering with appToken state:', appToken);

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
      </Route>
    </Routes>

  );
}

export default App;