import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Checkbox, FormControlLabel, FormGroup } from '@mui/material';
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

interface CustomListEntry {
  id: number;
  user_media: UserMedia;
  added_at: string;
}

interface CustomList {
  id: number;
  name: string;
  created_at: string;
  entries: CustomListEntry[];
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
  // --- Custom Lists State ---
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [customListsLoading, setCustomListsLoading] = useState(true);
  // Visibility state for status groups and custom lists
  const [visibleStatuses, setVisibleStatuses] = useState<Record<string, boolean>>(() => ({
    IN_PROGRESS: true,
    COMPLETED: true,
    PAUSED: true,
    PLANNED: true,
    DROPPED: true,
  }));
  const [visibleCustomLists, setVisibleCustomLists] = useState<Record<number, boolean>>({});
  // Fetch custom lists
  const fetchCustomLists = async () => {
    setCustomListsLoading(true);
    try {
      const response = await api.get('/api/custom-lists/');
      setCustomLists(response.data);
      // Initialize visibility for any new custom lists (default: visible)
      const vis: Record<number, boolean> = { ...visibleCustomLists };

      response.data.forEach((l: CustomList) => {
        if (vis[l.id] === undefined) vis[l.id] = true;
      });

      setVisibleCustomLists(vis);
    } catch (err) {
      console.error('Failed to fetch custom lists', err);
    } finally {
      setCustomListsLoading(false);
    }
  };

