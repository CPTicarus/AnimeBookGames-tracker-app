import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

interface RegisterPageProps {
  onLogin: (token: string) => void;
}

function RegisterPage({ onLogin }: RegisterPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async () => {
    try {
      const response = await axios.post('/api/auth/register/', { username, password });
      onLogin(response.data.token);
      navigate('/library');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create account');
    }
  };

  return (
    <div>
      <h1>Create an Account</h1>
      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
      <button onClick={handleRegister}>Create Account</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p>
        Already have an account? <Link to="/">Log In</Link>
      </p>
    </div>
  );
}
export default RegisterPage;