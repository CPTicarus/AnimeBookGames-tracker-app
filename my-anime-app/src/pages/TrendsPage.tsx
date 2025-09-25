// src/pages/TrendsPage.tsx
import { useState, useEffect } from 'react';
import api from '../api';
import { Box, Typography, Card, CardMedia, CircularProgress,
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    TextField, Select, MenuItem, FormControl, InputLabel, Stack,
    Divider, Paper, Grid, IconButton
 } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Extend TrendItem so we know the media type
interface TrendItem {
  id: number;
  title: string;
  cover_image_url: string;
  media_type: string;
  api_source: string;
}

const TrendRow = ({
  title,
  items,
  onClick,
  expanded,
  onToggle,
}: {
  title: string,
  items: TrendItem[],
  onClick: (item: TrendItem) => void,
  expanded: boolean,
  onToggle: () => void,
}) => {
  const visibleCount = expanded ? 15 : 6;
  const visibleItems = items.slice(0, visibleCount);

  return (
    <Paper sx={{ mb: 4, p: 2, borderRadius: 3 }} elevation={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{title}</Typography>
        <IconButton onClick={onToggle} aria-label={expanded ? 'Collapse' : 'Expand'} size="small">
          <ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </IconButton>
      </Box>
      <Box sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: 'repeat(3, 1fr)',
          md: 'repeat(4, 1fr)',
          lg: 'repeat(6, 1fr)'
        }
      }}>
        {visibleItems.map(item => (
          <Box key={item.id}>
            <Card
              sx={{ cursor: 'pointer', borderRadius: 2, overflow: 'hidden', transition: 'transform .15s, box-shadow .15s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 } }}
              onClick={() => onClick(item)}
            >
              <CardMedia
                component="img"
                sx={{ aspectRatio: '2/3' }}
                image={item.cover_image_url || 'https://via.placeholder.com/300x450?text=No+Image'}
              />
            </Card>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

function TrendsPage() {
  const [trends, setTrends] = useState<Record<string, TrendItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // --- Modal state ---
  const [selectedItem, setSelectedItem] = useState<TrendItem | null>(null);
  const [status, setStatus] = useState("PLANNED");
  const [score, setScore] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        const response = await api.get('/api/trends/');
        const normalizedData: Record<string, TrendItem[]> = {};

        if (response.data.ANIME) {
          normalizedData.ANIME = response.data.ANIME.map((i: any) => ({
            id: i.id,
            title: i.title.romaji,
            cover_image_url: i.coverImage.large,
            media_type: "ANIME",
            api_source: "ANILIST",
          }));
        }
        if (response.data.MANGA) {
          normalizedData.MANGA = response.data.MANGA.map((i: any) => ({
            id: i.id,
            title: i.title.romaji,
            cover_image_url: i.coverImage.large,
            media_type: "MANGA",
            api_source: "ANILIST",
          }));
        }
        if (response.data.MOVIE) {
          normalizedData.MOVIE = response.data.MOVIE.map((i: any) => ({
            id: i.id,
            title: i.title,
            cover_image_url: `https://image.tmdb.org/t/p/w500${i.poster_path}`,
            media_type: "MOVIE",
            api_source: "TMDB",
          }));
        }
        if (response.data.TV_SHOW) {
          normalizedData.TV_SHOW = response.data.TV_SHOW.map((i: any) => ({
            id: i.id,
            title: i.name,
            cover_image_url: `https://image.tmdb.org/t/p/w500${i.poster_path}`,
            media_type: "TV_SHOW",
            api_source: "TMDB",
          }));
        }
        if (response.data.GAME) {
          normalizedData.GAME = response.data.GAME.map((i: any) => ({
            id: i.appid,
            title: i.name,
            cover_image_url: i.header_image,
            media_type: "GAME",
            api_source: "STEAM",
          }));
        }
        if (response.data.BOOK) {
          normalizedData.BOOK = response.data.BOOK.map((i: any) => ({
            id: i.id,
            title: i.volumeInfo.title,
            cover_image_url: i.volumeInfo.imageLinks?.thumbnail.replace('http://', 'https://'),
            media_type: "BOOK",
            api_source: "GOOGLEBOOKS",
          }));
        }

        setTrends(normalizedData);
      } catch (err) {
        console.error("Failed to fetch or process trends:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrends();
  }, []);

  const toggleSection = (type: string) => {
    setExpanded(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleAdd = async () => {
    if (!selectedItem) return;
    try {
      await api.post("/api/list/add/", {
        media: {
          api_id: selectedItem.id,
          api_source: selectedItem.api_source,
          media_type: selectedItem.media_type,
          primary_title: selectedItem.title,
          cover_image_url: selectedItem.cover_image_url,
        },
        status,
        score,
        progress,
      });
      setSelectedItem(null);
    } catch (err) {
      console.error("Failed to add item", err);
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold', color: 'primary.main' }}>
        Trending Now
      </Typography>
      {Object.keys(trends).length > 0 ? (
        Object.entries(trends).map(([type, items]) => (
          items.length > 0 && (
            <TrendRow
              key={type}
              title={`Trending ${type.replace('_', ' ')}`}
              items={items}
              onClick={setSelectedItem}
              expanded={Boolean(expanded[type])}
              onToggle={() => toggleSection(type)}
            />
          )
        ))
      ) : (
        <Typography>Could not load any trending data at this time.</Typography>
      )}

      {/* Modal for adding */}
      {selectedItem && (
        <Dialog open={true} onClose={() => setSelectedItem(null)} fullWidth maxWidth="xs">
          <DialogTitle>Add to Library</DialogTitle>
          <Divider />
          <DialogContent>
            <Typography variant="h6">{selectedItem.title}</Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={status} onChange={e => setStatus(e.target.value)}>
                  <MenuItem value="PLANNED">Planned</MenuItem>
                  <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                  <MenuItem value="PAUSED">Paused</MenuItem>
                  <MenuItem value="DROPPED">Dropped</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Score (0–10)"
                type="number"
                value={score || ""}
                onChange={e => setScore(Number(e.target.value))}
                inputProps={{ step: "0.1", min: 0, max: 10 }}
              />
              <TextField
                label="Progress"
                type="number"
                value={progress}
                onChange={e => setProgress(Number(e.target.value))}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedItem(null)}>Cancel</Button>
            <Button variant="contained" onClick={handleAdd}>Add</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

export default TrendsPage;