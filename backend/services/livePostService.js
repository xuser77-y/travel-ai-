const Groq = require('groq-sdk');
require('dotenv').config();

// Sentiment inference from type
const inferSentiment = (type) => {
  const map = {
    positive: 'positive',
    food: 'positive',
    weather: 'neutral',
    transport: 'neutral',
    warning: 'neutral',
    crowd: 'negative',
    safety: 'negative'
  };
  return map[type] || 'neutral';
};

// Haversine distance in km
const distanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// Cluster posts within `radiusKm` of each other.
const clusterPosts = (posts, radiusKm = 0.6) => {
  const clusters = [];
  const visited = new Set();

  posts.forEach((post, i) => {
    if (visited.has(i)) return;
    const members = [post];
    visited.add(i);
    posts.forEach((other, j) => {
      if (i === j || visited.has(j)) return;
      const d = distanceKm(
        post.location.lat,
        post.location.lon,
        other.location.lat,
        other.location.lon
      );
      if (d <= radiusKm) {
        members.push(other);
        visited.add(j);
      }
    });
    if (members.length >= 3) {
      const avgLat = members.reduce((s, p) => s + p.location.lat, 0) / members.length;
      const avgLon = members.reduce((s, p) => s + p.location.lon, 0) / members.length;
      const negatives = members.filter((m) => m.sentiment === 'negative').length;
      const positives = members.filter((m) => m.sentiment === 'positive').length;
      const dominant =
        negatives > positives ? 'negative' : positives > negatives ? 'positive' : 'neutral';
      clusters.push({
        id: `cluster_${i}`,
        center: { lat: avgLat, lon: avgLon },
        size: members.length,
        dominantSentiment: dominant,
        sample: members.slice(0, 5).map((m) => m.message),
        types: [...new Set(members.map((m) => m.type))]
      });
    }
  });
  return clusters;
};

// Score recency * proximity * importance.
const scorePosts = (posts, userLat, userLon) => {
  const now = Date.now();
  const importance = { safety: 5, crowd: 4, transport: 3, weather: 2, food: 2, warning: 3, positive: 1 };
  return posts
    .map((p) => {
      const ageHours = (now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
      const recency = Math.max(0, 1 - ageHours / 6);
      let proximity = 1;
      if (typeof userLat === 'number' && typeof userLon === 'number') {
        const d = distanceKm(userLat, userLon, p.location.lat, p.location.lon);
        proximity = Math.max(0, 1 - Math.min(d, 50) / 50);
      }
      const imp = (importance[p.type] || 1) / 5;
      const score = recency * 0.5 + proximity * 0.3 + imp * 0.2;
      return { ...(p.toObject ? p.toObject() : p), _score: Number(score.toFixed(3)) };
    })
    .sort((a, b) => b._score - a._score);
};

// Build a fast heuristic summary (offline fallback).
const heuristicSummary = (clusterOrPosts) => {
  const items = Array.isArray(clusterOrPosts) ? clusterOrPosts : clusterOrPosts.sample || [];
  const dominant =
    !Array.isArray(clusterOrPosts) && clusterOrPosts.dominantSentiment
      ? clusterOrPosts.dominantSentiment
      : 'neutral';
  if (dominant === 'negative') {
    return {
      summary: 'This area is currently reporting issues — expect crowds or delays.',
      action: 'avoid'
    };
  }
  if (dominant === 'positive') {
    return {
      summary: 'Travelers report a great experience here — good time to visit!',
      action: 'visit'
    };
  }
  return {
    summary: `Mixed reports from ${items.length} traveler${items.length === 1 ? '' : 's'}.`,
    action: 'monitor'
  };
};

// AI-powered summary via Groq, with heuristic fallback.
const generateAreaSummary = async (cluster) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return heuristicSummary(cluster);

  try {
    const groq = new Groq({ apiKey });
    const prompt = `You are a real-time travel intelligence analyst. Based on these short live posts from travelers in one area, produce a JSON response with two fields:
- "summary": a single sentence (max 18 words) describing the current situation in this area.
- "action": one of "visit" (good time to go), "avoid" (skip this area), "alternative" (suggest another route), or "monitor" (no strong signal).

Posts:
${cluster.sample.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Dominant sentiment: ${cluster.dominantSentiment}.
Types reported: ${cluster.types.join(', ')}.

Return ONLY valid JSON: {"summary": "...", "action": "..."}`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You output only strict JSON. No markdown, no commentary.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.4
    });

    const raw = completion.choices[0].message.content;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.summary && parsed.action) return parsed;
    } catch (_) {
      /* fallthrough */
    }
    return heuristicSummary(cluster);
  } catch (err) {
    console.warn('AI summary fallback:', err.message);
    return heuristicSummary(cluster);
  }
};

module.exports = {
  inferSentiment,
  clusterPosts,
  scorePosts,
  generateAreaSummary,
  heuristicSummary
};
