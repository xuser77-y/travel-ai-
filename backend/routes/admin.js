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
const promptService = require('../services/promptService');
const planService = require('../services/planService');
const { hashPassword, verifyPassword } = require('../services/password');
const fs = require('fs');
const path = require('path');
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
    // Plan management — superadmin can move a user between tiers, edit
    // their trial allowance, or extend/expire their subscription.
    if (typeof req.body.plan === 'string' && ['free', 'basic', 'pro', 'premium'].includes(req.body.plan)) {
      allowed.plan = req.body.plan;
    }
    if (typeof req.body.trialLimit === 'number' && req.body.trialLimit >= 0) {
      allowed.trialLimit = Math.floor(req.body.trialLimit);
    }
    if (typeof req.body.freeTripsUsed === 'number' && req.body.freeTripsUsed >= 0) {
      allowed.freeTripsUsed = Math.floor(req.body.freeTripsUsed);
    }
    if (req.body.planExpiresAt === null) {
      allowed.planExpiresAt = null;
    } else if (typeof req.body.planExpiresAt === 'string') {
      const d = new Date(req.body.planExpiresAt);
      if (!isNaN(d.getTime())) allowed.planExpiresAt = d;
    }
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

// ---------------------------------------------------------------------------
// VERIFY PASSWORD — re-authentication gate for sensitive admin actions
// (currently used to unlock the Prompts editor). We load the password hash
// fresh because the admin middleware strips it from the cached user.
// ---------------------------------------------------------------------------
router.post('/verify-password', async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }
    const full = await User.findById(req.adminUser._id).select('+password password');
    if (!full) return res.status(404).json({ error: 'User not found' });
    const ok = verifyPassword(password, full.password);
    if (!ok) return res.status(401).json({ error: 'Incorrect password' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// AI PROMPTS — list / update / reset the editable prompt templates used by
// the itinerary generator, refinement chat, and live-map area summaries.
// ---------------------------------------------------------------------------
router.get('/prompts', async (req, res) => {
  try {
    const prompts = await promptService.listPrompts();
    res.json({ items: prompts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/prompts/:key', async (req, res) => {
  try {
    const prompt = await promptService.getPrompt(req.params.key);
    if (!prompt) return res.status(404).json({ error: 'Unknown prompt key' });
    res.json(prompt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/prompts/:key', async (req, res) => {
  try {
    const { systemPrompt, userTemplate, password } = req.body || {};
    // Re-verify password on every save so a stolen token alone cannot
    // silently rewrite the AI prompts.
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required to save prompt changes' });
    }
    const full = await User.findById(req.adminUser._id).select('+password password');
    if (!full) return res.status(404).json({ error: 'User not found' });
    if (!verifyPassword(password, full.password)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    if (typeof systemPrompt !== 'string' && typeof userTemplate !== 'string') {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    await promptService.setPrompt(
      req.params.key,
      { systemPrompt, userTemplate },
      { userId: req.adminUser._id, email: req.adminUser.email }
    );
    const fresh = await promptService.getPrompt(req.params.key);
    res.json(fresh);
  } catch (err) {
    if (err.message?.startsWith('Unknown prompt key')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/prompts/:key/reset', async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required to reset a prompt' });
    }
    const full = await User.findById(req.adminUser._id).select('+password password');
    if (!full) return res.status(404).json({ error: 'User not found' });
    if (!verifyPassword(password, full.password)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    await promptService.resetPrompt(req.params.key);
    const fresh = await promptService.getPrompt(req.params.key);
    res.json(fresh);
  } catch (err) {
    if (err.message?.startsWith('Unknown prompt key')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PLANS — superadmin manages tier prices and grants subscriptions / trials
// ---------------------------------------------------------------------------

// Plan persistence now lives entirely inside `services/planService.js`
// (single source of truth — see `updatePlan` / `getOverrides`). This route
// is just a thin validating wrapper.

router.get('/plans', (req, res) => {
  res.json({
    plans: planService.listPlans(),
    overrides: planService.getOverrides()
  });
});

// GET /api/admin/payment-config — current provider + Stripe availability
// PATCH /api/admin/payment-config — flip between 'mock' and 'stripe'
router.get('/payment-config', (req, res) => {
  const paymentsRouter = require('./payments');
  const stripeService = require('../services/stripeService');
  res.json({
    provider: paymentsRouter.getActiveProvider(),
    stripeAvailable: stripeService.enabled()
  });
});

router.patch('/payment-config', (req, res) => {
  try {
    const paymentsRouter = require('./payments');
    const provider = paymentsRouter.setActiveProvider(req.body?.provider);
    res.json({ ok: true, provider });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/admin/plans/:id — superadmin edits everything about a plan,
// including which features it unlocks. `planService.updatePlan` validates
// the patch (price >= 0, features must be in ALL_FEATURES, etc.) so the
// gating middleware can never end up with a nonsense plan definition.
router.patch('/plans/:id', (req, res) => {
  const id = req.params.id;
  if (!planService.PLAN_DEFS[id]) return res.status(404).json({ error: 'Unknown plan' });
  const patch = {};
  if (typeof req.body.priceMonthly === 'number' && req.body.priceMonthly >= 0) {
    patch.priceMonthly = req.body.priceMonthly;
  }
  if (typeof req.body.currency === 'string' && req.body.currency.trim()) {
    patch.currency = req.body.currency.trim().toUpperCase();
  }
  if (typeof req.body.name === 'string' && req.body.name.trim()) patch.name = req.body.name.trim();
  if (typeof req.body.description === 'string') patch.description = req.body.description;
  if (typeof req.body.highlight === 'boolean') patch.highlight = req.body.highlight;
  if (Array.isArray(req.body.features)) {
    // De-dupe & normalize; planService re-validates against ALL_FEATURES.
    patch.features = [...new Set(req.body.features.filter((f) => typeof f === 'string'))];
  }
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update' });
  try {
    const def = planService.updatePlan(id, patch);
    res.json(def);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/users/:id/revoke-trial — caps the user's trial right now
// without deleting their existing usage record. We set `trialLimit` equal
// to `freeTripsUsed` so the next /generate call returns 402 cleanly.
router.post('/users/:id/revoke-trial', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.trialLimit = user.freeTripsUsed || 0;
    await user.save();
    res.json({
      ok: true,
      trialLimit: user.trialLimit,
      freeTripsUsed: user.freeTripsUsed
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users/:id/grant-plan { plan, days }
router.post('/users/:id/grant-plan', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const planId = String(req.body?.plan || '').toLowerCase();
    if (!['basic', 'pro', 'premium'].includes(planId)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    const days = Math.max(1, Math.min(365, parseInt(req.body?.days, 10) || 30));
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const now = new Date();
    const baseStart = user.planExpiresAt && new Date(user.planExpiresAt) > now && user.plan === planId
      ? new Date(user.planExpiresAt)
      : now;
    const periodEnd = new Date(baseStart.getTime() + days * 24 * 60 * 60 * 1000);
    user.plan = planId;
    user.planExpiresAt = periodEnd;
    user.subscriptionHistory.push({
      plan: planId,
      amount: 0,
      currency: 'USD',
      provider: 'admin',
      periodStart: now,
      periodEnd,
      status: 'granted',
      note: req.body?.note || `Granted by ${req.adminUser.email}`
    });
    await user.save();
    res.json({ ok: true, subscription: planService.publicSubscription(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users/:id/grant-trials { count }
router.post('/users/:id/grant-trials', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const count = parseInt(req.body?.count, 10);
    if (!Number.isFinite(count) || count <= 0) {
      return res.status(400).json({ error: 'Count must be a positive integer' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $inc: { trialLimit: count } },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true, trialLimit: user.trialLimit, freeTripsUsed: user.freeTripsUsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users/:id/expire-plan — force back to free
router.post('/users/:id/expire-plan', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { plan: 'free', planExpiresAt: null } },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users/:id — full detail incl. subscription history
router.get('/users/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const tripsCount = await Trip.countDocuments({ userId: user._id });
    res.json({
      ...user,
      tripsCount,
      effectivePlan: planService.effectivePlan(user)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
