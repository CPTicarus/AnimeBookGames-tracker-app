import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark', // This enables dark mode
    primary: {
      main: '#FFA726',
    },
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
  },
});

export default theme;