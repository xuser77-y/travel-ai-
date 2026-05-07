const express = require('express');
const router = express.Router();
const LivePost = require('../models/LivePost');
const {
  inferSentiment,
  clusterPosts,
  scorePosts,
  generateAreaSummary
} = require('../services/livePostService');

// GET /api/livemap/posts?lat=&lon=&radiusKm=&type=
router.get('/posts', async (req, res) => {
  try {
    const { lat, lon, radiusKm, type, limit = 200 } = req.query;
    const filter = {};
    if (type) filter.type = type;

    let posts = await LivePost.find(filter).sort({ createdAt: -1 }).limit(Number(limit));

    if (lat && lon && radiusKm) {
      const userLat = parseFloat(lat);
      const userLon = parseFloat(lon);
      const r = parseFloat(radiusKm);
      posts = posts.filter((p) => {
        const dLat = (p.location.lat - userLat) * 111;
        const dLon = (p.location.lon - userLon) * 111 * Math.cos((userLat * Math.PI) / 180);
        return Math.sqrt(dLat * dLat + dLon * dLon) <= r;
      });
    }

    const userLat = lat ? parseFloat(lat) : undefined;
    const userLon = lon ? parseFloat(lon) : undefined;
    const ranked = scorePosts(posts, userLat, userLon);

    res.json({ count: ranked.length, posts: ranked });
  } catch (err) {
    console.error('GET /livemap/posts error:', err);
    res.status(500).json({ error: 'Failed to fetch live posts' });
  }
});

