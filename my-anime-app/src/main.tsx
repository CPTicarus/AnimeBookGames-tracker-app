import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import axios from 'axios';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles/index';
import CssBaseline from '@mui/material/CssBaseline/index';
import theme from './theme.ts'; 

axios.defaults.baseURL = 'http://127.0.0.1:8000';
axios.defaults.withCredentials = true;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* --- WRAP APP WITH THE THEME --- */}
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);