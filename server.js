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
    allowedHeaders: ['Content-Type', 'If-Match', 'If-None-Match'],
    exposedHeaders: ['ETag']
  }));
  app.use(express.json());
  app.use('/_next/static', express.static(path.join(__dirname, '.next/static')));
  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, 'data');
  fs.mkdir(dataDir, { recursive: true }).catch(err => {
    console.error('Could not create data directory:', err);
  });

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
        const note = JSON.parse(data);
        
        // Generate ETag from the last update timestamp
        const etag = `"${new Date(note.updated).getTime()}"`;
        
        // Check If-None-Match header
        const ifNoneMatch = req.get('If-None-Match');
        if (ifNoneMatch && ifNoneMatch === etag) {
          return res.status(304).end();
        }

        res.set('ETag', etag);
        const acceptHeader = req.get('Accept');
        
        if (acceptHeader && acceptHeader.includes('application/json')) {
          return res.json(note);
        } else {
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
      
      // Check If-Match header for concurrency control
      const ifMatch = req.get('If-Match');
      console.log(`match passed: ${ifMatch || 'false'}`);
      if (ifMatch) {
        try {
          const existingData = await fs.readFile(notePath, 'utf8');
          const existingNote = JSON.parse(existingData);
          const currentEtag = `"${new Date(existingNote.updated).getTime()}"`;
          
          console.log('Server Save:', ifMatch, currentEtag);
          if (ifMatch !== currentEtag) {
            console.log(`ETag mismatch, note was modified. Returning existing ETag ${currentEtag}`);
            res.set('ETag', currentEtag);
            return res.status(205).json({ message: 'Note was modified' });
          }
        } catch (err) {
          if (err.code !== 'ENOENT') {
            throw err;
          }
          // File doesn't exist yet, that's okay for new notes
        }
      }
      
      const now = new Date();
      // Write the file
      const updated = now;
      await fs.writeFile(notePath, JSON.stringify({ content, updated }));
      console.log(`File updated: ${updated.getTime()}`);
      // Return new ETag
      const newEtag = `"${now.getTime()}"`;
      res.set('ETag', newEtag);
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

  app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'app', 'favicon.ico'));
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