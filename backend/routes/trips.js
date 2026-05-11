const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const Groq = require('groq-sdk');
const { generateFullTrip } = require('../services/plannerOrchestrator');
const promptService = require('../services/promptService');
const Trip = require('../models/Trip');
const User = require('../models/User');
const planService = require('../services/planService');
const { requireAuth, requireFeature, requireTripQuota } = require('../middleware/planGate');

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

// POST /api/trips/generate — now requires login + quota.
// Free users are limited by `trialLimit`; paid tiers are unlimited.
// `freeTripsUsed` increments only after a successful generation so a
// crashed AI call doesn't eat the user's trial.
router.post('/generate', requireAuth, requireTripQuota, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const trip = await generateFullTrip(req.body, userId);

    if (planService.effectivePlan(req.user) === 'free') {
      await User.findByIdAndUpdate(userId, { $inc: { freeTripsUsed: 1 } });
    }

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
// Gated by the `refine` feature: the in-trip AI chat is what every user
// hits to tweak their itinerary, so it MUST go through the plan gate or
// unchecking `refine` from a tier in the admin dashboard does nothing.
// (Bug fix: the route used to be wide open and ignored the checkbox grid.)
router.post('/refine', requireAuth, requireFeature('refine'), async (req, res) => {
  const { currentTrip, userMessage } = req.body;
  const { refineItinerary } = require('../services/aiService');

  try {
    const result = await refineItinerary(currentTrip, userMessage);
    if (!result) throw new Error('Refinement failed');

    // Persist + reload. The LLM response can omit `_id`, `userId`,
    // `chatRoom`, `createdAt` etc. (it doesn't see them as part of the
    // user-visible trip). If we returned `result.updatedTrip` directly,
    // the FE store would lose the _id → next refine call sends the trip
    // without _id → no DB save → user sees "changes vanish on refresh".
    //
    // We also strip `_id` from the patch BEFORE the update — Mongo
    // refuses to mutate immutable fields like `_id`, and Mongoose throws
    // when it sees one in the body of findByIdAndUpdate.
    //
    // IMPORTANT: we only persist when the LLM actually produced an
    // updated trip. Saving an empty patch would $set:{} and the FE would
    // receive the unchanged doc alongside a cheerful "I replaced X!"
    // aiResponse — the exact "AI says OK but trip doesn't change" bug.
    let savedTrip = null;
    const hasUsableUpdate =
      result.updatedTrip &&
      typeof result.updatedTrip === 'object' &&
      Array.isArray(result.updatedTrip.itinerary) &&
      result.updatedTrip.itinerary.length > 0;

    if (hasUsableUpdate && currentTrip?._id) {
      const patch = { ...result.updatedTrip };
      delete patch._id;
      delete patch.userId;
      delete patch.createdAt;
      delete patch.updatedAt;
      delete patch.__v;

      // `returnDocument: 'after'` returns the post-update doc; the
      // follow-up populate('chatRoom') matches what GET /trips/:id
      // returns so the FE re-render is identical to a hard refresh —
      // but instant.
      savedTrip = await Trip.findByIdAndUpdate(
        currentTrip._id,
        { $set: patch },
        { returnDocument: 'after' }
      );
      if (savedTrip) {
        savedTrip = await Trip.findById(savedTrip._id).populate('chatRoom');
      }
    }

    // Freemium: free users burn one of their 3 uses per successful refine.
    // Done AFTER the AI call so a model failure doesn't eat their quota.
    // We still charge a use even if the model only chatted back — the
    // compute happened and the user got a reply.
    if (planService.effectivePlan(req.user) === 'free' && !req.user.isAdmin) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { freeTripsUsed: 1 } });
    }

    // Only return an updatedTrip when there was a real edit. Returning
    // the old doc would make the FE think the edit succeeded and silently
    // overwrite any local optimistic state with unchanged data.
    res.json({
      aiResponse: result.aiResponse,
      updatedTrip: hasUsableUpdate ? (savedTrip || result.updatedTrip) : null
    });
  } catch (error) {
    console.error('Refine error:', error.message);
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
