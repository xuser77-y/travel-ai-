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

  // Admin / moderation. `isAdmin` is effectively a superadmin flag: the single
  // gate for every /api/admin/* route and every "manage anything" FE control.
  isAdmin: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },

  // --- Subscription / Plan ----------------------------------------------
  // Free-tier lifecycle:
  //  - new accounts get `trialLimit` (default 3) free trip generations.
  //  - `freeTripsUsed` increments on every successful /api/trips/generate
  //    for users still on the `free` plan.
  //  - once freeTripsUsed >= trialLimit the planner is blocked until they
  //    upgrade. Admins can raise `trialLimit` or reset `freeTripsUsed` to
  //    grant more trials.
  //  - paid plans (`basic` | `pro` | `premium`) unlock the corresponding
  //    features and expire at `planExpiresAt` (one-time monthly charge model,
  //    so we simply set expiry = now + 30 days on capture).
  plan: {
    type: String,
    enum: ['free', 'basic', 'pro', 'premium'],
    default: 'free'
  },
  planExpiresAt: { type: Date, default: null },
  freeTripsUsed: { type: Number, default: 0 },
  trialLimit: { type: Number, default: 3 },

  // Payment history for the Settings page + admin view. Each entry is a
  // captured PayPal order. `status` is one of 'completed' | 'refunded' |
  // 'granted' (the last one is used when an admin gifts a plan manually).
  subscriptionHistory: [new mongoose.Schema({
    plan: { type: String, enum: ['basic', 'pro', 'premium'] },
    amount: Number,
    currency: { type: String, default: 'USD' },
    provider: { type: String, default: 'paypal' },
    providerOrderId: String,
    providerPayerId: String,
    periodStart: Date,
    periodEnd: Date,
    status: { type: String, default: 'completed' },
    note: String,
    createdAt: { type: Date, default: Date.now }
  }, { _id: true })],

  // Activity tracking — populated on every login (see routes/auth.js).
  lastLoginAt: { type: Date },
  lastSeenAt: { type: Date },
  lastIp: { type: String },
  lastUserAgent: { type: String },
  loginCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
