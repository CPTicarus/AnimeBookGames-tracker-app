// src/pages/OptionsPage.tsx
import React, { useEffect, useState } from "react";
import {
  Typography,
  Switch,
  FormControlLabel,
  Box,
  Paper,
  Divider,
} from "@mui/material";
import api from "../api";

const OptionsPage: React.FC = () => {
  const [options, setOptions] = useState({
    keep_local_on_sync: true,
    keep_user_logged_in: true,
    dark_mode: true,
  });

  // Fetch options from backend
  useEffect(() => {
    api
      .get("/api/options/")
      .then((res) => setOptions((prev) => ({ ...prev, ...res.data })))
      .catch(() => {});
  }, []);

  const handleToggle = (field: keyof typeof options) => {
    const newValue = !options[field];
    setOptions({ ...options, [field]: newValue });

    // Only send if backend knows this field
    if (field === "keep_local_on_sync" || field === "dark_mode") {
      api.post("/api/options/", { [field]: newValue }).catch(() => {});
    }

    // Immediately reflect dark mode changes app-wide
    if (field === "dark_mode") {
      window.dispatchEvent(new CustomEvent('theme-change', { detail: newValue }));
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: "auto" }}>
      <Typography variant="h5" sx={{ fontWeight: "bold", mb: 2 }}>
        Options
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={options.keep_local_on_sync}
              onChange={() => handleToggle("keep_local_on_sync")}
              color="primary"
            />
          }
          label="Keep library intact on sync"
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          When enabled, your app scores/progress won’t be overwritten by sync
          data.
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={options.keep_user_logged_in}
              onChange={() => handleToggle("keep_user_logged_in")}
              color="primary"
            />
          }
          label="Keep user logged in"
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          (Placeholder) Prevents auto-logout between sessions.
        </Typography>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={options.dark_mode}
              onChange={() => handleToggle("dark_mode")}
              color="primary"
            />
          }
          label="Dark mode"
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          Switch between light and dark themes.
        </Typography>
      </Paper>
    </Box>
  );
};

export default OptionsPage;
