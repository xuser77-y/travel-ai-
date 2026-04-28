const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Trip = require('../models/Trip');
const ChatRoom = require('../models/ChatRoom');
const LivePost = require('../models/LivePost');
const onlineTracker = require('../services/onlineTracker');
const apiTracker = require('../services/apiTracker');
const { hashPassword } = require('../services/password');
require('dotenv').config();

// ---------------------------------------------------------------------------
// Auth — every admin route requires a valid JWT AND user.isAdmin === true.
// We re-check the DB on every request (instead of trusting the token's
// `isAdmin` claim) so demoting a user takes effect immediately.
// ---------------------------------------------------------------------------
const adminMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('isAdmin disabled email name');
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.disabled) return res.status(403).json({ error: 'Account disabled' });
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    req.adminUser = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(adminMiddleware);

// ---------------------------------------------------------------------------
// GET /api/admin/stats — top-level dashboard cards.
// ---------------------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    const [users, admins, disabled, trips, rooms, livePosts, totalMessages] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isAdmin: true }),
      User.countDocuments({ disabled: true }),
      Trip.countDocuments({}),
      ChatRoom.countDocuments({}),
      LivePost.countDocuments({}),
      ChatRoom.aggregate([
        { $project: { count: { $size: { $ifNull: ['$messages', []] } } } },
        { $group: { _id: null, total: { $sum: '$count' } } }
      ])
    ]);

    res.json({
      users,
      admins,
      disabled,
      trips,
      rooms,
      livePosts,
      totalMessages: totalMessages[0]?.total || 0,
      online: onlineTracker.counts()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------

// GET /api/admin/users?q=&page=&limit=
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const q = (req.query.q || '').trim();

    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
            { lastIp: { $regex: q, $options: 'i' } }
          ]
        }
      : {};

    const [items, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ]);

    const onlineSet = new Set(onlineTracker.onlineUserIds());
    const tripCounts = await Trip.aggregate([
      { $match: { userId: { $in: items.map((u) => u._id) } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]);
    const tripCountMap = new Map(tripCounts.map((t) => [String(t._id), t.count]));

    res.json({
      total,
      page,
      limit,
      items: items.map((u) => ({
        ...u,
        online: onlineSet.has(String(u._id)),
        tripsCount: tripCountMap.get(String(u._id)) || 0,
        joinedHubsCount: (u.joinedHubs || []).length
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id  — promote/demote/disable
router.patch('/users/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const allowed = {};
    if (typeof req.body.isAdmin === 'boolean') allowed.isAdmin = req.body.isAdmin;
    if (typeof req.body.disabled === 'boolean') allowed.disabled = req.body.disabled;
    if (typeof req.body.name === 'string') allowed.name = req.body.name;
    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    // Don't let an admin lock themselves out by self-demoting + disabling at once.
    if (String(req.adminUser._id) === String(req.params.id) && allowed.isAdmin === false) {
      return res.status(400).json({ error: 'Cannot demote yourself' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: allowed },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users/:id/password — reset a user's password
router.post('/users/:id/password', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const { newPassword } = req.body || {};
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.password = hashPassword(newPassword);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (String(req.adminUser._id) === String(req.params.id)) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Best-effort cleanup: pull this user from every room's participants
    // and delete their trips.
    await Promise.all([
      ChatRoom.updateMany({}, { $pull: { participants: user._id } }),
      Trip.deleteMany({ userId: user._id })
    ]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// ONLINE — real-time list of currently connected sockets
// ---------------------------------------------------------------------------
router.get('/online', async (req, res) => {
  try {
    const sockets = onlineTracker.list();
    const userIds = Array.from(new Set(sockets.map((s) => s.userId).filter(Boolean)));
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } })
          .select('name email isAdmin')
          .lean()
      : [];
    const userMap = new Map(users.map((u) => [String(u._id), u]));
    res.json({
      counts: onlineTracker.counts(),
      sockets: sockets.map((s) => ({
        ...s,
        user: s.userId ? userMap.get(s.userId) || null : null
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// TRIPS
// ---------------------------------------------------------------------------
router.get('/trips', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const [items, total] = await Promise.all([
      Trip.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name email')
        .select('destination dates budget travelers style status createdAt userId')
        .lean(),
      Trip.countDocuments({})
    ]);
    res.json({ total, page, limit, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/trips/:id — full trip with itinerary for the detail modal
router.get('/trips/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid trip id' });
    }
    const trip = await Trip.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('chatRoom', 'roomName inviteCode')
      .lean();
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/trips/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid trip id' });
    }
    const trip = await Trip.findByIdAndDelete(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/trips/:id/days/:dayIndex/sessions/:sessionIndex
// Removes a single activity slot from a trip's itinerary.
router.delete('/trips/:id/days/:dayIndex/sessions/:sessionIndex', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid trip id' });
    }
    const dayIdx = parseInt(req.params.dayIndex, 10);
    const sessionIdx = parseInt(req.params.sessionIndex, 10);
    if (Number.isNaN(dayIdx) || Number.isNaN(sessionIdx)) {
      return res.status(400).json({ error: 'Invalid index' });
    }
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (!trip.itinerary?.[dayIdx]?.sessions?.[sessionIdx]) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    trip.itinerary[dayIdx].sessions.splice(sessionIdx, 1);
    await trip.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// CHAT ROOMS
// ---------------------------------------------------------------------------
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await ChatRoom.find()
      .select('roomName destination description inviteCode isGlobalDefault isWorldCupFanRoom participants messages createdAt')
      .lean();
    res.json(
      rooms.map((r) => ({
        _id: r._id,
        roomName: r.roomName,
        destination: r.destination,
        description: r.description || '',
        inviteCode: r.inviteCode,
        isGlobalDefault: !!r.isGlobalDefault,
        isWorldCupFanRoom: !!r.isWorldCupFanRoom,
        memberCount: (r.participants || []).length,
        messageCount: (r.messages || []).length,
        createdAt: r.createdAt
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/rooms/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid room id' });
    }
    const allowed = {};
    if (typeof req.body.roomName === 'string') allowed.roomName = req.body.roomName;
    if (typeof req.body.destination === 'string') allowed.destination = req.body.destination;
    if (typeof req.body.description === 'string') allowed.description = req.body.description;
    if (typeof req.body.isGlobalDefault === 'boolean') allowed.isGlobalDefault = req.body.isGlobalDefault;
    if (typeof req.body.isWorldCupFanRoom === 'boolean') allowed.isWorldCupFanRoom = req.body.isWorldCupFanRoom;
    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    const room = await ChatRoom.findByIdAndUpdate(
      req.params.id,
      { $set: allowed },
      { new: true, runValidators: true }
    );
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/rooms/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid room id' });
    }
    const room = await ChatRoom.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    // Pull from every user's joinedHubs
    await User.updateMany({}, { $pull: { joinedHubs: room._id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// LIVE POSTS
// ---------------------------------------------------------------------------
router.get('/liveposts', async (req, res) => {
  try {
    const items = await LivePost.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/liveposts/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid post id' });
    }
    const post = await LivePost.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// HUB MESSAGES — view / edit / delete individual messages inside a room
// Messages are stored as an embedded subdocument array on ChatRoom.messages,
// so we work with their `_id` (added automatically by Mongoose).
// ---------------------------------------------------------------------------

// GET /api/admin/rooms/:id/messages — full message history for a hub
router.get('/rooms/:id/messages', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid room id' });
    }
    const room = await ChatRoom.findById(req.params.id)
      .select('roomName destination messages')
      .lean();
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({
      _id: room._id,
      roomName: room.roomName,
      destination: room.destination,
      messages: (room.messages || []).map((m) => ({
        _id: m._id,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/rooms/:id/messages/:messageId — edit a message
router.patch('/rooms/:id/messages/:messageId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.messageId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const { text } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const room = await ChatRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const message = room.messages.id(req.params.messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    message.text = text.trim();
    await room.save();
    res.json({ ok: true, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/rooms/:id/messages/:messageId
router.delete('/rooms/:id/messages/:messageId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.messageId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const room = await ChatRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const message = room.messages.id(req.params.messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    message.deleteOne();
    await room.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API USAGE — operational view of recent traffic
// ---------------------------------------------------------------------------
router.get('/api-usage', (req, res) => {
  try {
    res.json(apiTracker.summary());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api-usage/reset', (req, res) => {
  try {
    apiTracker.reset();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
