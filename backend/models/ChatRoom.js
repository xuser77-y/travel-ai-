const mongoose = require('mongoose');

const ChatRoomSchema = new mongoose.Schema({
  roomName: { type: String, required: true },
  destination: { type: String, required: true },
  description: { type: String, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  inviteCode: { type: String, unique: true, required: true },
  // Categorization flags used by the Community page sidebar.
  // - isGlobalDefault: every new account is auto-joined to this hub on signup.
  // - isWorldCupFanRoom: gated room shown only as a "Become a fan" CTA until joined.
  isGlobalDefault: { type: Boolean, default: false },
  isWorldCupFanRoom: { type: Boolean, default: false },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  messages: [{
    sender: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('ChatRoom', ChatRoomSchema);
