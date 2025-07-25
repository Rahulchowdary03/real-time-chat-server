
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users
const users = {};

// Handle WebSocket connections
io.on('connection', (socket) => {
    // Handle new user joining
    socket.on('join', (username) => {
        users[socket.id] = username;
        socket.broadcast.emit('message', {
            user: 'System',
            text: `${username} has joined the chat!`,
            timestamp: new Date().toLocaleTimeString()
        });
        // Send user list to all clients
        io.emit('userList', Object.values(users));
    });

    // Handle incoming messages
    socket.on('chatMessage', (msg) => {
        io.emit('message', {
            user: users[socket.id],
            text: msg,
            timestamp: new Date().toLocaleTimeString()
        });
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        if (users[socket.id]) {
            socket.broadcast.emit('message', {
                user: 'System',
                text: `${users[socket.id]} has left the chat.`,
                timestamp: new Date().toLocaleTimeString()
            });
            delete users[socket.id];
            io.emit('userList', Object.values(users));
        }
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});