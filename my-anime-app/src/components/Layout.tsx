import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Button,
  Divider
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface LayoutProps {
  onLogout: () => void;
}

function Layout({ onLogout }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const menuItems = [
    { text: 'My Library', icon: <LibraryBooksIcon />, path: '/library' },
    { text: 'Trends', icon: <TrendingUpIcon />, path: '/trends' },
    { text: 'Import Lists', icon: <CloudDownloadIcon />, path: '/import' },
    { text: 'Statistics', icon: <QueryStatsIcon />, path: '/stats' },
    { text: 'Options', icon: <MenuIcon />, path: '/options' },
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top App Bar */}
      <AppBar position="fixed" sx={{ bgcolor: 'background.paper', borderBottom: '2px solid', borderColor: 'primary.main' }}>
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            My Media Tracker
          </Typography>
          <Button variant="outlined" color="primary" onClick={onLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { bgcolor: 'background.paper', color: 'text.primary' }
        }}
      >
        <Box sx={{ width: 250 }}>
          <Typography variant="h6" sx={{ p: 2, fontWeight: 'bold', color: 'primary.main' }}>
            Navigation
          </Typography>
          <Divider />
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    '&.Mui-selected': { bgcolor: 'primary.main', color: '#fff' },
                    '&.Mui-selected:hover': { bgcolor: 'primary.dark' }
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit' }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Main content with spacing below AppBar */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

export default Layout;
