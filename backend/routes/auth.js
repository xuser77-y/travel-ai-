const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const { hashPassword, verifyPassword, isHashed } = require('../services/password');
const planService = require('../services/planService');
require('dotenv').config();

// Ensures the user is a member of every hub flagged as `isGlobalDefault`
// (currently the General Travel Hub). Idempotent — safe to call on every login.
// Returns the up-to-date list of joinedHub ids as strings.
const ensureGlobalHubMembership = async (user) => {
  const defaults = await ChatRoom.find({ isGlobalDefault: true }).select('_id participants');
  let mutated = false;
  for (const room of defaults) {
    const alreadyJoined = (user.joinedHubs || []).some(
      (id) => id.toString() === room._id.toString()
    );
    if (!alreadyJoined) {
      user.joinedHubs = [...(user.joinedHubs || []), room._id];
      mutated = true;
    }
    const inParticipants = (room.participants || []).some(
      (id) => id.toString() === user._id.toString()
    );
    if (!inParticipants) {
      room.participants.push(user._id);
      await room.save();
    }
  }
  if (mutated) await user.save();
  return (user.joinedHubs || []).map((id) => id.toString());
};

// Pulls the best client IP available, falling back gracefully if no proxy
// headers are present. With `app.set('trust proxy', true)` Express already
// resolves `req.ip` from `X-Forwarded-For` for us.
const getClientIp = (req) => {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || '';
};

// Auto-promotes any account whose email matches the comma-separated list in
// the ADMIN_EMAIL env var. This is the only way to mint the first admin
// without touching the DB by hand.
const isWhitelistedAdmin = (email) => {
  const list = (process.env.ADMIN_EMAIL || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes((email || '').toLowerCase());
};

// Builds the token + user payload returned by both /login and /signup so
// the frontend handles a single response shape.
const issueSession = async (user) => {
  const joinedHubs = await ensureGlobalHubMembership(user);
  const token = jwt.sign(
    { id: user._id, email: user.email, isAdmin: !!user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: !!user.isAdmin,
      joinedHubs,
      subscription: planService.publicSubscription(user)
    }
  };
};

// Case-insensitive email lookup so "Foo@Bar.com" and "foo@bar.com" map to
// the same record regardless of casing used on signup.
const findUserByEmail = (email) => {
  const escaped = String(email).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return User.findOne({ email: { $regex: `^${escaped}$`, $options: 'i' } });
};

// POST /api/auth/signup — strict create. Errors with 409 if the email is
// already registered so the UI can show "this email is already in use".
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalized = String(email).trim();
    const existing = await findUserByEmail(normalized);
    if (existing) {
      return res.status(409).json({ error: 'This email is already registered. Please sign in instead.' });
    }

    const user = new User({
      email: normalized.toLowerCase(),
      name: (name && name.trim()) || normalized.split('@')[0],
      password: hashPassword(password)
    });

    if (isWhitelistedAdmin(user.email)) user.isAdmin = true;

    user.lastLoginAt = new Date();
    user.lastSeenAt = new Date();
    user.lastIp = getClientIp(req);
    user.lastUserAgent = req.headers['user-agent'] || '';
    user.loginCount = 1;
    await user.save();

    res.status(201).json(await issueSession(user));
  } catch (error) {
    // Mongo duplicate-key fallback in case of a unique index race.
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'This email is already registered. Please sign in instead.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login — strict verify. No more silent account creation.
//
// Security: passwords are hashed with scrypt (see services/password.js).
// Existing users with legacy plaintext passwords are lazily upgraded on
// their first successful login.
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email. Sign up first.' });
    }

    const ok = verifyPassword(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }
    if (!isHashed(user.password)) {
      user.password = hashPassword(password);
    }

    if (user.disabled) {
      return res.status(403).json({ error: 'Account disabled. Contact an administrator.' });
    }

    if (isWhitelistedAdmin(user.email) && !user.isAdmin) user.isAdmin = true;

    user.lastLoginAt = new Date();
    user.lastSeenAt = new Date();
    user.lastIp = getClientIp(req);
    user.lastUserAgent = req.headers['user-agent'] || '';
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    res.json(await issueSession(user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me — returns the current user with admin flag, used by the
// frontend on app boot to refresh the admin status without re-logging in.
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.disabled) return res.status(403).json({ error: 'Account disabled' });

    // Refresh lastSeen on touch — cheap heartbeat.
    user.lastSeenAt = new Date();
    user.lastIp = getClientIp(req);
    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: !!user.isAdmin,
      joinedHubs: (user.joinedHubs || []).map((id) => id.toString()),
      subscription: planService.publicSubscription(user)
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
