import { useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LibraryPage from './pages/LibraryPage';
import ImportPage from './pages/ImportPage';
import Layout from './components/Layout';
import './App.css';

declare global {
  interface Window { electronAPI: { openLoginWindow: () => void; onLoginSuccess: (callback: (event: any, token: string) => void) => void; }; }
}

function App() {
  const [appToken, setAppToken] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = (token: string) => {
    setAppToken(token);
    // After setting the token, navigate to the library page
    navigate('/library');
  };

  return (
    <Routes>
      <Route path="/" element={<LoginPage onLogin={handleLogin} />} />
      <Route path="/register" element={<RegisterPage onLogin={handleLogin} />} />

      <Route element={appToken ? <Layout /> : <Navigate to="/" />}>
        <Route path="/library" element={<LibraryPage token={appToken!} />} />
        <Route path="/import" element={<ImportPage />} />
      </Route>
    </Routes>
  );
}

export default App;