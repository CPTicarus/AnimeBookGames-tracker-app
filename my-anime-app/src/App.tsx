// src/App.tsx
import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LibraryPage from './pages/LibraryPage';
import './App.css';

function App() {
  const [appToken, setAppToken] = useState<string | null>(null);

  const handleLogin = (token: string) => {
    setAppToken(token);
  };

  return (
    <Routes>
      <Route path="/" element={<LoginPage onLogin={handleLogin} />} />
      <Route path="/register" element={<RegisterPage onLogin={handleLogin} />} />
      <Route 
        path="/library" 
        element={appToken ? <LibraryPage token={appToken} /> : <Navigate to="/" />} 
      />
    </Routes>
  );
}
export default App;