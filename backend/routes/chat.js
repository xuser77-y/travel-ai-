const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const ChatRoom = require('../models/ChatRoom');
const User = require('../models/User');
require('dotenv').config();

// Required auth: blocks unauthenticated requests
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/chat/rooms — list all rooms with categorization flags
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await ChatRoom.find()
      .select('roomName destination description inviteCode isGlobalDefault isWorldCupFanRoom participants _id')
      .lean();
    // Replace heavy participants array with a simple count to keep payload small
    const slim = rooms.map((r) => ({
      _id: r._id,
      roomName: r.roomName,
      destination: r.destination,
      description: r.description || '',
      inviteCode: r.inviteCode,
      isGlobalDefault: !!r.isGlobalDefault,
      isWorldCupFanRoom: !!r.isWorldCupFanRoom,
      memberCount: (r.participants || []).length
    }));
    res.json(slim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/chat/history/:roomId
router.get('/history/:roomId', async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room.messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/chat/me/hubs — the joined hub ids for the authenticated user
router.get('/me/hubs', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('joinedHubs');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ joinedHubs: (user.joinedHubs || []).map((id) => id.toString()) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/chat/rooms/:id/join — persistent join
router.post('/rooms/:id/join', authMiddleware, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userIdStr = user._id.toString();
    const roomIdStr = room._id.toString();

    if (!(user.joinedHubs || []).some((id) => id.toString() === roomIdStr)) {
      user.joinedHubs = [...(user.joinedHubs || []), room._id];
      await user.save();
    }
    if (!(room.participants || []).some((id) => id.toString() === userIdStr)) {
      room.participants.push(user._id);
      await room.save();
    }

    res.json({
      ok: true,
      roomId: roomIdStr,
      joinedHubs: (user.joinedHubs || []).map((id) => id.toString())
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/chat/rooms/:id/leave — remove membership
router.post('/rooms/:id/leave', authMiddleware, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userIdStr = user._id.toString();
    const roomIdStr = room._id.toString();

    user.joinedHubs = (user.joinedHubs || []).filter((id) => id.toString() !== roomIdStr);
    await user.save();

    room.participants = (room.participants || []).filter((id) => id.toString() !== userIdStr);
    await room.save();

    res.json({
      ok: true,
      roomId: roomIdStr,
      joinedHubs: (user.joinedHubs || []).map((id) => id.toString())
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
