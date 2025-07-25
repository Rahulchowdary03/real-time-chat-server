const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users and their rooms
const users = {}; // { socketId: { username, room } }

// Handle WebSocket connections
io.on('connection', (socket) => {
    // Handle user joining a room
    socket.on('join', ({ username, room }) => {
        users[socket.id] = { username, room };
        socket.join(room); // Join the specified room
        socket.broadcast.to(room).emit('message', {
            user: 'System',
            text: `${username} has joined the room ${room}!`,
            timestamp: new Date().toLocaleTimeString(),
            room
        });
        // Send user list for the room
        const roomUsers = Object.values(users)
            .filter(user => user.room === room)
            .map(user => user.username);
        io.to(room).emit('userList', roomUsers);
        // Send current room to the user
        socket.emit('setRoom', room);
    });

    // Handle room change
    socket.on('changeRoom', (newRoom) => {
        const oldRoom = users[socket.id]?.room;
        if (oldRoom) {
            socket.leave(oldRoom);
            socket.broadcast.to(oldRoom).emit('message', {
                user: 'System',
                text: `${users[socket.id].username} has left the room.`,
                timestamp: new Date().toLocaleTimeString(),
                room: oldRoom
            });
            // Update user list in old room
            const oldRoomUsers = Object.values(users)
                .filter(user => user.room === oldRoom)
                .map(user => user.username);
            io.to(oldRoom).emit('userList', oldRoomUsers);
        }
        users[socket.id].room = newRoom;
        socket.join(newRoom);
        socket.broadcast.to(newRoom).emit('message', {
            user: 'System',
            text: `${users[socket.id].username} has joined the room ${newRoom}!`,
            timestamp: new Date().toLocaleTimeString(),
            room: newRoom
        });
        // Update user list in new room
        const newRoomUsers = Object.values(users)
            .filter(user => user.room === newRoom)
            .map(user => user.username);
        io.to(newRoom).emit('userList', newRoomUsers);
        socket.emit('setRoom', newRoom);
    });

    // Handle room messages
    socket.on('chatMessage', ({ message, room }) => {
        io.to(room).emit('message', {
            user: users[socket.id].username,
            text: message,
            timestamp: new Date().toLocaleTimeString(),
            room
        });
    });

    // Handle private messages
    socket.on('privateMessage', ({ recipient, message }) => {
        const recipientId = Object.keys(users).find(
            id => users[id].username === recipient && users[id].room === users[socket.id].room
        );
        if (recipientId) {
            // Send to recipient
            io.to(recipientId).emit('message', {
                user: users[socket.id].username,
                text: message,
                timestamp: new Date().toLocaleTimeString(),
                room: users[socket.id].room,
                isPrivate: true
            });
            // Send to sender for confirmation
            socket.emit('message', {
                user: users[socket.id].username,
                text: message,
                timestamp: new Date().toLocaleTimeString(),
                room: users[socket.id].room,
                isPrivate: true
            });
        } else {
            socket.emit('message', {
                user: 'System',
                text: `User ${recipient} not found in room ${users[socket.id].room}.`,
                timestamp: new Date().toLocaleTimeString(),
                room: users[socket.id].room
            });
        }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        if (users[socket.id]) {
            const { username, room } = users[socket.id];
            socket.broadcast.to(room).emit('message', {
                user: 'System',
                text: `${username} has left the room.`,
                timestamp: new Date().toLocaleTimeString(),
                room
            });
            delete users[socket.id];
            // Update user list in the room
            const roomUsers = Object.values(users)
                .filter(user => user.room === room)
                .map(user => user.username);
            io.to(room).emit('userList', roomUsers);
        }
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});