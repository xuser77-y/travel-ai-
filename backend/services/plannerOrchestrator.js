const weatherService = require('./weatherService');
const poiService = require('./poiService');
const photoService = require('./photoService');
const aiService = require('./aiService');
const chatService = require('./chatService');
const Trip = require('../models/Trip');

// Compute number of nights between two ISO-ish date strings (>= 1).
const computeNights = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
};

// Maximum trip length the orchestrator will honour. Mirrors the cap in
// `Step2Dates.jsx` (frontend). Defends against direct API callers and old
// cached form data — without this guard the LLM would silently truncate
// long itineraries (a 24-day trip became 8 days for the user).
const MAX_TRIP_DAYS = 10;

// Returns the trip dates clamped to MAX_TRIP_DAYS inclusive (start..end).
const clampTripDates = ({ start, end }) => {
  if (!start || !end) return { start, end };
  const s = new Date(start);
  const e = new Date(end);
  const totalDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
  if (totalDays <= MAX_TRIP_DAYS) return { start, end };
  const capped = new Date(s);
  capped.setDate(capped.getDate() + MAX_TRIP_DAYS - 1);
  return { start, end: capped.toISOString().split('T')[0] };
};

// Build a list of YYYY-MM-DD strings covering [start..end] inclusive.
const expandDays = (start, end) => {
  const out = [];
  const s = new Date(start);
  const e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(new Date(d).toISOString().split('T')[0]);
  }
  return out.length ? out : [new Date(start).toISOString().split('T')[0]];
};

