import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import debounce from 'lodash.debounce';

import { 
  Autocomplete, TextField, Card, CardMedia, Stack, Typography, Box, Accordion, AccordionSummary, AccordionDetails,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Select, MenuItem, FormControl, InputLabel
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
    <div>
      <Autocomplete
        options={options}
        // Tell TypeScript how to get the text label for each option
        getOptionLabel={(option) => option.secondary_title || option.primary_title}
        // Custom rendering for each option in the dropdown
        renderOption={(props, option) => (
          <Box component="li" sx={{ '& > img': { mr: 2, flexShrink: 0 } }} {...props} key={option.id}>
            <img loading="lazy" width="40" src={option.cover_image_url || ''} alt="" />
            {option.secondary_title || option.primary_title} ({option.media_type})
          </Box>
        )}
        // When the user selects an option
        onChange={(_event, value) => {
          if (value) {
            handleAddItem(value);
            setInputValue(''); // Clear the input field after adding
            setOptions([]); // Clear the options dropdown
          }
        }}
        // When the user types in the box
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
        // This makes the input box look nice
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search to add new items..."
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {searchLoading ? '...' : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />

      {message && <Typography sx={{ my: 2, color: 'primary.main' }}>{message}</Typography>}

      <h1 style={{ marginTop: '32px' }}>Your Media List</h1>
      {libraryLoading ? <p>Loading library...</p> : (
        <Box>
          {sortedGroupKeys.map((status) => (
            <Accordion key={status} defaultExpanded={status === 'WATCHING' || status === 'COMPLETED'}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ textTransform: 'capitalize' }}>{status.toLowerCase().replace('_', ' ')} ({groupedMedia[status].length})</Typography>
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
                        padding: 1, 
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          cursor: 'pointer',
                          transform: 'scale(1.02)', // A nice grow effect
                          outline: '2px solid',
                          outlineColor: 'primary.main',
                        },
                      }}
                    >
                      <Box sx={{ width: 12, height: 12, backgroundColor: getStatusColor(item.status), borderRadius: '50%', flexShrink: 0, margin: '0 12px' }} />
                      <CardMedia component="img" sx={{ width: 60, height: 90, borderRadius: 1, flexShrink: 0 }} image={item.media.cover_image_url || ''} />
                      <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, marginLeft: 2 }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="h6" component="div" sx={{ lineHeight: 1.2 }}>{item.media.secondary_title || item.media.primary_title}</Typography>
                          <Typography variant="body2" color="text.secondary">{item.media.secondary_title ? item.media.primary_title : ''}</Typography>
                        </Box>
                        {item.score && (
                          <Typography variant="h5" component="div" sx={{ ml: 2, fontWeight: 'bold' }}>{item.score.toFixed(1)}</Typography>
                        )}
                      </Box>
                    </Card>
                  ))}
                  {editingItem && (
                    <Dialog open={!!editingItem} onClose={handleCloseModal} fullWidth maxWidth="xs">
                      <DialogTitle>Edit: {editingItem.media.secondary_title || editingItem.media.primary_title}</DialogTitle>
                      <DialogContent>
                        <Stack spacing={3} sx={{ marginTop: 2 }}>
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
                            label="Score (e.g., 8.5)"
                            type="number"
                            value={editingItem.score || ''}
                            onChange={handleFormChange}
                            inputProps={{ step: "0.1" }}
                          />
                          <TextField
                            name="progress"
                            label="Progress (e.g., episodes)"
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
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </div>
  );
}

export default LibraryPage;