const express = require('express');
const router = express.Router();
const ChatRoom = require('../models/ChatRoom');

// GET /api/chat/rooms
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await ChatRoom.find().select('roomName destination inviteCode _id');
    res.json(rooms);
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

module.exports = router;
