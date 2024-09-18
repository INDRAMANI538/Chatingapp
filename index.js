const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let messages = []; // Array to store chat history

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Handle socket connection
io.on('connection', (socket) => {
  console.log('A user connected');
  
  // Send all previous messages to the new user
  socket.emit('previous messages', messages);

  // Handle message event
  socket.on('chat message', (msg) => {
    messages.push(msg); // Store message in chat history
    io.emit('chat message', msg); // Broadcast message to all users
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

server.listen(3000, () => {
  console.log('Listening on port 3000');
});
