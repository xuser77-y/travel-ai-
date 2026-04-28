const ChatRoom = require('../models/ChatRoom');
const crypto = require('crypto');

const findOrCreateRoom = async (destination, startDate, endDate, userId) => {
  try {
    // 1. Look for an existing room for this destination with "close" dates (within 3 days)
    const margin = 3 * 24 * 60 * 60 * 1000; // 3 days in ms
    const startObj = new Date(startDate);
    
    const existingRoom = await ChatRoom.findOne({
      destination: destination,
      startDate: { 
        $gte: new Date(startObj.getTime() - margin),
        $lte: new Date(startObj.getTime() + margin)
      }
    });

    if (existingRoom) {
      if (userId && !existingRoom.participants.includes(userId)) {
        existingRoom.participants.push(userId);
        await existingRoom.save();
      }
      return existingRoom;
    }

    // 2. Create a new room if none found
    const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 char code
    const newRoom = new ChatRoom({
      roomName: `${destination} Explorers`,
      destination: destination,
      startDate: startDate,
      endDate: endDate,
      inviteCode: inviteCode,
      participants: userId ? [userId] : []
    });

    await newRoom.save();
    return newRoom;
  } catch (error) {
    console.error('Chat Room Error:', error.message);
    return null;
  }
};

module.exports = { findOrCreateRoom };