const generateFullTrip = async (formData, userId) => {
  const { destination, startCity, dates: rawDates, travelers, budget, style, interests, dietary } = formData;
  const { lat, lon, name } = destination;

  // Hard server-side cap: any caller (FE, postman, replayed request) gets
  // their range trimmed to MAX_TRIP_DAYS so the LLM and the weather API
  // both stay within their reliable budgets.
  const dates = clampTripDates(rawDates || {});
  if (rawDates?.end && dates.end !== rawDates.end) {
    console.warn(
      `Trip range ${rawDates.start} → ${rawDates.end} clamped to ${dates.end} (max ${MAX_TRIP_DAYS} days).`
    );
  }

  console.log(`Starting generation for ${name}...`);

  try {
    // 1. Fetch data in parallel
    const [weather, pois, destinationPhoto] = await Promise.all([
      weatherService.getForecast(lat, lon, dates.start, dates.end),
      poiService.getActivities(lat, lon, interests),
      photoService.getDestinationPhoto(name)
    ]);

    // 1b. Build per-day weather verdict (rating + advice) used by both the
    //     prompt and the UI to surface "good day" / "bad day" signals.
    const weatherDaily = weatherService.summarizeForecast(weather);
    const nights = computeNights(dates.start, dates.end);

    // 1c. Pre-compute the budget allocation so the AI knows the rough flights
    //     and hotels envelope it has to fit (and so we keep a single source
    //     of truth between the prompt and the saved breakdown).
    const allocations = {
      economy:  { flights: 0.4,  hotels: 0.3,  food: 0.15, activities: 0.1,  other: 0.05 },
      balanced: { flights: 0.3,  hotels: 0.3,  food: 0.2,  activities: 0.15, other: 0.05 },
      comfort:  { flights: 0.25, hotels: 0.35, food: 0.2,  activities: 0.15, other: 0.05 },
      luxury:   { flights: 0.2,  hotels: 0.4,  food: 0.2,  activities: 0.15, other: 0.05 }
    };
    const styleAlloc = allocations[style] || allocations.balanced;
    const breakdown = {
      flights: Math.round(budget.total * styleAlloc.flights),
      hotels: Math.round(budget.total * styleAlloc.hotels),
      food: Math.round(budget.total * styleAlloc.food),
      activities: Math.round(budget.total * styleAlloc.activities),
      other: Math.round(budget.total * styleAlloc.other)
    };

    // 2. Generate AI Itinerary
    let itineraryData = await aiService.generateItinerary({
      destination: name,
      startCity: startCity || '',
      dates,
      nights,
      travelers,
      budget: { total: budget.total, currency: budget.currency, flights: breakdown.flights, hotels: breakdown.hotels },
      style,
      interests,
      dietary,
      weather,
      weatherDaily,
      pois
    });

    // Fallback if AI fails (e.g. rate limit / insufficient balance) — produce
    // one POI-rotated day for EVERY date in the requested range so the UI
    // doesn't render a single-day trip for week-long plans.
    if (!itineraryData) {
      console.warn('AI Generation failed. Falling back to POI-based itinerary.');
      const dayDates = expandDays(dates.start, dates.end);
      const fallbackPick = (i, fallback) => pois[i % Math.max(1, pois.length)] || fallback;
      itineraryData = {
        days: dayDates.map((date, idx) => ({
          dayNumber: idx + 1,
          date,
          transportSuggestion: 'Local taxi or public transport',
          sessions: [
            { time: 'Morning',   activity: fallbackPick(idx * 3,     { name: 'City Exploration', description: 'Discover the heart of the city.', lat, lon, cost: 0 }) },
            { time: 'Lunch',     activity: fallbackPick(idx * 3 + 1, { name: 'Local Restaurant', description: 'Try a regional specialty.',       lat, lon, cost: 25 }) },
            { time: 'Afternoon', activity: fallbackPick(idx * 3 + 2, { name: 'Local Landmark',   description: 'Visit a famous spot.',            lat, lon, cost: 10 }) },
            { time: 'Evening',   activity: fallbackPick(idx * 3 + 3, { name: 'Dinner',           description: 'Enjoy local cuisine.',            lat, lon, cost: 40 }) }
          ]
        }))
      };
    }

    // 3. Merge per-day weather verdict into the itinerary days so the FE
    //     can render a chip per day without needing to align arrays itself.
    const weatherByDate = new Map(weatherDaily.map((w) => [w.date, w]));
    const enrichedDays = (itineraryData.days || []).map((day, idx) => {
      const dateKey = day.date ? new Date(day.date).toISOString().split('T')[0] : weatherDaily[idx]?.date;
      return { ...day, weatherSummary: weatherByDate.get(dateKey) || weatherDaily[idx] || null };
    });

    // 3c. Hotel pricing: prefer the AI's per-night price * nights for a
    //     realistic stay total. Fall back to the budget allocation only
    //     when the AI produced nothing usable.
    const aiHotel = itineraryData.hotel || {};
    const aiPricePerNight = Number(aiHotel.pricePerNight) || null;
    const hotelStayTotal = aiPricePerNight ? aiPricePerNight * nights : breakdown.hotels;

    // 3d. Flights total: use AI estimate if reasonable, else fall back to
    //     the style-based budget allocation.
    const aiFlights = itineraryData.flights || {};
    const flightTotal = Number(aiFlights.estimatedPrice) || breakdown.flights;

    // 4. Handle Dynamic Chat Room
    const chatRoom = await chatService.findOrCreateRoom(name, dates.start, dates.end, userId);

    // 5. Create and Save Trip
    const newTrip = new Trip({
      userId,
      destination: { name, lat, lon, photo: destinationPhoto },
      dates,
      travelers,
      budget: {
        total: budget.total,
        currency: budget.currency,
        breakdown
      },
      style,
      interests,
      itinerary: enrichedDays,
      weather,
      weatherDaily,
      flights: {
        affiliateLink: '#',
        price: flightTotal,
        suggestion: aiFlights.suggestion,
        airline: aiFlights.airline,
        flightClass: aiFlights.flightClass,
        stops: typeof aiFlights.stops === 'number' ? aiFlights.stops : null,
        durationHours: Number(aiFlights.durationHours) || null,
        baggageTip: aiFlights.baggageTip,
        bookingTip: aiFlights.bookingTip
      },
      hotels: {
        affiliateLink: '#',
        price: hotelStayTotal,
        pricePerNight: aiPricePerNight,
        name: aiHotel.name,
        description: aiHotel.description,
        stars: Number(aiHotel.stars) || null,
        address: aiHotel.address,
        neighborhood: aiHotel.neighborhood,
        amenities: Array.isArray(aiHotel.amenities) ? aiHotel.amenities : [],
        bookingTip: aiHotel.bookingTip,
        options: Array.isArray(itineraryData.alternativeHotels) ? itineraryData.alternativeHotels : []
      },
      summary: itineraryData.summary,
      chatRoom: chatRoom?._id,
      status: 'generated'
    });

    await newTrip.save();
    const populatedTrip = await Trip.findById(newTrip._id).populate('chatRoom');
    return populatedTrip;

  } catch (error) {
    console.error('Error in Planner Orchestrator:', error.message);
    throw error;
  }
};

module.exports = { generateFullTrip };
