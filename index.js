require('dotenv').config();  // Load environment variables from .env file

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ✅ Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.database();

// ✅ Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ✅ Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/chat', (req, res) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];

  if (!idToken) return res.redirect('/');

  admin.auth().verifyIdToken(idToken)
    .then(() => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    })
    .catch((error) => {
      console.error('Error verifying ID token:', error);
      res.redirect('/');
    });
});

// ✅ Socket.IO logic with userName support
io.on('connection', (socket) => {
  const userName = socket.handshake.query.userName || 'Unknown User';

  console.log(`${userName} connected`);

  socket.on('disconnect', () => {
    console.log(`${userName} disconnected`);
  });

  socket.on('join chat', () => {
    console.log(`${userName} joined the chat`);
    socket.emit('chat message', {
      message: `Welcome ${userName}! You joined at ${new Date().toLocaleString()}`
    });
  });

  socket.on('chat message', (msg) => {
    // Ensure msg is an object containing username and message
    if (typeof msg === 'object' && msg.username && msg.message) {
      const { username, message } = msg;
      const timestamp = new Date();
      const isoTime = timestamp.toISOString();
      const readableTime = timestamp.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      const messageObj = {
        username,
        message,
        timestamp: isoTime,
        readableTime
      };

      // Save to Firebase
      db.ref('messages').push(messageObj);

      // Send to all connected clients
      io.emit('chat message', messageObj);
    } else {
      console.error('Invalid message format:', msg);  // Only log error if the message format is invalid
    }
  });
});

// ✅ Start server
server.listen(3000, () => {
  console.log('Listening on port 3000');
});