// POST /api/livemap/posts — gated by the `livemap` feature so only Pro+
// subscribers (and admins) can drop pins. Reading posts is still public.
const { requireAuth, requireFeature } = require('../middleware/planGate');
router.post('/posts', requireAuth, requireFeature('livemap'), async (req, res) => {
  try {
    const { type, message, location, author, authorId } = req.body;
    if (!type || !message || !location?.lat || !location?.lon) {
      return res.status(400).json({ error: 'type, message, and location are required' });
    }
    const sentiment = inferSentiment(type);
    const post = await LivePost.create({
      author: author || 'Anonymous Traveler',
      authorId: authorId || undefined,
      type,
      message: String(message).slice(0, 280),
      location,
      sentiment
    });

    // Broadcast via socket if available
    const io = req.app.get('io');
    if (io) io.emit('livemap:new_post', post);

    // Freemium counter — free users burn one use per successful livemap
    // post. Done after `LivePost.create` so a DB error doesn't waste a use.
    const planService = require('../services/planService');
    const User = require('../models/User');
    if (planService.effectivePlan(req.user) === 'free' && !req.user.isAdmin) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { freeTripsUsed: 1 } });
    }

    res.status(201).json(post);
  } catch (err) {
    console.error('POST /livemap/posts error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// DELETE /api/livemap/posts/:id
// Body or query: { authorId } - must match the post's authorId.
// This is a lightweight ownership check (no auth in this PFE), but it
// prevents random clients from nuking other users' posts.
router.delete('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authorId = req.body?.authorId || req.query?.authorId;
    if (!authorId) {
      return res.status(400).json({ error: 'authorId is required' });
    }

    const post = await LivePost.findById(id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (!post.authorId || String(post.authorId) !== String(authorId)) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    await post.deleteOne();

    const io = req.app.get('io');
    if (io) io.emit('livemap:delete_post', { _id: id });

    res.json({ ok: true, _id: id });
  } catch (err) {
    console.error('DELETE /livemap/posts/:id error:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// GET /api/livemap/clusters?bbox=south,west,north,east
router.get('/clusters', async (req, res) => {
  try {
    const posts = await LivePost.find().sort({ createdAt: -1 }).limit(500);
    const clusters = clusterPosts(posts);
    res.json({ count: clusters.length, clusters });
  } catch (err) {
    console.error('GET /livemap/clusters error:', err);
    res.status(500).json({ error: 'Failed to compute clusters' });
  }
});

// POST /api/livemap/summary  body: { posts: [...] } or { clusterId }
router.post('/summary', async (req, res) => {
  try {
    const { posts: clientPosts, location, radiusKm = 1 } = req.body;
    let posts = clientPosts;
    if (!posts && location?.lat && location?.lon) {
      const all = await LivePost.find().sort({ createdAt: -1 }).limit(200);
      posts = all.filter((p) => {
        const dLat = (p.location.lat - location.lat) * 111;
        const dLon = (p.location.lon - location.lon) * 111 * Math.cos((location.lat * Math.PI) / 180);
        return Math.sqrt(dLat * dLat + dLon * dLon) <= radiusKm;
      });
    }
    if (!posts || posts.length === 0) {
      return res.json({ summary: 'No recent activity in this area.', action: 'monitor' });
    }
    const negatives = posts.filter((p) => p.sentiment === 'negative').length;
    const positives = posts.filter((p) => p.sentiment === 'positive').length;
    const dominant =
      negatives > positives ? 'negative' : positives > negatives ? 'positive' : 'neutral';

    const cluster = {
      sample: posts.slice(0, 8).map((p) => p.message),
      dominantSentiment: dominant,
      types: [...new Set(posts.map((p) => p.type))]
    };
    const result = await generateAreaSummary(cluster);
    res.json(result);
  } catch (err) {
    console.error('POST /livemap/summary error:', err);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// POST /api/livemap/seed  -- dev helper to populate demo posts
router.post('/seed', async (req, res) => {
  try {
    const samples = [
      { type: 'crowd', message: 'Hassan II Mosque entrance is packed, 40-min queue right now.', location: { lat: 33.6086, lon: -7.6326, name: 'Hassan II Mosque' } },
      { type: 'food', message: 'Amazing pastilla at Rick\'s Café, definitely worth it!', location: { lat: 33.5997, lon: -7.6214, name: 'Rick\'s Café' } },
      { type: 'transport', message: 'Tramway T1 delayed about 15 min near Place Mohammed V.', location: { lat: 33.5905, lon: -7.6184, name: 'Place Mohammed V' } },
      { type: 'safety', message: 'Avoid the side alleys near the old medina after dark.', location: { lat: 33.5957, lon: -7.6212, name: 'Casablanca Medina' } },
      { type: 'weather', message: 'Sunny and breezy on La Corniche right now, perfect walk.', location: { lat: 33.6010, lon: -7.6760, name: 'Ain Diab Corniche' } },
      { type: 'positive', message: 'Stadium tour tickets available, no queue. Great time!', location: { lat: 33.5731, lon: -7.5898, name: 'Stade Mohammed V' } },
      { type: 'warning', message: 'Heavy traffic on the A3 toward Rabat right now.', location: { lat: 33.7000, lon: -7.4000, name: 'A3 Highway' } },
      { type: 'food', message: 'Fresh seafood at Port de Pêche, ask for the daily catch.', location: { lat: 33.6055, lon: -7.6175, name: 'Port de Pêche' } },
      { type: 'crowd', message: 'Long line at Marrakech Jemaa el-Fna, very busy tonight.', location: { lat: 31.6258, lon: -7.9891, name: 'Jemaa el-Fna' } },
      { type: 'positive', message: 'Souk in Fez is calm now, easy to negotiate prices.', location: { lat: 34.0640, lon: -4.9760, name: 'Fez Medina' } }
    ];
    await LivePost.deleteMany({});
    const created = await LivePost.insertMany(
      samples.map((s) => ({ ...s, sentiment: inferSentiment(s.type) }))
    );
    res.json({ inserted: created.length });
  } catch (err) {
    console.error('POST /livemap/seed error:', err);
    res.status(500).json({ error: 'Failed to seed' });
  }
});

module.exports = router;
