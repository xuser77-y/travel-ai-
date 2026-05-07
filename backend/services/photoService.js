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
let breakerWarned = false;   // log the breaker-open warning once per window
// In-flight promise registry: dedupes concurrent lookups for the same query
// so two parallel trip generations don't both hit the network and both log.
const inFlight = new Map();

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

// Wait helper for retry backoff.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One Pexels HTTP attempt. Throws on failure so the caller can retry.
const fetchPexelsOnce = async (apiKey, query) => {
  const response = await axios.get('https://api.pexels.com/v1/search', {
    params: { query: `${query} city landscape`, per_page: 1, orientation: 'landscape' },
    headers: { Authorization: apiKey },
    // 12s covers slow DNS on residential ISPs (e.g. peak hours in Morocco)
    // without making the user wait forever for a non-critical asset.
    timeout: 12000
  });
  return response.data?.photos?.[0]?.src?.large2x || null;
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
  // Breaker just expired — re-arm the warning gate so we get one log line
  // if the network is still down on the next attempt.
  if (breakerWarned && Date.now() >= circuitBreakerUntil) {
    breakerWarned = false;
  }

  // Dedupe concurrent calls for the same destination — two parallel trip
  // generations would otherwise both fire (and both log on failure).
  if (inFlight.has(cacheKey)) {
    return inFlight.get(cacheKey);
  }

  const lookup = (async () => {
    let lastErr = null;
    // One quick retry for transient flakes (ECONNRESET / EAI_AGAIN) before
    // we declare the API down. ENOTFOUND is a hard DNS failure → no retry.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = await fetchPexelsOnce(apiKey, query);
        if (url) {
          photoCache.set(cacheKey, url);
          return url;
        }
        // 200 OK but no photos — treat as "no result", don't retry.
        break;
      } catch (error) {
        lastErr = error;
        const code = error?.code || error?.cause?.code;
        // Hard DNS failure or already-final error → don't waste a retry.
        if (code === 'ENOTFOUND' || code === 'ENETUNREACH' || attempt === 1) break;
        await sleep(400);
      }
    }

    if (lastErr) {
      if (isNetworkFailure(lastErr)) {
        // DNS / offline — trip the breaker for 10 min and log ONCE.
        circuitBreakerUntil = Date.now() + 10 * 60 * 1000;
        if (!breakerWarned) {
          breakerWarned = true;
          console.warn(`Pexels unreachable (${lastErr.code || lastErr.message}); using local fallback for 10 min.`);
        }
      } else {
        console.error('Pexels API Error:', lastErr.message);
      }
    }

    // Cache the fallback briefly so a retry cycle doesn't re-spam the API.
    photoCache.set(cacheKey, fallback, 60 * 30); // 30 min
    return fallback;
  })();

  inFlight.set(cacheKey, lookup);
  try {
    return await lookup;
  } finally {
    inFlight.delete(cacheKey);
  }
};

module.exports = { getDestinationPhoto };
