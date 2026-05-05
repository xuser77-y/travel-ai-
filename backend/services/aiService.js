const Groq = require("groq-sdk");
const promptService = require('./promptService');
require('dotenv').config();

const cleanJsonResponse = (content) => {
  try {
    // Remove any markdown code blocks if present
    let cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Fix common stray characters (like the backtick found in the user error)
    cleaned = cleaned.replace(/`|\\`/g, "'"); 
    
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse or clean JSON:', e.message);
    return null;
  }
};

const generateItinerary = async (tripData) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY is missing in .env file');
    return null;
  }

  const groq = new Groq({ apiKey });

  try {
    const { destination, startCity, dates, travelers, budget, style, interests, dietary, weather, weatherDaily, pois, nights } = tripData;

    // Build the rendering context from tripData so the prompt template can
    // reference variables via {{dot.notation}}.
    const context = {
      destination,
      startCity: startCity || '',
      dates,
      nights: nights || '',
      travelers,
      budget,
      style,
      interests: Array.isArray(interests) ? interests.join(', ') : interests,
      dietary: Array.isArray(dietary) ? dietary.join(', ') : dietary,
      weather,
      weatherDaily,
      pois
    };

    const { system, user } = await promptService.resolveForCall('itinerary.generate', context);

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });

    return cleanJsonResponse(chatCompletion.choices[0].message.content);

  } catch (error) {
    if (error.status === 429) {
      console.warn('Groq Rate Limit hit. Retrying in 3s...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return generateItinerary(tripData); // Recursive retry
    }
    console.error('Error generating itinerary with Groq:', error.message);
    return null;
  }
};

const refineItinerary = async (currentTrip, userMessage) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const groq = new Groq({ apiKey });

  try {
    const context = {
      destination: currentTrip.destination?.name || '',
      style: currentTrip.style || '',
      budget: currentTrip.budget || {},
      userMessage: userMessage || ''
    };

    const { system, user } = await promptService.resolveForCall('itinerary.refine', context);

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Current Itinerary JSON: ${JSON.stringify(currentTrip)}` },
        { role: "user", content: user }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });

    return cleanJsonResponse(completion.choices[0].message.content);
  } catch (error) {
    if (error.status === 429) {
      console.warn('Groq Refine Rate Limit hit. Retrying in 3s...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return refineItinerary(currentTrip, userMessage);
    }
    console.error('Error refining itinerary:', error.message);
    return null;
  }
};

module.exports = { generateItinerary, refineItinerary };
