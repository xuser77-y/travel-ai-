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

// Strips heavy / non-essential fields before sending the trip to the LLM.
// Pexels image URLs alone can be 200+ chars and we have one per session —
// they balloon the prompt to 30k+ tokens, slowing the model down and
// making it more likely to drift. Photos are merged back in after.
//
// IMPORTANT: trips use `day.sessions[].activity`, NOT `day.activities`.
// (Schema in models/Trip.js — DaySchema -> sessions: [SessionSchema],
//  SessionSchema -> { time, activity }.)
const slimTripForLLM = (trip) => {
  if (!trip || typeof trip !== 'object') return trip;
  const slim = JSON.parse(JSON.stringify(trip));
  if (slim.destination) {
    delete slim.destination.photo;
    delete slim.destination.photos;
  }
  if (Array.isArray(slim.itinerary)) {
    slim.itinerary.forEach((day) => {
      (day.sessions || []).forEach((s) => {
        if (s && s.activity) {
          delete s.activity.photo;
          delete s.activity.image;
          delete s.activity.images;
        }
      });
    });
  }
  return slim;
};

// Defensive deduplicator. Even with the strict prompt + low temperature
// the LLM sometimes returns two "Morning" sessions on the same day. We
// keep the LAST occurrence (the AI's new edit) per time slot, preserve
// any sessions that have no recognised slot label as-is, drop nulls,
// and re-sort by canonical slot order.
const SLOT_ORDER = {
  morning: 0, breakfast: 1, lunch: 2, afternoon: 3,
  evening: 4, dinner: 5, night: 6
};
const dedupeTimeSlots = (trip) => {
  if (!trip || !Array.isArray(trip.itinerary)) return trip;
  trip.itinerary.forEach((day) => {
    if (!Array.isArray(day.sessions)) return;
    const seen = new Map();   // slot -> session (latest wins)
    const noSlot = [];        // sessions with an unrecognised time label
    day.sessions.forEach((s) => {
      // Drop nulls and shapes the LLM returned wrong (no `activity`).
      if (!s || !s.activity) return;
      const slot = String(s.time || '').toLowerCase().trim();
      if (slot in SLOT_ORDER) {
        seen.set(slot, s);
      } else {
        noSlot.push(s);
      }
    });
    const ordered = Array.from(seen.values()).sort((a, b) => {
      const ai = SLOT_ORDER[String(a.time || '').toLowerCase()] ?? 99;
      const bi = SLOT_ORDER[String(b.time || '').toLowerCase()] ?? 99;
      return ai - bi;
    });
    day.sessions = [...ordered, ...noSlot];
  });
  return trip;
};

// Re-attaches the photos the LLM never saw onto the returned trip so the
// FE doesn't lose images after a refine. We match by (dayIndex, time,
// activity name) which is stable across edits-in-place.
const reattachPhotos = (originalTrip, updatedTrip) => {
  if (!originalTrip || !updatedTrip) return updatedTrip;
  if (originalTrip.destination?.photo && updatedTrip.destination && !updatedTrip.destination.photo) {
    updatedTrip.destination.photo = originalTrip.destination.photo;
  }
  const photoIndex = new Map();
  (originalTrip.itinerary || []).forEach((day, di) => {
    (day.sessions || []).forEach((s) => {
      const a = s?.activity;
      if (a?.photo) photoIndex.set(`${di}|${s.time || ''}|${a.name || ''}`, a.photo);
    });
  });
  (updatedTrip.itinerary || []).forEach((day, di) => {
    (day.sessions || []).forEach((s) => {
      if (!s?.activity) return;
      const key = `${di}|${s.time || ''}|${s.activity.name || ''}`;
      if (!s.activity.photo && photoIndex.has(key)) {
        s.activity.photo = photoIndex.get(key);
      }
    });
  });
  return updatedTrip;
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
    const slimTrip = slimTripForLLM(currentTrip);

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: system },
        // Send the slimmed trip as JSON. Stripping image URLs typically
        // cuts the prompt size by 60-80% which directly translates into
        // a 2-3x faster response and fewer "drift" duplications.
        { role: "user", content: `Current Itinerary JSON: ${JSON.stringify(slimTrip)}` },
        { role: "user", content: user }
      ],
      model: "llama-3.3-70b-versatile",
      // Lower temperature → fewer creative duplicates, more faithful
      // edit-in-place behaviour. Default was 1.0, 0.3 keeps it focused.
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const parsed = cleanJsonResponse(completion.choices[0].message.content);
    if (!parsed) return null;

    // Salvage: the LLM sometimes forgets the `updatedTrip` wrapper and drops
    // the trip shape at the top level (alongside aiResponse). Reconstruct
    // the wrapper in that case so the caller can still save the changes
    // instead of silently returning the unchanged trip.
    if (!parsed.updatedTrip && Array.isArray(parsed.itinerary)) {
      const { aiResponse, ...rest } = parsed;
      parsed.updatedTrip = rest;
    }

    // Hard validation — the route must be able to tell "AI produced an
    // update" apart from "AI only chatted back". Without this, an empty /
    // malformed updatedTrip would $set: {} into Mongo and the FE would see
    // the AI's cheerful "done!" with no visible change to the itinerary.
    if (
      !parsed.updatedTrip ||
      typeof parsed.updatedTrip !== 'object' ||
      !Array.isArray(parsed.updatedTrip.itinerary) ||
      parsed.updatedTrip.itinerary.length === 0
    ) {
      console.warn(
        'Refine: LLM returned no usable updatedTrip. aiResponse=',
        parsed.aiResponse
      );
      return { aiResponse: parsed.aiResponse || '', updatedTrip: null };
    }

    parsed.updatedTrip = dedupeTimeSlots(parsed.updatedTrip);
    parsed.updatedTrip = reattachPhotos(currentTrip, parsed.updatedTrip);

    // Detect a no-op: the LLM sometimes returns a full trip that is
    // structurally identical to the input (same day count, same activity
    // name in each slot). That looks like "success" to the backend but
    // the user sees no visible change. We compare a canonical fingerprint
    // of the itinerary and null out updatedTrip if nothing moved, so the
    // route + FE can treat it as "AI chatted back but didn't edit".
    const fingerprint = (trip) =>
      (trip?.itinerary || [])
        .map((d) =>
          (d.sessions || [])
            .map((s) => `${s?.time || ''}|${s?.activity?.name || ''}|${s?.activity?.cost ?? ''}`)
            .join('»')
        )
        .join('§');
    if (fingerprint(currentTrip) === fingerprint(parsed.updatedTrip)) {
      console.warn(
        'Refine: LLM returned an itinerary identical to input (no-op). aiResponse=',
        parsed.aiResponse
      );
      return { aiResponse: parsed.aiResponse || '', updatedTrip: null };
    }

    return parsed;
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
