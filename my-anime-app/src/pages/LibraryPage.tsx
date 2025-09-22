import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import debounce from 'lodash.debounce';

import { 
  Autocomplete, TextField, Card, CardMedia, Stack, Typography, Box, Accordion, AccordionSummary, AccordionDetails,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Select, MenuItem, FormControl, InputLabel, Chip, CircularProgress, Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Interfaces for our data
interface Media { 
  id: number;
  api_source: string;
  api_id: number;
  primary_title: string; 
  secondary_title: string | null; 
  cover_image_url: string | null;
  media_type: string;
}
interface UserMedia { id: number; media: Omit<Media, 'media_type' | 'api_source' | 'api_id'>; status: string; progress: number; score: number | null; }

const getStatusColor = (status: string) => {
  switch (status) {
    case 'COMPLETED': return '#4CAF50';
    case 'WATCHING': return '#2196F3';
    case 'DROPPED': return '#F44336';
    case 'PAUSED': return '#FFC107';
    case 'PLANNED': return '#9E9E9E';
    default: return 'transparent';
  }
};

function LibraryPage() {
  // State for the user's library
  const [userMediaList, setUserMediaList] = useState<UserMedia[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  // State for the Autocomplete search
  const [options, setOptions] = useState<readonly Media[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingItem, setEditingItem] = useState<UserMedia | null>(null);


  const fetchLibrary = async () => {
    setLibraryLoading(true);
    try {
      const response = await api.get('/api/user/list/');
      setUserMediaList(response.data);
    } catch (err) {
      console.error("Failed to fetch user list", err);
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleAddItem = async (mediaObject: Media) => {
    try {
      const response = await api.post('/api/list/add/', mediaObject);
      setMessage(response.data.success || response.data.message);
      if (response.status === 201) {
        fetchLibrary(); // Refresh the library list to show the new item
      }
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Failed to add item.');
    }
  };

  const debouncedSearch = useMemo(
    () => debounce((query: string, callback: (options: Media[]) => void) => {
      if (query.trim() === '') {
        callback([]);
        return;
      }
      api.get<Media[]>(`/api/search/?q=${query}`).then(response => {
        callback(response.data);
      });
    }, 500),
    []
  );

  useEffect(() => {
    fetchLibrary();
  }, []);

  const handleOpenModal = (item: UserMedia) => {
    setEditingItem(item);
  };

  const handleCloseModal = () => {
    setEditingItem(null);
  };

  const handleFormChange = (event: any) => {
    if (!editingItem) return;
    setEditingItem({ ...editingItem, [event.target.name]: event.target.value });
  };

  const handleSaveChanges = async () => {
    if (!editingItem) return;
    try {
      await api.patch(`/api/list/update/${editingItem.id}/`, {
        status: editingItem.status,
        score: editingItem.score,
        progress: editingItem.progress,
      });
      handleCloseModal();
      fetchLibrary(); // Refresh the library to show changes
    } catch (err) {
      console.error("Failed to update item", err);
    }
  };

  const [inputValue, setInputValue] = useState('');

  const groupedMedia = userMediaList.reduce((acc, item) => {
    const status = item.status || 'UNKNOWN';
    if (!acc[status]) acc[status] = [];
    acc[status].push(item);
    return acc;
  }, {} as Record<string, UserMedia[]>);

  const statusOrder = ['WATCHING', 'COMPLETED', 'PAUSED', 'PLANNED', 'DROPPED'];
  const sortedGroupKeys = Object.keys(groupedMedia).sort((a, b) => {
    const indexA = statusOrder.indexOf(a);
    const indexB = statusOrder.indexOf(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <Box sx={{ p: 2 }}>
      {/* Search */}
      <Autocomplete
        options={options}
        getOptionLabel={(option) => option.secondary_title || option.primary_title}
        renderOption={(props, option) => (
          <Box component="li" sx={{ display: 'flex', alignItems: 'center' }} {...props} key={option.id}>
            {option.cover_image_url && (
              <img loading="lazy" width="40" src={option.cover_image_url} alt="" style={{ marginRight: 8, borderRadius: 4 }} />
            )}
            <Typography variant="body2">
              {option.secondary_title || option.primary_title} 
              <Typography component="span" variant="caption" color="text.secondary"> ({option.media_type})</Typography>
            </Typography>
          </Box>
        )}
        onChange={(_event, value) => {
          if (value) {
            handleAddItem(value);
            setInputValue('');
            setOptions([]);
          }
        }}
        onInputChange={(_event, newInputValue) => {
          setInputValue(newInputValue);
          setSearchLoading(true);
          debouncedSearch(newInputValue, (options) => {
            setSearchLoading(false);
            setOptions(options);
          });
        }}
        inputValue={inputValue}
        loading={searchLoading}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search and add media..."
            fullWidth
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {searchLoading ? <CircularProgress size={18} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />

      {message && (
        <Typography sx={{ my: 2, color: 'primary.main' }}>{message}</Typography>
      )}

      {/* Library List */}
      <Typography variant="h4" sx={{ mt: 4, mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
        Your Library
      </Typography>

      {libraryLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" sx={{ mt: 4 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : (
        <Box>
          {sortedGroupKeys.map((status) => (
            <Accordion key={status} defaultExpanded={status === 'WATCHING' || status === 'COMPLETED'}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Chip
                  label={`${status.toLowerCase().replace('_', ' ')} (${groupedMedia[status].length})`}
                  sx={{ bgcolor: getStatusColor(status), color: '#fff', fontWeight: 'bold' }}
                />
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {groupedMedia[status].map((item) => (
                    <Card
                      key={item.id}
                      onClick={() => handleOpenModal(item)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 1,
                        borderRadius: 2,
                        transition: '0.2s',
                        '&:hover': {
                          cursor: 'pointer',
                          transform: 'scale(1.02)',
                          boxShadow: 4,
                          borderColor: 'primary.main',
                        },
                      }}
                    >
                      <CardMedia
                        component="img"
                        sx={{ width: 60, height: 90, borderRadius: 1, flexShrink: 0 }}
                        image={item.media.cover_image_url || ''}
                      />
                      <Box sx={{ ml: 2, flexGrow: 1 }}>
                        <Typography variant="h6">{item.media.secondary_title || item.media.primary_title}</Typography>
                        {item.media.secondary_title && (
                          <Typography variant="body2" color="text.secondary">
                            {item.media.primary_title}
                          </Typography>
                        )}
                      </Box>
                      {item.score && (
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          {item.score.toFixed(1)}
                        </Typography>
                      )}
                    </Card>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <Dialog open={!!editingItem} onClose={handleCloseModal} fullWidth maxWidth="xs">
          <DialogTitle>
            Edit: {editingItem.media.secondary_title || editingItem.media.primary_title}
          </DialogTitle>
          <Divider />
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={editingItem.status || ''}
                  label="Status"
                  onChange={handleFormChange}
                >
                  <MenuItem value="WATCHING">Watching</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                  <MenuItem value="PAUSED">Paused</MenuItem>
                  <MenuItem value="DROPPED">Dropped</MenuItem>
                  <MenuItem value="PLANNED">Planned</MenuItem>
                </Select>
              </FormControl>
              <TextField
                name="score"
                label="Score (0–10)"
                type="number"
                value={editingItem.score || ''}
                onChange={handleFormChange}
                inputProps={{ step: '0.1', min: 0, max: 10 }}
              />
              <TextField
                name="progress"
                label="Progress"
                type="number"
                value={editingItem.progress || ''}
                onChange={handleFormChange}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModal}>Cancel</Button>
            <Button onClick={handleSaveChanges} variant="contained">Save</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

export default LibraryPage;