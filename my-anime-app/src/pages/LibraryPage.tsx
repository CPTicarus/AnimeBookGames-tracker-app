import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import debounce from 'lodash.debounce';

import { 
  Autocomplete, TextField, Card,
  CardMedia, Stack, Typography, Box, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface Media { 
  id: number;
  api_source: string;
  api_id: number;
  primary_title: string; 
  secondary_title: string | null; 
  cover_image_url: string | null;
  media_type: string;
}
interface UserMedia { id: number; media: Omit<Media, 'media_type'>; status: string; progress: number; score: number | null; }

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
  const [options, setOptions] = useState<readonly Media[]>([]); // Options for the dropdown
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState('');

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
        fetchLibrary();
      }
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Failed to add item.');
    }
  };

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      if (query.trim()) {
        setSearchLoading(true);
        api.get<Media[]>(`/api/search/?q=${query}`)
          .then((response) => setOptions(response.data))
          .finally(() => setSearchLoading(false));
      } else {
        setOptions([]);
      }
    }, 500),
    []
  );
  
  useEffect(() => {
    fetchLibrary();
  }, []);

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
      {/* --- NEW AUTOCOMPLETE SEARCH BAR --- */}
      <Autocomplete
        options={options}
        // Tell TypeScript how to get the text label for each option
        getOptionLabel={(option) => option.secondary_title || option.primary_title}
        // Custom rendering for each option in the dropdown
        renderOption={(props, option) => (
          <Box component="li" sx={{ '& > img': { mr: 2, flexShrink: 0 } }} {...props}>
            <img loading="lazy" width="40" src={option.cover_image_url || ''} alt="" />
            {option.secondary_title || option.primary_title} ({option.media_type})
          </Box>
        )}
        // When the user selects an option
        onChange={(_event, value) => {
          if (value) {
            handleAddItem(value); 
          }
        }}
        // When the user types in the box
        onInputChange={(_event, newInputValue) => {
          debouncedSearch(newInputValue);
        }}
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

      {/* --- The Library Accordion View --- */}
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
                    <Card key={item.id} sx={{ display: 'flex', alignItems: 'center', padding: 1, '&:hover': { outline: '2px solid', outlineColor: 'primary.main' }}}>
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