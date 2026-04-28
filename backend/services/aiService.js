const Groq = require("groq-sdk");
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
    const { destination, dates, travelers, budget, style, interests, dietary, weather, pois } = tripData;

    const prompt = `
      You are a world-class travel planner. Generate a highly detailed, professional, and luxury-oriented travel itinerary.
      
      Destination: ${destination}
      Dates: ${dates.start} to ${dates.end}
      Travelers: ${travelers}
      Style: ${style}
      Budget: ${budget.currency} ${budget.total}
      Interests: ${interests.join(', ')}
      Dietary Preferences: ${dietary.join(', ')}
      Weather Forecast: ${JSON.stringify(weather)}
      Available POIs from Map Service: ${JSON.stringify(pois)}

      CRITICAL REQUIREMENTS:
      1. ITINERARY: For EVERY day, provide 4 sessions: "Morning", "Lunch", "Afternoon", and "Evening".
      2. REAL COORDINATES: You MUST prioritize using the "Available POIs" provided above. For any activity or restaurant you choose, you MUST provide its exact "lat" and "lon". If you suggest a place NOT in the POI list, you MUST ensure its coordinates are realistic and precise for ${destination}.
      3. ACTIVITIES: Mix landmarks with hidden gems. Provide engaging descriptions (NO backticks or special characters inside strings).
      3. FOOD: Every "Lunch" and "Evening" session MUST be a specific restaurant recommendation in ${destination}.
      4. HOTEL: Provide a specific hotel recommendation that fits the profile.
      5. COST: Every activity and meal MUST have a realistic cost estimate in ${budget.currency}.
      6. LOGISTICS: Include a "transportSuggestion" for each day.

      Return ONLY valid JSON. Ensure NO stray characters like backticks are inside values.
      
      HARD REQUIREMENT FOR COORDINATES:
      - You are provided with a list of REAL POIs with verified "lat" and "lon".
      - For at least 90% of the activities, you MUST use a POI from the "Available POIs" list.
      - If you use a POI from the list, you MUST use its EXACT name and EXACT "lat" and "lon".
      - If you MUST suggest a place not in the list, you are strictly forbidden from guessing its coordinates; instead, use the coordinates of the nearest major landmark from the POI list.
      
      Schema:
      {
        "summary": "string",
        "hotel": { "name": "string", "description": "string", "stars": number, "pricePerNight": number, "address": "string" },
        "flights": { "suggestion": "string", "estimatedPrice": number },
        "days": [
          {
            "dayNumber": number,
            "date": "YYYY-MM-DD",
            "transportSuggestion": "string",
            "sessions": [
              { "time": "Morning|Lunch|Afternoon|Evening", "activity": { "name": "string", "description": "string", "cost": number, "duration": "string", "lat": number, "lon": number, "category": "string" } }
            ]
          }
        ]
      }
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a travel planning assistant that outputs only strict, valid JSON. Never use backticks in strings." },
        { role: "user", content: prompt }
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
    const prompt = `
      You are a specialized Local Travel Expert for the destination: ${currentTrip.destination.name}.
      
      STRICT CONSTRAINTS:
      1. GEOGRAPHY: You MUST stay within the city limits of ${currentTrip.destination.name}. Do NOT suggest activities in other cities unless the user explicitly asks for a day trip.
      2. MAPPING: Every time you change or add an activity, you MUST provide precise and REAL "lat" and "lon" coordinates. Do NOT hallucinate coordinates; if you suggest a known landmark, use its true geographical position.
      3. CONSISTENCY: Maintain the existing style (${currentTrip.style}) and budget (${currentTrip.budget.currency}).
      4. OUTPUT: You must return the FULL updated trip object inside "updatedTrip".

      USER REQUEST: "${userMessage}"

      Return ONLY valid JSON in this format:
      {
        "aiResponse": "A friendly, expert response explaining exactly what you changed and why it's a great choice for ${currentTrip.destination.name}.",
        "updatedTrip": { 
          ... (the entire trip object with your modifications, ensuring all lat/lon are present and accurate)
        }
      }
    `;

    const completion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `You are the ${currentTrip.destination.name} Travel Expert. You have full authority to modify the itinerary, coordinates, and map markers. You are precise, luxurious in your tone, and strictly local.` 
        },
        { role: "user", content: `Current Itinerary JSON: ${JSON.stringify(currentTrip)}` },
        { role: "user", content: prompt }
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
