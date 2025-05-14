const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', // Allow requests from Next.js dev server
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
fs.mkdir(dataDir, { recursive: true }).catch(err => {
  console.error('Could not create data directory:', err);
});

// Get note
app.get('/api/notes/:id', async (req, res) => {
  try {
    const noteId = req.params.id;
    
    // Validate note ID format (alphanumeric only)
    if (!noteId.match(/^[a-zA-Z0-9]+$/)) {
      return res.status(400).json({ error: 'Invalid note ID format' });
    }
    
    const notePath = path.join(dataDir, `${noteId}.json`);
    
    try {
      const data = await fs.readFile(notePath, 'utf8');
      const acceptHeader = req.get('Accept');
      const note = JSON.parse(data);
      if (acceptHeader && acceptHeader.includes('application/json')) {
          // Send JSON response as before
          return res.json(note);
      } else {
          // Send just the content as plain text
          res.set('Content-Type', 'text/plain');
          return res.send(note.content);
      }      
    } catch (err) {
      // If file doesn't exist, return empty content
      if (err.code === 'ENOENT') {
        return res.json({ content: '' });
      }
      throw err;
    }
  } catch (err) {
    console.error('Error getting note:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save note
app.post('/api/notes/:id', async (req, res) => {
  try {
    const noteId = req.params.id;
    const content = req.body.content;
    
    // Validate note ID format (alphanumeric only)
    if (!noteId.match(/^[a-zA-Z0-9]+$/)) {
      return res.status(400).json({ error: 'Invalid note ID format' });
    }
    
    const notePath = path.join(dataDir, `${noteId}.json`);
    await fs.writeFile(notePath, JSON.stringify({ content, updated: new Date() }));
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving note:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Existing Note IDs
app.get('/api/notes', async (req, res) => {
  try {
    const files = await fs.readdir(dataDir);
    const noteIds = files
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));
    
    res.json({ ids: noteIds });
  } catch (err) {
    console.error('Error getting note IDs:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve the main app for all other routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Notes server running on port ${PORT}`);
  console.log(`Access the app at http://localhost:${PORT}`);
});