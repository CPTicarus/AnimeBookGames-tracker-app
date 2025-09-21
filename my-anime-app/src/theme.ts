import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark', // This enables dark mode
    primary: {
      main: '#e8971fff', // A nice shade of orange
    },
    background: {
      default: '#121212', // A standard dark background
      paper: '#1E1E1E',   // The color for components like Cards
    },
  },
});

export default theme;