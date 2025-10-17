require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.database();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

const userMap = new Map(); // socket.id -> { name, id }

io.on('connection', (socket) => {
  const rawUserName = socket.handshake.query.userName || 'Unknown User';
  const userName = rawUserName.split('@')[0];
  let uniqueID = Math.floor(1000 + Math.random() * 9000);
  while ([...userMap.values()].some(u => u.id === uniqueID)) {
    uniqueID = Math.floor(1000 + Math.random() * 9000);
  }

  userMap.set(socket.id, { name: userName, id: uniqueID });
  socket.userName = userName;
  socket.userID = uniqueID;

  console.log(`${userName} connected with ID ${uniqueID}`);
  socket.emit('your id', { id: uniqueID });

  socket.join('global');
  socket.emit('chat message', {
    username: 'System',
    message: `Welcome ${userName}! Your ID is ${uniqueID}`,
    timestamp: new Date().toISOString()
  });

  socket.on('chat message', (msg) => {
    if (!msg || !msg.message) return;
    const messageObj = {
      username: userName,
      message: msg.message,
      timestamp: new Date().toISOString(),
    };

    if (msg.privateTo) {
      const targetSocket = [...io.sockets.sockets.values()].find(s => s.userID == msg.privateTo);
      if (targetSocket) {
        [socket, targetSocket].forEach(s => 
          s.emit('private message', { ...messageObj, fromID: socket.userID, toID: targetSocket.userID })
        );
      } else {
        socket.emit('chat message', {
          username: 'System',
          message: `User with ID ${msg.privateTo} not found or offline.`,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      io.to('global').emit('chat message', messageObj);
      db.ref('messages').push(messageObj);
    }
  });

  // ✅ Private chat request handling
  socket.on('private request', (data) => {
    console.log(`User ${socket.userID} requested chat with ${data.toID}`);
    const targetSocket = [...io.sockets.sockets.values()].find(s => s.userID == data.toID);
    if (targetSocket) {
      targetSocket.emit('private request', { fromID: socket.userID });
    } else {
      socket.emit('private declined', { toID: data.toID });
    }
  });

  socket.on('private accept', (data) => {
    console.log(`User ${socket.userID} accepted chat with ${data.fromID}`);
    const targetSocket = [...io.sockets.sockets.values()].find(s => s.userID == data.fromID);
    if (targetSocket) {
      [socket, targetSocket].forEach(s =>
        s.emit('private accepted', { user1: socket.userID, user2: targetSocket.userID })
      );
    }
  });

  socket.on('private decline', (data) => {
    console.log(`User ${socket.userID} declined chat with ${data.fromID}`);
    const targetSocket = [...io.sockets.sockets.values()].find(s => s.userID == data.fromID);
    if (targetSocket) {
      targetSocket.emit('private declined', { toID: socket.userID });
    }
  });

  socket.on('disconnect', () => {
    console.log(`${userName} (ID ${uniqueID}) disconnected`);
    userMap.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});
