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

// Trust proxy so req.ip resolves correctly behind reverse proxies / Vite dev,
// allowing the admin dashboard to capture real client IPs.
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json());

// API usage tracker — must come before routes so it sees every /api/* call.
const apiTracker = require('./services/apiTracker');
app.use(apiTracker.middleware());

// Socket.io Connection
const ChatRoom = require('./models/ChatRoom');
const onlineTracker = require('./services/onlineTracker');

// Initialize Global Hubs in DB if they don't exist.
// We upsert and force-update the categorization flags so existing DBs
// get backfilled with isGlobalDefault / isWorldCupFanRoom on every boot.
const initializeGlobalHubs = async () => {
  try {
    const hubs = [
      {
        roomName: 'General Travel Hub',
        destination: 'Worldwide',
        description: 'The home base for every TravelAI member. Share trips, ask questions, meet other travelers.',
        inviteCode: 'GLOBAL',
        isGlobalDefault: true,
        isWorldCupFanRoom: false
      },
      {
        roomName: 'Backpackers Hub',
        destination: 'Global',
        description: 'Budget travel, hostels, long-haul routes and money-saving tips from the road.',
        inviteCode: 'BUDGET',
        isGlobalDefault: false,
        isWorldCupFanRoom: false
      },
      {
        roomName: 'World Cup 2030 Fan Room',
        destination: 'Morocco · Spain · Portugal',
        description: 'Match-day meetups, fan zones, host-city tips and tickets coordination for FIFA 2030.',
        inviteCode: 'WC2030',
        isGlobalDefault: false,
        isWorldCupFanRoom: true
      }
    ];

    for (const hub of hubs) {
      await ChatRoom.findOneAndUpdate(
        { inviteCode: hub.inviteCode },
        {
          $set: {
            roomName: hub.roomName,
            destination: hub.destination,
            description: hub.description,
            isGlobalDefault: hub.isGlobalDefault,
            isWorldCupFanRoom: hub.isWorldCupFanRoom
          },
          $setOnInsert: {
            startDate: new Date(),
            endDate: new Date('2031-01-01')
          }
        },
        { upsert: true, new: true }
      );
    }
    console.log('Global hubs initialized / synced.');
  } catch (err) {
    console.error('Failed to initialize global hubs:', err.message);
  }
};

io.on('connection', (socket) => {
  // Register the new socket immediately so the admin dashboard's "online"
  // count is correct for guests as well as authenticated users. The client
  // can later call `identify` to attach a userId/name once logged in.
  onlineTracker.register(socket);

  socket.on('identify', (info = {}) => {
    onlineTracker.identify(socket.id, {
      userId: info.userId || null,
      name: info.name || 'Guest'
    });
  });

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
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
    onlineTracker.remove(socket.id);
  });
});

// Routes
const tripRoutes = require('./routes/trips');
const searchRoutes = require('./routes/search');
const chatRoutes = require('./routes/chat');
const authRoutes = require('./routes/auth');
const worldcupRoutes = require('./routes/worldcup');
const livemapRoutes = require('./routes/livemap');
const adminRoutes = require('./routes/admin');

app.use('/api/trips', tripRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/worldcup', worldcupRoutes);
app.use('/api/livemap', livemapRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.send('TravelAI Backend API is running');
});

// MongoDB Connection
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await initializeGlobalHubs();
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
