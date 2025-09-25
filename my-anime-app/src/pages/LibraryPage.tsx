import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import debounce from 'lodash.debounce';

import {
  Autocomplete, TextField, Card, CardMedia, Stack, Typography, Box,
  Accordion, AccordionSummary, AccordionDetails,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Select, MenuItem, FormControl, InputLabel,
  Chip, CircularProgress, Divider, ToggleButton, ToggleButtonGroup,
  Grid, Paper, Slider, FormLabel
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import AnimationIcon from '@mui/icons-material/Animation';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';

// Interfaces for our data
interface Media { 
  id: number;
  api_source: string;
  api_id: number;
  primary_title: string; 
  secondary_title: string | null; 
  cover_image_url: string | null;
  media_type: string;
  display_title: string;
  display_sub: string | null;
}

interface UserMedia { 
  id: number; 
  media: Media; 
  status: string; 
  progress: number; 
  score: number | null; 
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'COMPLETED': return '#4CAF50';
    case 'IN_PROGRESS': return '#2196F3';
    case 'DROPPED': return '#F44336';
    case 'PAUSED': return '#FFC107';
    case 'PLANNED': return '#9E9E9E';
    default: return 'transparent';
  }
};

interface LibraryPageProps {
  token: string;
}

function LibraryPage({ token }: LibraryPageProps) {
  // State for the user's library
  const [userMediaList, setUserMediaList] = useState<UserMedia[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  const [sources, setSources] = useState(() => ['ANIME', 'MOVIE', 'TV_SHOW']);
  // State for the Autocomplete search
  const [options, setOptions] = useState<readonly Media[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingItem, setEditingItem] = useState<UserMedia | null>(null);
  const [inputValue, setInputValue] = useState('');

  // --- State for the filters ---
  const [filterText, setFilterText] = useState('');
  const [filterTypes, setFilterTypes] = useState(() => ['ANIME', 'MANGA', 'MOVIE', 'TV_SHOW', 'GAME', 'BOOK']);
  const [scoreRange, setScoreRange] = useState<number[]>([0, 10]);

  const handleSourceChange = (_event: React.MouseEvent<HTMLElement>, newSources: string[]) => {
    if (newSources.length > 0) {
      setSources(newSources);
    }
  };

  const handleFilterTypeChange = (_event: React.MouseEvent<HTMLElement>, newTypes: string[]) => {
  if (newTypes.length) setFilterTypes(newTypes);
  };

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

  const handleAddNewItem = async (itemData: { media: Media, status: string, score: number | null, progress: number }) => {
    try {
      const response = await api.post('/api/list/add/', itemData);
      setMessage(response.data.success || response.data.message);
      if (response.status === 201) {
        fetchLibrary(); // Refresh the library list to show the new item
      }
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Failed to add item.');
    }
  };

  const debouncedSearch = useMemo(
    () =>
      debounce(
        (query: string, callback: (options: Media[]) => void, selectedSources: string[]) => {
          if (!query.trim()) {
            callback([]);
            return;
          }
          api
            .get<Media[]>(`/api/search/`, {
              params: { q: query, sources: selectedSources.join(",") },
            })
            .then((response) => callback(response.data))
            .catch(() => callback([])); // Return empty array on error
        },
        500
      ),
    []
  );

  useEffect(() => {
    fetchLibrary();
  }, [token]);

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

    if (editingItem.id) { // If it has an ID, it's an existing item, so we UPDATE
      try {
        await api.patch(`/api/list/update/${editingItem.id}/`, {
          status: editingItem.status,
          score: editingItem.score,
          progress: editingItem.progress,
        });
        handleCloseModal();
        fetchLibrary();
      } catch (err) {
        console.error("Failed to update item", err);
      }
    } else { // If it has no ID, it's a NEW item from search, so we ADD
      const newItemData = {
        media: editingItem.media,
        status: editingItem.status,
        score: editingItem.score,
        progress: editingItem.progress,
      }
      await handleAddNewItem(newItemData as any);
      handleCloseModal();
    }
  };

  const filteredList = useMemo(() => {
    return userMediaList.filter(item => {
      // Score filter (only apply if the item has a score)
      const score = item.score;
      if (score !== null && (score < scoreRange[0] || score > scoreRange[1])) {
        return false;
      }

      // Media type filter
      if (!filterTypes.includes(item.media.media_type)) {
        return false;
      }

      // Text search filter (checks both titles)
      const searchText = filterText.toLowerCase();
      if (searchText && 
          !(item.media.primary_title.toLowerCase().includes(searchText)) && 
          !(item.media.secondary_title || '').toLowerCase().includes(searchText)) {
        return false;
      }
      
      return true;
    });
    
  }, [userMediaList, filterText, filterTypes, scoreRange]);

  const groupedMedia = useMemo(() => {
    return filteredList.reduce((acc, item) => {
      const status = item.status || 'UNKNOWN';
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(item);
      return acc;
    }, {} as Record<string, UserMedia[]>);
  }, [filteredList]);

  // --- Sorting Logic (for the accordion order) ---
  const sortedGroupKeys = useMemo(() => {
    const statusOrder = ['IN_PROGRESS', 'COMPLETED', 'PAUSED', 'PLANNED', 'DROPPED'];
    return Object.keys(groupedMedia).sort((a, b) => {
      const indexA = statusOrder.indexOf(a);
      const indexB = statusOrder.indexOf(b);
      if (indexA === -1) return 1; // Put unknown statuses at the end
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [groupedMedia]);

  useEffect(() => {
    if (inputValue === "") {
      setOptions([]);
      return;
    }
    setSearchLoading(true);
    debouncedSearch(inputValue, (newOptions) => {
      setSearchLoading(false);
      setOptions(
        newOptions.map((item) => ({
          ...item,
          display_title: item.primary_title || item.secondary_title || "Untitled",
          display_sub: item.secondary_title || "",
        }))
      );
    }, sources);
  }, [inputValue, sources, debouncedSearch]);

  return (
    <Box sx={{ display: "flex", height: "100%", p: 2, bgcolor: 'background.default' }}>
      {/* === LEFT SIDEBAR === */}
      <Paper sx={{ width: 240, p: 2, display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, alignSelf: 'flex-start' }}>
        <Typography variant="h6">Filters</Typography>
        <TextField label="Filter by name..." 
          value={filterText} 
          onChange={(e) => setFilterText(e.target.value)} 
          size="small"
        />
        <Box>
            <FormLabel>Media Type</FormLabel>
            <ToggleButtonGroup orientation="vertical" value={filterTypes} onChange={handleFilterTypeChange} fullWidth>
                <ToggleButton value="ANIME"><AnimationIcon sx={{mr: 1}}/> </ToggleButton>
                <ToggleButton value="MANGA"><AutoStoriesIcon sx={{mr: 1}}/> </ToggleButton>
                <ToggleButton value="MOVIE"><MovieIcon sx={{mr: 1}}/> </ToggleButton>
                <ToggleButton value="TV_SHOW"><TvIcon sx={{mr: 1}}/> </ToggleButton>
                <ToggleButton value="GAME"><SportsEsportsIcon sx={{mr: 1}}/> </ToggleButton>
                <ToggleButton value="BOOK"><MenuBookIcon sx={{mr: 1}}/> </ToggleButton>
            </ToggleButtonGroup>
        </Box>
        <Box>
            <FormLabel>Score Range</FormLabel>
            <Slider value={scoreRange} onChange={(_, newValue) => setScoreRange(newValue as number[])} valueLabelDisplay="auto" min={0} max={10} step={0.1}/>
        </Box>
      </Paper>

      {/* === RIGHT MAIN CONTENT === */}
      <Box sx={{ flexGrow: 1, pl: 3 }}>

        <ToggleButtonGroup
          value={sources}
          onChange={handleSourceChange}
          aria-label="search sources"
          size="small"
          sx={{ mb: 2, display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <ToggleButton value="ANIME" aria-label="anime">
            <AnimationIcon sx={{ mr: 1 }} /> Anime
          </ToggleButton>
          <ToggleButton value="MANGA" aria-label="manga">
            <AutoStoriesIcon sx={{ mr: 1 }} /> Manga
          </ToggleButton>
          <ToggleButton value="MOVIE" aria-label="movies">
            <MovieIcon sx={{ mr: 1 }} /> Movies
          </ToggleButton>
          <ToggleButton value="TV_SHOW" aria-label="tv shows">
            <TvIcon sx={{ mr: 1 }} /> TV Shows
          </ToggleButton>
          <ToggleButton value="GAME" aria-label="games">
            <SportsEsportsIcon sx={{ mr: 1 }} /> Games
          </ToggleButton>
          <ToggleButton value="BOOK" aria-label="books">
            <MenuBookIcon sx={{ mr: 1 }} /> Books
          </ToggleButton>
        </ToggleButtonGroup>

        <Autocomplete
          options={options}
          getOptionLabel={(option) => option.display_title}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.api_id}>
              <img
                loading="lazy"
                width="40"
                src={option.cover_image_url || ''}
                alt=""
                style={{ marginRight: 8, borderRadius: 4 }}
              />
              <Typography variant="body2">
                {option.display_title}
                {option.display_sub && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {" – "}{option.display_sub}
                  </Typography>
                )}
                <Typography component="span" variant="caption" color="text.secondary">
                  {" "}({option.media_type})
                </Typography>
              </Typography>
            </Box>
          )}
          onChange={(_event, value) => {
            if (value) {
              const newItem: UserMedia = {
                id: 0,
                media: value,
                status: 'PLANNED',
                score: null,
                progress: 0,
              };
              handleOpenModal(newItem);
              setInputValue('');
              setOptions([]);
            }
          }}
          onInputChange={(_event, newInputValue) => {
            setInputValue(newInputValue);
            setSearchLoading(true);
            debouncedSearch(newInputValue, (newOptions) => {
              setSearchLoading(false);
              setOptions(newOptions);
            }, sources);
          }}
          inputValue={inputValue}
          loading={searchLoading}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search and add media..."
              fullWidth
              size="small"
              sx={{ mb: 3 }} // spacing below
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

        <Typography
          variant="h4"
          sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}
        >
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
                          <Typography variant="h6">
                            {item.media.primary_title || item.media.secondary_title}
                          </Typography>
                          {item.media.secondary_title && (
                            <Typography variant="body2" color="text.secondary">
                              {item.media.secondary_title}
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

        {editingItem && (
          <Dialog open={!!editingItem} onClose={handleCloseModal} fullWidth maxWidth="xs">
            {/* Title section with cover image */}
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              {editingItem.media.cover_image_url && (
                <img
                  src={editingItem.media.cover_image_url}
                  alt={editingItem.media.primary_title}
                  style={{
                    width: 50,
                    height: 70,
                    borderRadius: 4,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              )}
              <Typography variant="h6">
                {editingItem.media.secondary_title || editingItem.media.primary_title}
              </Typography>
            </DialogTitle>
            <Divider />

            {/* Content */}
            <DialogContent>
              <Stack spacing={3} sx={{ mt: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={editingItem.status || ""}
                    label="Status"
                    onChange={handleFormChange}
                  >
                    <MenuItem value="IN_PROGRESS">In Progress</MenuItem> 
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
                  value={editingItem.score || ""}
                  onChange={handleFormChange}
                  inputProps={{ step: "0.1", min: 0, max: 10 }}
                />
                <TextField
                  name="progress"
                  label="Progress"
                  type="number"
                  value={editingItem.progress || ""}
                  onChange={handleFormChange}
                />
              </Stack>
            </DialogContent>

            {/* Actions: Cancel | Delete | Save */}
            <DialogActions>
              <Button onClick={handleCloseModal}>Cancel</Button>
              <Button
                onClick={async () => {
                  try {
                    await api.delete(`/api/list/delete/${editingItem.id}/`);
                    handleCloseModal();
                    fetchLibrary(); // refresh after delete
                  } catch (err) {
                    console.error("Failed to delete item", err);
                  }
                }}
                color="error"
              >
                Delete
              </Button>
              <Button onClick={handleSaveChanges} variant="contained">
                Save
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </Box>
    </Box>
  );
}

export default LibraryPage;