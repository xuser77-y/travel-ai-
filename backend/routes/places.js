// ---------------------------------------------------------------------------
// /api/places/info
//
// Returns a rich "detail card" for one activity in a trip: a hero photo,
// an LLM-generated description, why-visit bullets, insider tips, best time
// to visit, and short highlight tags.
//
// This route is called lazily from the Trip Results page when the user
// clicks an activity card, so it MUST be fast and resilient:
//   - 24h in-memory cache keyed by `${name}|${destination}` (so repeated
//     opens of the same modal are instant and don't re-hit Groq),
//   - photo + LLM call run in parallel (Promise.allSettled — neither blocks
//     the other if one fails),
//   - deterministic fallback content when the LLM is offline / rate-limited.
// ---------------------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { generatePlaceDetail } = require('../services/aiService');
const { getDestinationPhoto } = require('../services/photoService');

// Tiny TTL cache (same pattern as photoService — no node-cache dep needed).
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map(); // key -> { value, expiresAt }

const cacheGet = (key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
};

const cacheSet = (key, value) => {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

const normaliseKey = (name, destination) =>
  `${String(name || '').trim().toLowerCase()}|${String(destination || '').trim().toLowerCase()}`;

// Deterministic fallback so the modal never shows an empty state even when
// Groq is offline. Uses the data the caller already has on the activity.
const buildFallback = ({ name, category, destination, shortDescription }) => ({
  description:
    shortDescription ||
    `${name}${destination ? ` in ${destination}` : ''} is one of the stops on your itinerary. ` +
      `Take your time to soak in the atmosphere.`,
  whyVisit: [
    'Recommended on your itinerary for this day.',
    category ? `A great ${String(category).toLowerCase()} experience.` : 'A memorable stop on your trip.',
    'Combine it with the next activity to make the most of your visit.'
  ],
  tips: [
    'Arrive a little earlier than your scheduled slot to avoid crowds.',
    'Check opening hours on the day of your visit.'
  ],
  bestTimeToVisit: '',
  highlights: category ? [String(category)] : []
});

// POST /api/places/info — body: { name, category, destination, shortDescription, lat, lon }
router.post('/info', async (req, res) => {
  try {
    const {
      name = '',
      category = '',
      destination = '',
      shortDescription = '',
      lat,
      lon
    } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Missing required field: name' });
    }

    const cacheKey = normaliseKey(name, destination);
    const cached = cacheGet(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Kick off photo + LLM in parallel. `allSettled` so a Pexels outage
    // never blocks the description, and vice versa.
    const photoQuery = destination
      ? `${name} ${destination}`.trim()
      : name;

    const [photoResult, detailResult] = await Promise.allSettled([
      getDestinationPhoto(photoQuery),
      generatePlaceDetail({ name, category, destination, shortDescription })
    ]);

    const photo =
      photoResult.status === 'fulfilled' && photoResult.value ? photoResult.value : null;

    const detail =
      detailResult.status === 'fulfilled' && detailResult.value
        ? detailResult.value
        : buildFallback({ name, category, destination, shortDescription });

    const payload = {
      name,
      category,
      destination,
      lat: typeof lat === 'number' ? lat : null,
      lon: typeof lon === 'number' ? lon : null,
      photo,
      ...detail,
      cached: false
    };

    cacheSet(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    console.error('GET /api/places/info failed:', err);
    // Even on hard failure, hand the FE the fallback so the modal still
    // renders something useful instead of an error toast.
    const fallback = buildFallback(req.body || {});
    res.status(200).json({ ...fallback, photo: null, cached: false, degraded: true });
  }
});

module.exports = router;
