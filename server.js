const express = require('express');
const next = require('next');
const path = require('path');
const fs = require('fs/promises');
const cors = require('cors');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();
const app = express();
const PORT = process.env.PORT || 4000;

nextApp.prepare().then(() => {
  // Middleware
  app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  }));
  app.use(express.json());
  app.use('/_next/static', express.static(path.join(__dirname, '.next/static')));
  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, 'data');
  fs.mkdir(dataDir, { recursive: true }).catch(err => {
    console.error('Could not create data directory:', err);
  });``

  // API routes
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
      
      // Create data directory if it doesn't exist (for new installations)
      await fs.mkdir(path.dirname(notePath), { recursive: true });
      
      // Write the file
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

      res.json(noteIds);
    } catch (err) {
      console.error('Error getting note IDs:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  // Handle all other routes with Next.js
  app.all('/', (req, res) => {
    console.log(`Request URL: ${req.url}`);
    //return handle(req, res);
    return nextApp.render(req, res, '/');
  });

  app.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Error starting server:', err);
  process.exit(1);
});