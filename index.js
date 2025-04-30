require('dotenv').config();  // Load environment variables from .env file

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Initialize Firebase using environment variables
const serviceAccount = require(process.env.FIREBASE_CONFIG_PATH);  // Use path from .env file
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,  // Use database URL from .env file
});

const db = admin.database();

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Socket handling
io.on('connection', (socket) => {
  console.log('A user connected');

  // Handle when a user joins the chat
  socket.on('join chat', () => {
    console.log('User has joined the chat');

    // Send a welcome message to the user (you can modify this message as needed)
    socket.emit('chat message', { message: `Welcome to the chat! You joined at ${new Date().toLocaleString()}` });
  });

  // On new chat message
  socket.on('chat message', (msg) => {
    const [username, message] = msg.split(': ');

    // Timestamp when the message is sent
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

    // Save the message to Firebase
    db.ref('messages').push(messageObj);

    // Broadcast the new message to all clients
    io.emit('chat message', messageObj);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

server.listen(3000, () => {
  console.log('Listening on port 3000');
});