  // State for the user's library
  const [userMediaList, setUserMediaList] = useState<UserMedia[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  const [sources, setSources] = useState(() => ['ANIME', 'MOVIE', 'TV_SHOW', 'GAME']);
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
    fetchCustomLists();
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
        // Client-side validation: ensure score is numeric and between 0 and 10 (if provided)
        if (editingItem.score !== null && editingItem.score !== undefined) {
          const s = Number(editingItem.score);
          if (Number.isNaN(s) || s < 0 || s > 10) {
            setMessage('Score must be a number between 0 and 10.');
            return;
          }
        }


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
      // Validate before attempting to add
      if (editingItem.score !== null && editingItem.score !== undefined) {
        const s = Number(editingItem.score);
        if (Number.isNaN(s) || s < 0 || s > 10) {
          setMessage('Score must be a number between 0 and 10.');
          return;
        }
      }


      await handleAddNewItem(newItemData as any);
      handleCloseModal();
    }
  };

  // --- Custom list membership helpers (used inside edit dialog) ---
  const [listOpsPending, setListOpsPending] = useState<Record<number, boolean>>({});

  const toggleListMembership = async (listId: number, add: boolean) => {
    if (!editingItem || !editingItem.id) {
      setMessage('Save the item first to add it to custom lists.');
      return;
    }
    setListOpsPending(prev => ({ ...prev, [listId]: true }));
    try {
      if (add) {
        await api.post('/api/custom-list-entries/', { custom_list: listId, user_media: editingItem.id });
      } else {
        // find the entry id to delete
        const list = customLists.find(l => l.id === listId);
        const entry = list?.entries.find(e => e.user_media.id === editingItem.id);
        if (entry) {
          await api.delete(`/api/custom-list-entries/${entry.id}/`);
        }
      }
      // Refresh lists to keep local state consistent
      await fetchCustomLists();
    } catch (err) {
      console.error('Failed to toggle list membership', err);
      setMessage('Failed to update custom lists.');
    } finally {
      setListOpsPending(prev => ({ ...prev, [listId]: false }));
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

  // --- Virtualization: flatten grouped media + custom lists into rows ---
  interface Row {
    type: 'status' | 'item' | 'divider' | 'list-header' | 'list-item';
    status?: string;
    item?: UserMedia;
    listId?: number;
    entry?: CustomListEntry;
    label?: string;
  }

  const rows = useMemo(() => {
    const out: Row[] = [];

    // statuses and their items
    for (const status of sortedGroupKeys) {
      if (!visibleStatuses[status]) continue;
      out.push({ type: 'status', status, label: `${status.toLowerCase().replace('_', ' ')} (${groupedMedia[status].length})` });
      const items = groupedMedia[status] || [];
      for (const it of items) {
        out.push({ type: 'item', item: it });
      }
    }

    // divider between library and custom lists
    out.push({ type: 'divider' });

    // custom lists
    for (const list of customLists) {
      if (!visibleCustomLists[list.id]) continue;
      out.push({ type: 'list-header', listId: list.id, label: `${list.name} (${list.entries.length})` });
      for (const entry of list.entries) {
        out.push({ type: 'list-item', entry, listId: list.id });
      }
    }

    return out;
  }, [sortedGroupKeys, groupedMedia, visibleStatuses, customLists, visibleCustomLists]);

  // estimate heights (px) for VariableSizeList
  const getRowHeight = useCallback((index: number) => {
    const r = rows[index];
    if (!r) return 48;
    switch (r.type) {
      case 'status': return 56;
      case 'divider': return 24;
      case 'list-header': return 48;
      case 'item':
      case 'list-item':
        return 110; // card height (90 image + padding)
      default: return 48;
    }
  }, [rows]);

  // virtualization for window (page) scrolling
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 800);

  // precompute offsets
  const offsets = useMemo(() => {
    const arr: number[] = [];
    let acc = 0;
    for (let i = 0; i < rows.length; i++) {
      arr[i] = acc;
      acc += getRowHeight(i);
    }
    (arr as any).totalHeight = acc;
    return arr;
  }, [rows, getRowHeight]);

  useEffect(() => {
    const onScroll = () => setScrollTop(window.scrollY || window.pageYOffset || 0);
    const onResize = () => setViewportHeight(window.innerHeight);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const overscan = 10;
  const firstVisibleIndex = useMemo(() => {
    // binary search for first index where offsets[index] + rowHeight > scrollTop
    let low = 0, high = rows.length - 1, ans = rows.length;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const top = offsets[mid];
      const bottom = top + getRowHeight(mid);
      if (bottom >= scrollTop) {
        ans = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return Math.max(0, ans - overscan);
  }, [offsets, rows.length, scrollTop, getRowHeight]);

  const lastVisibleIndex = useMemo(() => {
    const viewBottom = scrollTop + viewportHeight;
    let low = 0, high = rows.length - 1, ans = -1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const top = offsets[mid];
      if (top <= viewBottom) {
        ans = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return Math.min(rows.length - 1, (ans === -1 ? 0 : ans) + overscan);
  }, [offsets, rows.length, scrollTop, viewportHeight]);


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
    <Box sx={{ display: "flex", p: 2, bgcolor: 'background.default' }}>
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
          <FormLabel sx={{ mt: 1 }}>Visible Lists</FormLabel>
          <FormGroup>
            {['IN_PROGRESS','COMPLETED','PAUSED','PLANNED','DROPPED'].map((s) => (
              <FormControlLabel
                key={s}
                control={<Checkbox checked={!!visibleStatuses[s]} onChange={() => setVisibleStatuses(prev => ({ ...prev, [s]: !prev[s]}))} />}
                label={s.toLowerCase().replace('_',' ')}
              />
            ))}
            {/* Custom lists toggles (show up after they are loaded) */}
            {customLists.map(list => (
              <FormControlLabel
                key={`cl-${list.id}`}
                control={<Checkbox checked={!!visibleCustomLists[list.id]} onChange={() => setVisibleCustomLists(prev => ({ ...prev, [list.id]: !prev[list.id]}))} />}
                label={`List: ${list.name}`}
              />
            ))}
          </FormGroup>
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
          // Use page/document scrolling - render a relative container with total height
          <Box sx={{ position: 'relative', width: '100%' }}>
            <div style={{ height: (offsets as any).totalHeight || 0, position: 'relative' }}>
              {rows.slice(firstVisibleIndex, lastVisibleIndex + 1).map((r, i) => {
                const index = firstVisibleIndex + i;
                const top = offsets[index];
                const key = `${r.type}-${index}`;

                if (r.type === 'status') {
                  return (
                    <div key={key} style={{ position: 'absolute', left: 0, right: 0, top }}>
                      <Chip sx={{ bgcolor: getStatusColor(r.status || ''), color: '#fff', fontWeight: 'bold' }} label={r.label} />
                    </div>
                  );
                }

                if (r.type === 'divider') {
                  return (
                    <div key={key} style={{ position: 'absolute', left: 0, right: 0, top }}>
                      <Divider sx={{ my: 1 }} />
                    </div>
                  );
                }

                if (r.type === 'list-header') {
                  return (
                    <div key={key} style={{ position: 'absolute', left: 0, right: 0, top }}>
                      <Chip sx={{ bgcolor: 'secondary.main', color: '#fff', fontWeight: 'bold' }} label={r.label} />
                    </div>
                  );
                }

                const item = r.type === 'item' ? r.item! : r.entry!.user_media;
                return (
                  <div key={key} style={{ position: 'absolute', left: 0, right: 0, top }}>
                    <Card
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
                        },
                        mx: 1,
                      }}
                    >
                      <CardMedia component="img" sx={{ width: 60, height: 90, borderRadius: 1, flexShrink: 0 }} image={item.media.cover_image_url || ''} />
                      <Box sx={{ ml: 2, flexGrow: 1 }}>
                        <Typography variant="h6">
                          {item.media.primary_title || item.media.secondary_title}
                        </Typography>
                        {item.media.secondary_title && (
                          <Typography variant="body2" color="text.secondary">{item.media.secondary_title}</Typography>
                        )}
                      </Box>
                      {item.score && (
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          {item.score.toFixed(1)}
                        </Typography>
                      )}
                    </Card>
                  </div>
                );
              })}
            </div>
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
                {/* Custom lists membership */}
                <Box>
                  <FormLabel sx={{ mb: 1 }}>Custom Lists</FormLabel>
                  {customListsLoading ? (
                    <Box display="flex" alignItems="center"><CircularProgress size={18} /></Box>
                  ) : customLists.length === 0 ? (
                    <Typography color="text.secondary">No custom lists available.</Typography>
                  ) : (
                    customLists.map((list) => {
                      const isMember = !!list.entries.find(e => e.user_media.id === editingItem.id);
                      const disabled = !editingItem.id; // can't add to list until saved
                      return (
                        <FormControlLabel
                          key={`edit-cl-${list.id}`}
                          control={<Checkbox checked={isMember} disabled={disabled || !!listOpsPending[list.id]} onChange={(_, checked) => toggleListMembership(list.id, checked)} />}
                          label={list.name}
                        />
                      );
                    })
                  )}
                  {!editingItem.id && (
                    <Typography variant="caption" color="text.secondary">Save the item first to add it to custom lists.</Typography>
                  )}
                </Box>
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
