const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json());

// Socket.io Connection
const ChatRoom = require('./models/ChatRoom');

// Initialize Global Hubs in DB if they don't exist
const initializeGlobalHubs = async () => {
  try {
    const hubs = [
      { roomName: 'General Travel Hub', destination: 'Worldwide', inviteCode: 'GLOBAL' },
      { roomName: 'World Cup 2030 Hub', destination: 'Morocco', inviteCode: 'WC2030' },
      { roomName: 'Backpackers Hub', destination: 'Global', inviteCode: 'BUDGET' }
    ];

    for (const hub of hubs) {
      const exists = await ChatRoom.findOne({ inviteCode: hub.inviteCode });
      if (!exists) {
        await ChatRoom.create({ 
          ...hub, 
          startDate: new Date(), 
          endDate: new Date('2031-01-01') 
        });
        console.log(`Initialized Global Hub: ${hub.roomName}`);
      }
    }
  } catch (err) {
    console.error('Failed to initialize global hubs:', err.message);
  }
};
initializeGlobalHubs();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User joined room ${roomId}`);
  });

  socket.on('send_message', async (data) => {
    try {
      const { roomId, sender, text } = data;
      
      // Save message to database
      await ChatRoom.findByIdAndUpdate(roomId, {
        $push: { messages: { sender, text, timestamp: new Date() } }
      });
      
      // Broadcast to everyone in the room
      io.to(roomId).emit('receive_message', data);
    } catch (err) {
      console.error('Socket Error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Routes
const tripRoutes = require('./routes/trips');
const searchRoutes = require('./routes/search');
const chatRoutes = require('./routes/chat');
const authRoutes = require('./routes/auth');
const worldcupRoutes = require('./routes/worldcup');
const livemapRoutes = require('./routes/livemap');

app.use('/api/trips', tripRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/worldcup', worldcupRoutes);
app.use('/api/livemap', livemapRoutes);

app.get('/', (req, res) => {
  res.send('TravelAI Backend API is running');
});

// MongoDB Connection
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
