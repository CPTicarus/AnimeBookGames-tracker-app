import { useState, useEffect } from 'react';
import api from '../api';
import { 
  Card, CardMedia, Stack, Typography, Box, Accordion, AccordionSummary, AccordionDetails, 
  TextField, Button, CardContent, CardActions 
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Update the Media interface for search results
interface Media { 
  id: number; 
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

  // --- NEW: State for the search functionality ---
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Media[]>([]);
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

  useEffect(() => {
    fetchLibrary();
  }, []);

  // --- NEW: Handler for the search button ---
  const handleSearch = async () => {
    if (!query.trim()) {
      setSearchResults([]); // Clear results if query is empty
      return;
    }
    setSearchLoading(true);
    setMessage('');
    try {
      const response = await api.get(`/api/search/?q=${query}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error("Search failed", error);
      setMessage('Search failed.');
    } finally {
      setSearchLoading(false);
    }
  };

  // --- NEW: Handler for the "Add to Library" button ---
  const handleAddItem = async (mediaId: number) => {
    try {
      const response = await api.post('/api/list/add/', { media_id: mediaId });
      setMessage(response.data.success || response.data.message);
      if (response.status === 201) {
        fetchLibrary(); // Refresh the library list to show the new item
      }
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Failed to add item.');
    }
  };

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
  
  const hasSearchResults = searchResults.length > 0 || (query.trim() !== '' && !searchLoading);

  return (
    <div>
      {/* Search Bar is always on top */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <TextField 
          label="Search to add new items..." 
          variant="outlined" 
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button variant="contained" onClick={handleSearch} disabled={searchLoading}>
          {searchLoading ? '...' : 'Search'}
        </Button>
      </Box>

      {message && <Typography sx={{ mb: 2, color: 'primary.main' }}>{message}</Typography>}

      {/* Conditionally render Search Results OR the Library */}
      {hasSearchResults ? (
        // --- NEW: Search Results View (using Flexbox, not Grid) ---
        <div>
          <h1>Search Results for "{query}"</h1>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {searchResults.map((item) => (
              <Box key={`${item.media_type}-${item.id}`} sx={{ width: { xs: '100%', sm: '48%', md: '31%', lg: '23%' } }}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardMedia component="img" sx={{ aspectRatio: '2/3' }} image={item.cover_image_url || ''} />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography gutterBottom variant="h6">{item.secondary_title || item.primary_title}</Typography>
                    <Typography variant="body2" color="text.secondary">Type: {item.media_type}</Typography>
                  </CardContent>
                  <CardActions>
                    <Button size="small" onClick={() => handleAddItem(item.id)}>Add to Library</Button>
                  </CardActions>
                </Card>
              </Box>
            ))}
          </Box>
        </div>
      ) : (
        <div>
          <h1>Your Media List</h1>
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
      )}
    </div>
  );
}

export default LibraryPage;