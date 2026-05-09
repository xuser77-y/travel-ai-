const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');
require('dotenv').config();

// Middleware to protect routes
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.disabled) return res.status(403).json({ error: 'Account disabled' });
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to restrict to admins
const adminMiddleware = (req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
};

// GET /api/notifications - Fetch notifications for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    // Find notifications where type is 'all' OR user is in recipients
    // AND notification is not expired
    const notifications = await Notification.find({
      $and: [
        {
          $or: [
            { type: 'all' },
            { recipients: req.user._id }
          ]
        },
        {
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: now } }
          ]
        }
      ]
    }).sort({ createdAt: -1 }).limit(50).populate('sender', 'name email');

    // Attach read status
    const formatted = notifications.map(n => ({
      ...n.toObject(),
      isRead: req.user.readNotifications.includes(n._id)
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/read/:id - Mark a notification as read
router.post('/read/:id', authMiddleware, async (req, res) => {
  try {
    const notificationId = req.params.id;
    if (!req.user.readNotifications.includes(notificationId)) {
      req.user.readNotifications.push(notificationId);
      await req.user.save();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/read-all - Mark all notifications as read
router.post('/read-all', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const notifications = await Notification.find({
      $and: [
        {
          $or: [
            { type: 'all' },
            { recipients: req.user._id }
          ]
        },
        {
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: now } }
          ]
        }
      ]
    }).select('_id');

    const newReadIds = notifications
      .map(n => n._id)
      .filter(id => !req.user.readNotifications.includes(id));

    if (newReadIds.length > 0) {
      req.user.readNotifications.push(...newReadIds);
      await req.user.save();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications/admin - (Admin only) List all notifications
router.get('/admin', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({})
      .sort({ createdAt: -1 })
      .populate('sender', 'name email');
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notifications/:id - (Admin only) Delete notification
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/admin - (Admin only) Create and broadcast notification
router.post('/admin', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, message, type, recipients, link, expiresAt } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const notification = new Notification({
      sender: req.user._id,
      title,
      message,
      type: type || 'all',
      recipients: type === 'specific' ? recipients : [],
      link,
      expiresAt: expiresAt || null
    });

    await notification.save();

    // Broadcast via Socket.io
    const io = req.app.get('io');
    const broadcastData = {
      ...notification.toObject(),
      sender: { _id: req.user._id, name: req.user.name, email: req.user.email },
      isRead: false
    };

    if (notification.type === 'all') {
      io.emit('new_notification', broadcastData);
    } else {
      recipients.forEach(userId => {
        io.to(`user_${userId}`).emit('new_notification', broadcastData);
      });
    }

    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
