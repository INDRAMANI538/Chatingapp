require('dotenv').config();  // Load environment variables from .env file

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ✅ Initialize Firebase using environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.database();

// ✅ Serve static files from "public" folder
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from public folder
app.use(express.json());  // Middleware to parse JSON

// ✅ Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html')); // Serve login page
});

app.get('/chat', (req, res) => {
  // Authenticate the user before serving the chat page
  const idToken = req.headers.authorization?.split('Bearer ')[1];

  if (!idToken) {
    return res.redirect('/'); // If no token, redirect to login
  }

  admin.auth().verifyIdToken(idToken)
    .then((decodedToken) => {
      // If token is valid, serve the chat page
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    })
    .catch((error) => {
      console.error('Error verifying ID token:', error);
      res.redirect('/'); // If token is invalid, redirect to login
    });
});

// ✅ Socket.IO logic
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('join chat', () => {
    console.log('User has joined the chat');
    socket.emit('chat message', {
      message: `Welcome to the chat! You joined at ${new Date().toLocaleString()}`
    });
  });

  socket.on('chat message', (msg) => {
    const [username, message] = msg.split(': ');
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
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// ✅ Start server
server.listen(3000, () => {
  console.log('Listening on port 3000');
});
