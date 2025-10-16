require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.database();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/chat', (req, res) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];

  if (!idToken) return res.redirect('/');

  admin.auth().verifyIdToken(idToken)
    .then(() => res.sendFile(path.join(__dirname, 'public', 'index.html')))
    .catch((error) => {
      console.error('Error verifying ID token:', error);
      res.redirect('/');
    });
});

// Socket.IO
io.on('connection', (socket) => {
  const rawUserName = socket.handshake.query.userName || 'Unknown User';
  const userName = rawUserName.split('@')[0]; // friendly name
  socket.userName = userName;

  console.log(`${userName} connected`);

  socket.on('disconnect', () => {
    console.log(`${userName} disconnected`);
  });

  // Join global chat
  socket.on('join chat', () => {
    console.log(`${userName} joined the chat`);
    socket.join('global');

    socket.emit('chat message', {
      username: userName,
      message: `Welcome ${userName}! You joined at ${new Date().toLocaleString()}`,
      timestamp: new Date().toISOString()
    });
  });

  // Handle messages
  socket.on('chat message', (msg) => {
    if (typeof msg !== 'object' || !msg.message) return console.error('Invalid message format:', msg);

    const timestamp = new Date();
    const messageObj = {
      username: userName,
      message: msg.message,
      timestamp: timestamp.toISOString(),
      readableTime: timestamp.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    };

    // Save to Firebase
    db.ref('messages').push(messageObj);

    // Private message if target user specified
    if (msg.privateTo) {
      const targetSocket = [...io.sockets.sockets.values()].find(s => s.userName === msg.privateTo);
      if (targetSocket) {
        [socket, targetSocket].forEach(s => s.emit('chat message', { ...messageObj, private: true }));
      }
    } else {
      // Broadcast global
      io.to('global').emit('chat message', messageObj);
    }
  });
});

// ✅ Use dynamic port for OneRender
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
