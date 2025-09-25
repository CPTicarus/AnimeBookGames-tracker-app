import React, { useEffect, useState } from 'react';
import api from '../api';
import { Box, Typography, Button, TextField, List, ListItem, ListItemText, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

interface CustomList {
  id: number;
  name: string;
  entries: { id: number; user_media: number; }[];
}


interface UserMedia {
  id: number;
  media: { 
    primary_title: string; 
    secondary_title: string | null;
    cover_image_url?: string;
  };
}

function CustomListPage() {
  const [lists, setLists] = useState<CustomList[]>([]);
  const [newListName, setNewListName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [library, setLibrary] = useState<UserMedia[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState<number|null>(null);
  const [selectedEntry, setSelectedEntry] = useState<UserMedia|null>(null);

  const fetchLists = async () => {
    const res = await api.get('/api/custom-lists/');
    setLists(res.data);
  };
  const fetchLibrary = async () => {
    const res = await api.get('/api/user/list/');
    setLibrary(res.data);
  };

  useEffect(() => { fetchLists(); fetchLibrary(); }, []);

  const handleCreate = async () => {
    if (!newListName.trim()) return;
    await api.post('/api/custom-lists/', { name: newListName });
    setNewListName('');
    setDialogOpen(false);
    fetchLists();
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/api/custom-lists/${id}/`);
    fetchLists();
  };

  const handleAddEntry = async (listId: number) => {
    if (!selectedEntry) return;
    await api.post('/api/custom-list-entries/', { custom_list: listId, user_media: selectedEntry.id });
    setAddDialogOpen(null);
    setSelectedEntry(null);
    fetchLists();
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>Custom Lists</Typography>
      <Button startIcon={<AddIcon />} variant="contained" onClick={() => setDialogOpen(true)} sx={{ mb: 2 }}>New List</Button>
      <List>
        {lists.map(list => (
          <ListItem key={list.id} secondaryAction={
            <>
              <Button size="small" onClick={() => setAddDialogOpen(list.id)}>Add Entry</Button>
              <IconButton edge="end" onClick={() => handleDelete(list.id)}><DeleteIcon /></IconButton>
            </>
          }>
            <ListItemText primary={list.name} secondary={`${list.entries.length} entries`} />
          </ListItem>
        ))}
      </List>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>New Custom List</DialogTitle>
        <DialogContent>
          <TextField label="List Name" value={newListName} onChange={e => setNewListName(e.target.value)} fullWidth autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
  <Dialog open={!!addDialogOpen} onClose={() => setAddDialogOpen(null)} fullWidth maxWidth="sm">
        <DialogTitle>Add Entry to List</DialogTitle>
        <DialogContent>
            <Autocomplete
            options={library}
            getOptionLabel={(option) =>
                option.media.primary_title +
                (option.media.secondary_title ? ` (${option.media.secondary_title})` : '')
            }
            onChange={(_e, v) => setSelectedEntry(v)}
            renderOption={(props, option) => (
                <li {...props} key={option.id}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {option.media.cover_image_url && (
                    <img
                        src={option.media.cover_image_url}
                        alt={option.media.primary_title}
                        style={{
                        width: 40,
                        height: 60,
                        objectFit: 'cover',
                        borderRadius: 4,
                        marginRight: 10,
                        }}
                    />
                    )}
                    <Box>
                    <Typography variant="body1">
                        {option.media.primary_title}
                    </Typography>
                    {option.media.secondary_title && (
                        <Typography variant="body2" color="text.secondary">
                        {option.media.secondary_title}
                        </Typography>
                    )}
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontStyle: 'italic' }}
                    >
                    </Typography>
                    </Box>
                </Box>
                </li>
            )}
            renderInput={(params) => (
                <TextField {...params} label="Select entry from your library" />
            )}
            />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(null)}>Cancel</Button>
          <Button onClick={() => handleAddEntry(addDialogOpen!)} variant="contained" disabled={!selectedEntry}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default CustomListPage;
