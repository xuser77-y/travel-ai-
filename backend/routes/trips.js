const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { generateFullTrip } = require('../services/plannerOrchestrator');
const Trip = require('../models/Trip');

// Optional auth: sets req.user if a valid token is present, otherwise continues
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    // Invalid token - just ignore, allow guest access
  }
  next();
};

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

// POST /api/trips/generate
router.post('/generate', optionalAuth, async (req, res) => {
  try {
    // Prefer userId from JWT, fallback to body for legacy/demo flows
    const userId = req.user?.id || req.body.userId || null;
    const trip = await generateFullTrip(req.body, userId);
    res.status(201).json(trip);
  } catch (error) {
    console.error('Trip generation error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trips/user - all trips for the logged-in user
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const trips = await Trip.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('chatRoom', 'roomName inviteCode');
    res.json(trips);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trips/:id - single trip detail (owner only when authenticated)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('chatRoom');
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    // If trip has a userId and the requester is authenticated but not the owner, deny
    if (trip.userId && req.user && trip.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(trip);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/trips/:id - remove a saved trip from the user's dashboard
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.userId && trip.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await Trip.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/trips/refine
router.post('/refine', async (req, res) => {
  const { currentTrip, userMessage } = req.body;
  const { refineItinerary } = require('../services/aiService');
  
  try {
    const result = await refineItinerary(currentTrip, userMessage);
    if (!result) throw new Error('Refinement failed');
    
    // Optional: Save the updated trip to DB
    if (currentTrip._id) {
      await Trip.findByIdAndUpdate(currentTrip._id, result.updatedTrip);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
