const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  profile: {
    avatar: String,
    bio: String,
    preferredCurrency: { type: String, default: 'USD' },
    interests: [String]
  },
  // Persistent membership: rooms the user has explicitly joined.
  // The Global Travel Hub is added automatically on signup/login (see routes/auth.js).
  joinedHubs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom' }],

  // Admin / moderation
  isAdmin: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },

  // Activity tracking — populated on every login (see routes/auth.js).
  lastLoginAt: { type: Date },
  lastSeenAt: { type: Date },
  lastIp: { type: String },
  lastUserAgent: { type: String },
  loginCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
