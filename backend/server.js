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
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const planService = require('./services/planService');

// Resolves the JWT in `socket.handshake.auth.token` (or the legacy
// `query.token`) into a Mongoose user. Returns null for guests so we can
// reject them on gated events. Does NOT throw — bad tokens are just
// treated as "no user".
const userFromSocket = async (socket) => {
  try {
    const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return await User.findById(decoded.id);
  } catch (_) { return null; }
};

// Initialize Global Hubs in DB if they don't exist.
// We upsert and force-update the categorization flags so existing DBs
// get backfilled with isGlobalDefault / isWorldCupFanRoom on every boot.
const initializeGlobalHubs = async () => {
  try {
    const hubs = [
      {
        roomName: 'General Travel Hub',
        destination: 'Worldwide',
        description: 'The home base for every Travio member. Share trips, ask questions, meet other travelers.',
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
        { upsert: true, returnDocument: 'after' }
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
    if (info.userId) {
      socket.join(`user_${info.userId}`);
    }
  });

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('send_message', async (data) => {
    try {
      const { roomId, sender, text } = data;

      // Plan gate — bug fix: free users used to be able to broadcast into
      // any community room because socket events were unauthenticated.
      // Now we resolve the user from the JWT carried on the socket and
      // bail unless their effective plan unlocks `community`.
      const user = await userFromSocket(socket);
      if (!user) {
        socket.emit('send_message_error', {
          code: 'unauthorized',
          message: 'Please sign in to send messages.'
        });
        return;
      }
      // Combined gate — same rules as the HTTP `requireFeature` middleware:
      //   admin                  → pass
      //   paid + has feature     → pass
      //   paid + missing feature → block (e.g. Basic doesn't include community)
      //   free + uses left       → pass
      //   free + locked          → block
      if (!user.isAdmin) {
        const plan = planService.effectivePlan(user);
        if (planService.isPaidPlan(plan)) {
          if (!planService.userHasFeature(user, 'community')) {
            socket.emit('send_message_error', {
              code: 'feature_not_in_plan',
              feature: 'community',
              featureLabel: planService.FEATURE_LABELS.community,
              currentPlan: user.plan,
              upgradeUrl: '/billing',
              message: `Your ${user.plan} plan does not include Community Hubs. Upgrade to unlock.`
            });
            return;
          }
        } else if (planService.isFreemiumLocked(user)) {
          socket.emit('send_message_error', {
            code: 'freemium_exhausted',
            feature: 'community',
            featureLabel: planService.FEATURE_LABELS.community,
            currentPlan: 'free',
            upgradeUrl: '/billing',
            message:
              `You've used all ${user.trialLimit || 3} of your free explorations. ` +
              `Upgrade to keep chatting in Community Hubs.`
          });
          return;
        }
      }

      // Save message to database
      await ChatRoom.findByIdAndUpdate(roomId, {
        $push: { messages: { sender, text, timestamp: new Date() } }
      });

      // Broadcast to everyone in the room
      io.to(roomId).emit('receive_message', data);

      // Free users burn one of their 3 uses per posted message.
      if (!user.isAdmin && !planService.isPaidPlan(planService.effectivePlan(user))) {
        await User.findByIdAndUpdate(user._id, { $inc: { freeTripsUsed: 1 } });
      }
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
const paymentRoutes = require('./routes/payments');
const settingsRoutes = require('./routes/settings');
const notificationRoutes = require('./routes/notifications');

app.use('/api/trips', tripRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/worldcup', worldcupRoutes);
app.use('/api/livemap', livemapRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.send('Travio Backend API is running');
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
