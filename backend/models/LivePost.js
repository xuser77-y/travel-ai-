const mongoose = require('mongoose');

const LivePostSchema = new mongoose.Schema({
  author: { type: String, default: 'Anonymous Traveler' },
  // String to support both logged-in user IDs and guest UUIDs.
  authorId: { type: String, index: true },
  type: {
    type: String,
    enum: ['crowd', 'food', 'transport', 'weather', 'safety', 'positive', 'warning'],
    required: true,
    index: true
  },
  message: { type: String, required: true, maxlength: 280 },
  location: {
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    name: { type: String, default: '' }
  },
  // Severity drives marker color: positive=green, warning=yellow, problem=red
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative'],
    default: 'neutral',
    index: true
  },
  upvotes: { type: Number, default: 0 },
  // Optional photo attached to the post. Stored as a base64 data URL
  // (`data:image/jpeg;base64,...`) directly in the document. The route
  // caps the encoded length to ~3 MB so a single field never blows up
  // the BSON 16 MB document limit. We deliberately don't index it.
  image: { type: String, default: '' },
  // TTL: posts auto-expire after 24 hours
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), index: { expires: 0 } }
}, { timestamps: true });

LivePostSchema.index({ 'location.lat': 1, 'location.lon': 1 });
LivePostSchema.index({ createdAt: -1 });

module.exports = mongoose.model('LivePost', LivePostSchema);
