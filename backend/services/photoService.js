const axios = require('axios');
require('dotenv').config();

// Tiny inline TTL cache — avoids pulling node-cache as a dependency.
const photoCacheStore = new Map(); // key -> { value, expiresAt }
const photoCache = {
  get(key) {
    const entry = photoCacheStore.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      photoCacheStore.delete(key);
      return undefined;
    }
    return entry.value;
  },
  set(key, value, ttlSec = 24 * 60 * 60) {
    photoCacheStore.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  }
};

/**
 * Destination photo resolver.
 *
 * - Primary path: Pexels `/v1/search` with the destination as query.
 * - Tolerates offline / DNS-blocked environments: a single ENOTFOUND is
 *   enough to flip an in-memory circuit breaker so we stop hammering the
 *   API on every trip generation. The breaker auto-resets after 10 min.
 * - Successful lookups are cached for 24 h keyed by the query.
 * - When the API is unavailable OR returns no hits, we return a curated
 *   image URL deterministically picked from the destination name so two
 *   trips to the same city keep the same cover photo.
 */

let circuitBreakerUntil = 0; // epoch ms; while > Date.now(), skip network calls

// Curated Pexels image IDs that are known-good landscape shots. We return
// direct `images.pexels.com` URLs (no DNS on api.pexels.com needed).
const FALLBACK_PHOTOS = [
  'https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg',
  'https://images.pexels.com/photos/3225528/pexels-photo-3225528.jpeg',
  'https://images.pexels.com/photos/1488315/pexels-photo-1488315.jpeg',
  'https://images.pexels.com/photos/1008155/pexels-photo-1008155.jpeg',
  'https://images.pexels.com/photos/3225531/pexels-photo-3225531.jpeg',
  'https://images.pexels.com/photos/3408744/pexels-photo-3408744.jpeg',
  'https://images.pexels.com/photos/2265876/pexels-photo-2265876.jpeg',
  'https://images.pexels.com/photos/378570/pexels-photo-378570.jpeg'
];

// Simple deterministic hash so the same destination always yields the same
// fallback picture (avoids flicker between sessions).
const pickFallback = (key = '') => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return FALLBACK_PHOTOS[Math.abs(h) % FALLBACK_PHOTOS.length];
};

const isNetworkFailure = (err) => {
  const code = err?.code || err?.cause?.code;
  return code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ECONNREFUSED' ||
         code === 'ETIMEDOUT' || code === 'ENETUNREACH';
};

const getDestinationPhoto = async (query) => {
  const cacheKey = `photo:${(query || '').toLowerCase()}`;
  const cached = photoCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.PEXELS_API_KEY;
  const fallback = pickFallback(query);

  if (!apiKey) {
    // No key — don't even try; silent deterministic fallback.
    return fallback;
  }

  // Circuit breaker: skip the network call until the cooldown is over.
  if (Date.now() < circuitBreakerUntil) {
    return fallback;
  }

  try {
    const response = await axios.get('https://api.pexels.com/v1/search', {
      params: { query: `${query} city landscape`, per_page: 1, orientation: 'landscape' },
      headers: { Authorization: apiKey },
      timeout: 6000
    });
    const url = response.data?.photos?.[0]?.src?.large2x;
    if (url) {
      photoCache.set(cacheKey, url);
      return url;
    }
  } catch (error) {
    if (isNetworkFailure(error)) {
      // DNS / offline — trip the breaker for 10 min and stop logging noise.
      circuitBreakerUntil = Date.now() + 10 * 60 * 1000;
      console.warn(`Pexels unreachable (${error.code || error.message}); using local fallback for 10 min.`);
    } else {
      console.error('Pexels API Error:', error.message);
    }
  }

  // Cache the fallback briefly so a retry cycle doesn't re-spam the API.
  photoCache.set(cacheKey, fallback, 60 * 30); // 30 min
  return fallback;
};

module.exports = { getDestinationPhoto };
