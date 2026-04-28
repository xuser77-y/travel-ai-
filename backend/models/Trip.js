const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  name: String,
  category: String,
  cost: Number,
  duration: String,
  lat: Number,
  lon: Number,
  isIndoor: Boolean,
  description: String,
  photo: String
});

const SessionSchema = new mongoose.Schema({
  time: String,
  activity: ActivitySchema
});

const DaySchema = new mongoose.Schema({
  dayNumber: Number,
  date: Date,
  sessions: [SessionSchema]
});

const TripSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  destination: {
    name: String,
    lat: Number,
    lon: Number,
    photo: String
  },
  dates: {
    start: Date,
    end: Date
  },
  travelers: String, // solo, couple, family, group
  budget: {
    total: Number,
    currency: String,
    breakdown: {
      flights: Number,
      hotels: Number,
      activities: Number,
      food: Number,
      other: Number
    }
  },
  style: String, // economy, balanced, comfort, luxury
  interests: [String],
  itinerary: [DaySchema],
  weather: mongoose.Schema.Types.Mixed,
  flights: {
    affiliateLink: String,
    price: Number,
    suggestion: String
  },
  hotels: {
    affiliateLink: String,
    price: Number,
    name: String,
    description: String
  },
  summary: String,
  chatRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom' },
  status: { type: String, default: 'draft' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Trip', TripSchema);
