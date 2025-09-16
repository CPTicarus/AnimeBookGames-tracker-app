import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, IconButton, Typography, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';

function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate(); // <-- Add the navigate hook

  const handleNavigation = (path: string) => {
    navigate(path);
    setDrawerOpen(false); // Also close the drawer on navigation
  };

  const menuItems = [
    { text: 'My Library', icon: <LibraryBooksIcon />, path: '/library' },
    { text: 'Import Lists', icon: <CloudDownloadIcon />, path: '/import' },
  ];

  return (
    <div>
      <AppBar position="static">
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
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            My Media Tracker
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box
          sx={{ width: 250 }}
          role="presentation"
        >
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                {/* --- THIS IS THE KEY CHANGE --- */}
                {/* We now use a direct onClick handler for navigation */}
                <ListItemButton onClick={() => handleNavigation(item.path)}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <main style={{ padding: '20px' }}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;