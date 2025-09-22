import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  Alert,
  Stack
} from '@mui/material';

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
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="background.default"
    >
      <Card sx={{ width: 400, borderRadius: 3, boxShadow: 4 }}>
        <CardContent>
          <Typography variant="h5" fontWeight="bold" textAlign="center" gutterBottom>
            Create an Account
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
            />
            <Button
              variant="contained"
              fullWidth
              onClick={handleRegister}
              sx={{ py: 1.2, fontWeight: 'bold' }}
            >
              Create Account
            </Button>
            {error && <Alert severity="error">{error}</Alert>}
            <Typography variant="body2" textAlign="center">
              Already have an account?{' '}
              <Link to="/" style={{ textDecoration: 'none', color: '#1976d2', fontWeight: 'bold' }}>
                Log In
              </Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default RegisterPage;