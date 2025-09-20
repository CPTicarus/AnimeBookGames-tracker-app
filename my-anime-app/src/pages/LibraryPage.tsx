import { useState, useEffect } from 'react';
import api from '../api';
import { Card, CardMedia, Stack, Typography, Box, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Interfaces remain the same
interface Media { id: number; primary_title: string; secondary_title: string | null; cover_image_url: string | null; }
interface UserMedia { id: number; media: Media; status: string; progress: number; score: number | null; }

// Helper to get the right color for the status dot
const getStatusColor = (status: string) => {
  switch (status) {
    case 'COMPLETED': return '#4CAF50'; // Green
    case 'WATCHING': return '#2196F3'; // Blue
    case 'DROPPED': return '#F44336'; // Red
    case 'PAUSED': return '#FFC107'; // Amber
    case 'PLANNED': return '#9E9E9E'; // Grey
    default: return 'transparent';
  }
};

function LibraryPage() {
  const [userMediaList, setUserMediaList] = useState<UserMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await api.get('/api/user/list/');
        setUserMediaList(response.data);
      } catch (err) {
        console.error("Failed to fetch user list", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const groupedMedia = userMediaList.reduce((acc, item) => {
    const status = item.status || 'UNKNOWN';
    if (!acc[status]) {
      acc[status] = [];
    }
    acc[status].push(item);
    return acc;
  }, {} as Record<string, UserMedia[]>);

  // --- NEW LOGIC: Define the custom order for the groups ---
  const statusOrder = ['WATCHING', 'COMPLETED', 'PAUSED', 'PLANNED', 'DROPPED'];
  const sortedGroupKeys = Object.keys(groupedMedia).sort((a, b) => {
    const indexA = statusOrder.indexOf(a);
    const indexB = statusOrder.indexOf(b);
    if (indexA === -1) return 1; // Put unknown statuses at the end
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  if (loading) return <p>Loading your library...</p>;

  return (
    <div>
      <h1>Your Media List</h1>
      {userMediaList.length === 0 ? (
        <p>Your list is empty. Go to the Import page to sync your library!</p>
      ) : (
        // --- NEW JSX: Map over the sorted groups to create accordions ---
        <Box>
          {sortedGroupKeys.map((status) => (
            <Accordion 
              key={status}
              // Have Watching and Completed open by default
              defaultExpanded={status === 'WATCHING' || status === 'COMPLETED'}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ textTransform: 'capitalize' }}>
                  {status.toLowerCase().replace('_', ' ')} ({groupedMedia[status].length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {groupedMedia[status].map((item) => (
                    // The card component itself is the same as before
                    <Card key={item.id} sx={{ display: 'flex', alignItems: 'center', padding: 1 }}>
                      <Box sx={{ width: 12, height: 12, backgroundColor: getStatusColor(item.status), borderRadius: '50%', flexShrink: 0, margin: '0 12px' }} />
                      <CardMedia component="img" sx={{ width: 60, height: 90, borderRadius: 1, flexShrink: 0 }} image={item.media.cover_image_url || 'https://via.placeholder.com/60x90?text=N/A'} alt={`Cover for ${item.media.primary_title}`} />
                      <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, marginLeft: 2 }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="h6" component="div" sx={{ lineHeight: 1.2 }}>
                            {item.media.secondary_title || item.media.primary_title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.media.secondary_title ? item.media.primary_title : ''}
                          </Typography>
                        </Box>
                        {item.score && (
                          <Typography variant="h5" component="div" sx={{ ml: 2, fontWeight: 'bold', flexShrink: 0 }}>
                            {/* Display score with one decimal place */}
                            {item.score.toFixed(1)}
                          </Typography>
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