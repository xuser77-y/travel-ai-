const weatherService = require('./weatherService');
const poiService = require('./poiService');
const photoService = require('./photoService');
const aiService = require('./aiService');
const chatService = require('./chatService');
const Trip = require('../models/Trip');

const generateFullTrip = async (formData, userId) => {
  const { destination, dates, travelers, budget, style, interests, dietary } = formData;
  const { lat, lon, name } = destination;

  console.log(`Starting generation for ${name}...`);

  try {
    // 1. Fetch data in parallel
    const [weather, pois, destinationPhoto] = await Promise.all([
      weatherService.getForecast(lat, lon, dates.start, dates.end),
      poiService.getActivities(lat, lon, interests),
      photoService.getDestinationPhoto(name)
    ]);

    // 2. Generate AI Itinerary
    let itineraryData = await aiService.generateItinerary({
      destination: name,
      dates,
      travelers,
      budget,
      style,
      interests,
      dietary,
      weather,
      pois
    });

    // Fallback if AI fails (e.g. Insufficient Balance)
    if (!itineraryData) {
      console.warn('AI Generation failed. Falling back to POI-based itinerary.');
      itineraryData = {
        days: [
          {
            dayNumber: 1,
            date: dates.start,
            sessions: [
              { time: 'Morning', activity: pois[0] || { name: 'City Exploration', description: 'Discover the heart of the city.', lat, lon } },
              { time: 'Afternoon', activity: pois[1] || { name: 'Local Landmark', description: 'Visit a famous spot.', lat, lon } },
              { time: 'Evening', activity: pois[2] || { name: 'Dinner', description: 'Enjoy local cuisine.', lat, lon } }
            ]
          }
        ]
      };
    }

    // 3. Calculate Budget Breakdown (Simple Engine)
    // Based on style: economy (40/25/20/10/5), balanced, etc.
    const allocations = {
      economy: { flights: 0.4, hotels: 0.3, food: 0.15, activities: 0.1, other: 0.05 },
      balanced: { flights: 0.3, hotels: 0.3, food: 0.2, activities: 0.15, other: 0.05 },
      comfort: { flights: 0.25, hotels: 0.35, food: 0.2, activities: 0.15, other: 0.05 },
      luxury: { flights: 0.2, hotels: 0.4, food: 0.2, activities: 0.15, other: 0.05 }
    };

    const styleAlloc = allocations[style] || allocations.balanced;
    const breakdown = {
      flights: budget.total * styleAlloc.flights,
      hotels: budget.total * styleAlloc.hotels,
      food: budget.total * styleAlloc.food,
      activities: budget.total * styleAlloc.activities,
      other: budget.total * styleAlloc.other
    };

    // 4. Handle Dynamic Chat Room
    const chatRoom = await chatService.findOrCreateRoom(name, dates.start, dates.end, userId);

    // 5. Create and Save Trip
    const newTrip = new Trip({
      userId,
      destination: {
        name,
        lat,
        lon,
        photo: destinationPhoto
      },
      dates,
      travelers,
      budget: {
        total: budget.total,
        currency: budget.currency,
        breakdown
      },
      style,
      interests,
      itinerary: itineraryData.days,
      weather,
      flights: {
        affiliateLink: '#',
        price: itineraryData.flights?.estimatedPrice || breakdown.flights,
        suggestion: itineraryData.flights?.suggestion
      },
      hotels: {
        affiliateLink: '#',
        price: itineraryData.hotel?.pricePerNight || breakdown.hotels,
        name: itineraryData.hotel?.name,
        description: itineraryData.hotel?.description
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
