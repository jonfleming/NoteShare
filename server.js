const express = require('express');
const next = require('next');
const path = require('path');
const fs = require('fs/promises');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();
const app = express();
const server = http.createServer(app);
const allowedOrigins = ['http://localhost:3000', 'https://notes.jonfleming.com'];
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;

// Keep track of connected clients by noteId
const connectedClients = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  let currentNoteId = null;

  socket.on('join-note', (noteId) => {
    console.log(`Client ${socket.id} joined note: ${noteId}`);
    
    // Leave previous note room if any
    if (currentNoteId) {
      socket.leave(currentNoteId);
      const clients = connectedClients.get(currentNoteId) || new Set();
      clients.delete(socket.id);
      if (clients.size === 0) {
        connectedClients.delete(currentNoteId);
      } else {
        connectedClients.set(currentNoteId, clients);
      }
    }

    // Join new note room
    socket.join(noteId);
    currentNoteId = noteId;
    
    // Add to connected clients
    const clients = connectedClients.get(noteId) || new Set();
    clients.add(socket.id);
    connectedClients.set(noteId, clients);

    // Notify other clients about the new connection
    socket.to(noteId).emit('user-joined', {
      userId: socket.id,
      activeUsers: Array.from(clients)
    });
  });

  socket.on('content-change', ({ noteId, content, cursorPosition }) => {
    // Broadcast the change to all other clients viewing this note
    console.log(`Content change in note ${noteId} by ${socket.id}`);
    socket.to(noteId).emit('content-update', {
      userId: socket.id,
      content,
      cursorPosition
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (currentNoteId) {
      const clients = connectedClients.get(currentNoteId);
      if (clients) {
        clients.delete(socket.id);
        if (clients.size === 0) {
          connectedClients.delete(currentNoteId);
        } else {
          // Notify remaining clients about the disconnection
          socket.to(currentNoteId).emit('user-left', {
            userId: socket.id,
            activeUsers: Array.from(clients)
          });
        }
      }
    }
  });
});

nextApp.prepare().then(() => {
  // Middleware
  app.use(cors({
    origin: (origin, callback) => {
      console.log('CORS origin:', origin);
      if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
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
      
      const now = new Date();
      const updated = now;
      await fs.writeFile(notePath, JSON.stringify({ content, updated }));
      console.log(`File updated: ${updated.getTime()}`);
      
      // Return new ETag
      const newEtag = `"${now.getTime()}"`;
      res.set('ETag', newEtag);

      // Notify all clients except the sender about the successful save
      io.to(noteId).emit('note-saved', {
        noteId,
        eTag: newEtag,
        timestamp: now.getTime()
      });

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

  server.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Error starting server:', err);
  process.exit(1);
});