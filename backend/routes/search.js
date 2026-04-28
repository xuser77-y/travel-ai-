const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * City / destination autocomplete proxy.
 *
 * Primary provider: Photon (https://photon.komoot.io) — built for
 *   prefix/typo-tolerant autocomplete, returns clean city/town/country data.
 * Fallback: Nominatim — invoked if Photon errors or returns nothing.
 */

const cache = new Map();
const CACHE_TTL = 60_000; // 60s

// osm_value -> rank. Higher = more likely to be what users want.
// Cities/towns intentionally score WAY higher than villages — when someone
// types "fes" we want to surface "Fez, Morocco" not random French hamlets.
const VALUE_RANK = {
  city: 240,
  town: 180,
  municipality: 165,
  airport: 200,
  aerodrome: 200,
  region: 130,
  state: 120,
  country: 110,
  county: 90,
  village: 60,
  hamlet: 35,
  suburb: 30,
  default: 10
};

const startsWithBoost = (label, q) => {
  if (!label || !q) return 0;
  const l = label.toLowerCase();
  const query = q.toLowerCase();
  if (l === query) return 80;
  if (l.startsWith(query)) return 40;
  if (l.includes(' ' + query)) return 20;
  if (l.includes(query)) return 8;
  return 0;
};

const dedupeKey = (r) => `${r.city}|${r.country}|${Math.round(r.lat * 100)}|${Math.round(r.lon * 100)}`;

/* ---------- Photon (primary) ---------- */
async function fetchPhoton(q) {
  const { data } = await axios.get('https://photon.komoot.io/api/', {
    params: { q, limit: 15, lang: 'en' },
    timeout: 5000
  });
  if (!data?.features) return [];
  return data.features
    .map((feat, idx) => {
      const p = feat.properties || {};
      const [lon, lat] = feat.geometry?.coordinates || [];
      if (typeof lat !== 'number' || typeof lon !== 'number') return null;

      // We only care about real places (not POIs / shops / streets).
      const isPlace =
        p.osm_key === 'place' ||
        p.osm_value === 'country' ||
        p.osm_value === 'state' ||
        p.osm_value === 'aerodrome' ||  // airports
        p.type === 'city' || p.type === 'town' || p.type === 'country';
      if (!isPlace) return null;

      const value = p.osm_value || p.type || 'default';
      const primary = p.name || p.city || p.country;
      if (!primary) return null;

      const country = p.country || (value === 'country' ? primary : '');
      const display_name = country && country !== primary
        ? `${primary}, ${country}`
        : primary;

      const typeRank = VALUE_RANK[value] || VALUE_RANK.default;
      const queryBoost = startsWithBoost(primary, q);
      // Photon orders results by importance internally — preserve that signal.
      const orderBonus = Math.max(0, 30 - idx * 2);

      return {
        display_name,
        city: primary,
        country,
        country_code: (p.countrycode || '').toUpperCase(),
        lat,
        lon,
        type: value,
        score: typeRank + queryBoost + orderBonus,
        provider: 'photon'
      };
    })
    .filter(Boolean);
}

/* ---------- Nominatim (fallback) ---------- */
async function fetchNominatim(q) {
  const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q,
      format: 'json',
      addressdetails: 1,
      limit: 12,
      'accept-language': 'en'
    },
    headers: { 'User-Agent': 'TravelAI-PFE-Premium/1.5 (contact@travelai.example)' },
    timeout: 5000
  });
  return (data || [])
    .map((item) => {
      const addr = item.address || {};
      const fallbackPart = (item.display_name || '').split(',')[0]?.trim();
      const primary =
        addr.city || addr.town || addr.village || addr.municipality ||
        addr.county || addr.state || addr.region || addr.country || fallbackPart;
      if (!primary) return null;

      const country = addr.country || (item.type === 'country' ? primary : '');
      const display_name = country && country !== primary ? `${primary}, ${country}` : primary;

      const value = item.type || item.class || 'default';
      const typeRank = VALUE_RANK[value] || VALUE_RANK.default;
      const importance = parseFloat(item.importance || 0) * 100;

      return {
        display_name,
        city: primary,
        country,
        country_code: (addr.country_code || '').toUpperCase(),
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: value,
        score: typeRank + importance + startsWithBoost(primary, q),
        provider: 'nominatim'
      };
    })
    .filter((v) => v && !Number.isNaN(v.lat) && !Number.isNaN(v.lon));
}

// GET /api/search/proxy?q=...
router.get('/proxy', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);

    // Cache hit
    const cacheKey = q.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.t < CACHE_TTL) {
      return res.json(cached.data);
    }

    // Try Photon first (much better for autocomplete UX)
    let raw = [];
    try {
      raw = await fetchPhoton(q);
    } catch (e) {
      console.warn('Photon failed:', e.message);
    }

    // Fallback to Nominatim if Photon returned nothing
    if (raw.length === 0) {
      try {
        raw = await fetchNominatim(q);
      } catch (e) {
        console.warn('Nominatim fallback failed:', e.message);
      }
    }

    // Dedupe and sort
    const seen = new Set();
    const results = raw
      .filter((r) => {
        const key = dedupeKey(r);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    cache.set(cacheKey, { t: Date.now(), data: results });
    if (cache.size > 500) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].t - b[1].t).slice(0, 100);
      oldest.forEach(([k]) => cache.delete(k));
    }

    res.json(results);
  } catch (error) {
    console.error('Search Proxy Error:', error.message);
    res.json([]);
  }
});

module.exports = router;

