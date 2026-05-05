const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const Groq = require('groq-sdk');
const { generateFullTrip } = require('../services/plannerOrchestrator');
const promptService = require('../services/promptService');
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

// POST /api/trips/suggest-destination
// Powers Step 1's "Let AI choose for me" mode: takes a free-form description
// and returns a real, geocoded city the user can actually plan a trip to.
router.post('/suggest-destination', async (req, res) => {
  try {
    const description = (req.body?.description || '').trim();
    if (description.length < 5) {
      return res.status(400).json({ error: 'Please describe your dream trip in a sentence or two.' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'AI service is not configured.' });

    // 1. Ask the LLM for a single city pick.
    const groq = new Groq({ apiKey });
    const { system, user } = await promptService.resolveForCall('destination.suggest', { description });
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    let suggestion;
    try {
      suggestion = JSON.parse(completion.choices[0].message.content);
    } catch (_) {
      return res.status(502).json({ error: 'AI returned an unreadable response. Try rephrasing.' });
    }
    const city = (suggestion?.city || '').trim();
    const country = (suggestion?.country || '').trim();
    const reason = (suggestion?.reason || '').trim();
    if (!city) {
      return res.status(502).json({ error: 'AI could not pick a city. Try a more specific description.' });
    }

    // 2. Resolve coordinates through the existing search proxy so we get the
    //    same Photon → Nominatim ranking the manual flow uses.
    const port = process.env.PORT || 5000;
    const query = country ? `${city}, ${country}` : city;
    let geo = [];
    try {
      const r = await axios.get(`http://localhost:${port}/api/search/proxy`, {
        params: { q: query },
        timeout: 8000
      });
      geo = Array.isArray(r.data) ? r.data : [];
    } catch (err) {
      console.warn('suggest-destination geocode error:', err.message);
    }

    // Fall back to a plain city query if the "City, Country" form found nothing.
    if (geo.length === 0 && country) {
      try {
        const r = await axios.get(`http://localhost:${port}/api/search/proxy`, {
          params: { q: city },
          timeout: 8000
        });
        geo = Array.isArray(r.data) ? r.data : [];
      } catch (_) { /* ignore */ }
    }

    if (geo.length === 0) {
      return res.status(502).json({
        error: `Couldn't geocode "${query}". Try rephrasing your description.`,
        suggestion: { city, country, reason }
      });
    }

    const top = geo[0];
    res.json({
      destination: {
        name: top.display_name,
        city: top.city || city,
        country: top.country || country,
        country_code: top.country_code || null,
        lat: parseFloat(top.lat),
        lon: parseFloat(top.lon)
      },
      reason
    });
  } catch (error) {
    console.error('suggest-destination error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
