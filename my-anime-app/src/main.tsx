import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import axios from 'axios';


axios.defaults.baseURL = 'http://127.0.0.1:8000'; // Set the base URL for all requests
axios.defaults.withCredentials = true; // Allow cookies and CSRF tokens to be sent

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
