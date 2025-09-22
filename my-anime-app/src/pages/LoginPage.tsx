import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  Divider
} from '@mui/material';

interface LoginPageProps {
  onLogin: (token: string) => void;
}

function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const response = await axios.post('/api/auth/local-login/', { username, password });
      console.log("Backend response:", response.data);
      
      const token = response.data.token;
      if (!token) throw new Error("No token in response");

      onLogin(token); // store in localStorage or context
      navigate('/library');
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.response?.data?.error || err.message || 'Login failed');
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      sx={{
        backgroundColor: 'background.default',
      }}
    >
      <Card sx={{ width: 400, borderRadius: 3, boxShadow: 6, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="h4" align="center" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
            Welcome Back
          </Typography>
          <Typography variant="body2" align="center" sx={{ mb: 3, color: 'text.secondary' }}>
            Log in to Your Media Tracker
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Username"
            variant="outlined"
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            variant="outlined"
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2, py: 1.2, borderRadius: 2 }}
            color="primary"
            onClick={handleLogin}
          >
            Login
          </Button>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" align="center">
            Don’t have an account?{' '}
            <Link to="/register" style={{ color: '#FFA726', textDecoration: 'none', fontWeight: 500 }}>
              Create one
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default LoginPage;
