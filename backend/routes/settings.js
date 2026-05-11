const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Trip = require('../models/Trip');
const ChatRoom = require('../models/ChatRoom');
const { requireAuth } = require('../middleware/planGate');
const { hashPassword, verifyPassword } = require('../services/password');
const planService = require('../services/planService');

/**
 * Self-service account settings.
 *
 * GET    /api/settings/me           -> profile + subscription snapshot
 * PATCH  /api/settings/profile      -> name / bio / preferredCurrency / interests
 * POST   /api/settings/password     -> change password (requires currentPassword)
 * DELETE /api/settings/account      -> wipe the account + owned trips + leave hubs
 */

router.use(requireAuth);

router.get('/me', (req, res) => {
  const u = req.user;
  res.json({
    id: u._id,
    name: u.name,
    email: u.email,
    profile: u.profile || {},
    isAdmin: !!u.isAdmin,
    createdAt: u.createdAt,
    subscription: planService.publicSubscription(u)
  });
});

router.patch('/profile', async (req, res) => {
  try {
    const allowed = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      allowed.name = req.body.name.trim();
    }
    if (req.body.profile && typeof req.body.profile === 'object') {
      const p = req.body.profile;
      const profile = req.user.profile || {};
      if (typeof p.bio === 'string') profile.bio = p.bio;
      if (typeof p.avatar === 'string') profile.avatar = p.avatar;
      if (typeof p.preferredCurrency === 'string') profile.preferredCurrency = p.preferredCurrency;
      if (Array.isArray(p.interests)) profile.interests = p.interests.filter((s) => typeof s === 'string');
      allowed.profile = profile;
    }
    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    const user = await User.findByIdAndUpdate(req.user._id, { $set: allowed }, { returnDocument: 'after' }).select('-password');
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      profile: user.profile || {},
      isAdmin: !!user.isAdmin,
      subscription: planService.publicSubscription(user)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    if (!verifyPassword(currentPassword || '', req.user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    req.user.password = hashPassword(newPassword);
    await req.user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/account', async (req, res) => {
  try {
    const userId = req.user._id;
    if (req.user.isAdmin) {
      // Don't let an admin delete themselves through the self-service route.
      return res.status(400).json({ error: 'Admins cannot delete their own account from Settings.' });
    }
    await Promise.all([
      Trip.deleteMany({ userId }),
      ChatRoom.updateMany({}, { $pull: { participants: userId } }),
      User.findByIdAndDelete(userId)
    ]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
