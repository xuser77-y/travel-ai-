const AiPrompt = require('../models/AiPrompt');

/**
 * Prompt registry + loader.
 *
 * - DEFAULTS is the canonical list of every LLM prompt the app uses. Each
 *   entry declares the `key`, a human-readable title/description, the list
 *   of variable names the template can use, and the default system + user
 *   templates.
 * - Admins can override `systemPrompt` and `userTemplate` through the admin
 *   UI; overrides are stored in the AiPrompt collection and win over
 *   defaults. Resetting simply deletes the override document.
 * - Templates use `{{path.to.variable}}` placeholders that `render()` walks
 *   through the provided context. Missing values render as empty strings to
 *   avoid crashing prompt generation.
 */

const DEFAULTS = [
  {
    key: 'itinerary.generate',
    title: 'Itinerary — Generate',
    description:
      'Used by the trip planner to produce the full day-by-day itinerary from the form data, weather forecast and nearby POIs.',
    variables: [
      'destination',
      'startCity',
      'dates.start',
      'dates.end',
      'nights',
      'travelers',
      'style',
      'budget.currency',
      'budget.total',
      'budget.flights',
      'budget.hotels',
      'interests',
      'dietary',
      'weather',
      'weatherDaily',
      'pois'
    ],
    systemPrompt:
      'You are a travel planning assistant that outputs only strict, valid JSON. Never use backticks in strings. You MUST honour the requested schema exactly.',
    userTemplate: `You are a world-class travel planner. Generate a highly detailed, professional itinerary along with concrete flight & hotel recommendations.

Destination: {{destination}}
Departure city: {{startCity}}
Dates: {{dates.start}} to {{dates.end}} ({{nights}} nights)
Travelers: {{travelers}}
Style: {{style}}
Total budget: {{budget.currency}} {{budget.total}} (≈ flights {{budget.flights}}, hotels {{budget.hotels}})
Interests: {{interests}}
Dietary Preferences: {{dietary}}
Per-day weather verdict: {{weatherDaily}}
Raw weather forecast: {{weather}}
Available POIs from Map Service: {{pois}}

CRITICAL REQUIREMENTS:
1. ITINERARY: For EVERY day in the date range, output ONE day object. Each day MUST contain exactly 4 sessions in this order: "Morning", "Lunch", "Afternoon", "Evening".
2. WEATHER-AWARE: For each day, look at the matching entry in "Per-day weather verdict". If rating is "poor" or "fair" with precipitation, pick INDOOR activities (museums, galleries, covered markets, hammams, indoor restaurants). On "excellent"/"good" days, prefer outdoor experiences. Set "isIndoor": true/false on every activity accordingly.
3. REAL COORDINATES: You MUST use POIs from the "Available POIs" list for at least 90% of activities, with their EXACT name, "lat" and "lon". If a POI isn't suitable, use the coordinates of the nearest major landmark from the list — NEVER invent coordinates.
4. FOOD: Every "Lunch" and "Evening" session MUST be a specific named restaurant in {{destination}} with realistic cost in {{budget.currency}} and respect the dietary preferences.
5. COST: Every activity and meal MUST have a realistic cost number in {{budget.currency}} (use 0 for free attractions). Activity totals across all days SHOULD fit within the activities portion of the budget.
6. LOGISTICS: Include a short "transportSuggestion" string for each day (metro line, walking, taxi, etc.).

FLIGHTS — be precise and useful:
- Pick ONE primary recommendation from "{{startCity}}" to "{{destination}}" matching the {{style}} class (economy/balanced -> economy, comfort -> premium economy, luxury -> business).
- Estimated price MUST be a realistic round-trip total in {{budget.currency}} for {{travelers}}, calibrated to the flights budget ({{budget.flights}}).
- Always include "stops" (0 = direct), realistic "durationHours", a 1-line "baggageTip" and a 1-line "bookingTip" (best day to book / cheapest weekday / etc.).
- Do NOT output alternative flights — only the single best pick.

HOTELS — be precise and useful:
- Pick ONE primary hotel that fits {{style}} and the hotels budget ({{budget.hotels}}) for {{nights}} nights.
- Provide 2 alternative hotel options at different price points / neighborhoods.
- "pricePerNight" MUST be realistic in {{budget.currency}}; we will multiply by nights to get total stay.
- Always include "neighborhood", "stars" (1-5), and 3-6 "amenities" (e.g. "Wi-Fi","Breakfast","Pool","Spa","Gym","Family rooms").
- Include a 1-line "bookingTip" (best site, free-cancellation advice, off-peak deal, etc.).

Return ONLY valid JSON in this EXACT schema (no extra keys, no backticks anywhere):
{
  "summary": "string",
  "hotel": {
    "name": "string",
    "description": "string",
    "stars": number,
    "pricePerNight": number,
    "address": "string",
    "neighborhood": "string",
    "amenities": ["string"],
    "bookingTip": "string"
  },
  "alternativeHotels": [
    { "name": "string", "description": "string", "stars": number, "pricePerNight": number, "neighborhood": "string", "amenities": ["string"], "reason": "string" }
  ],
  "flights": {
    "suggestion": "string",
    "estimatedPrice": number,
    "airline": "string",
    "flightClass": "Economy|Premium Economy|Business|First",
    "stops": number,
    "durationHours": number,
    "baggageTip": "string",
    "bookingTip": "string"
  },
  "days": [
    {
      "dayNumber": number,
      "date": "YYYY-MM-DD",
      "transportSuggestion": "string",
      "sessions": [
        { "time": "Morning|Lunch|Afternoon|Evening", "activity": { "name": "string", "description": "string", "cost": number, "duration": "string", "lat": number, "lon": number, "category": "string", "isIndoor": boolean } }
      ]
    }
  ]
}`
  },
  {
    key: 'itinerary.refine',
    title: 'Itinerary — Refine (chat)',
    description:
      'Used by the AI chat on the Trip Results page when the user asks for changes to an existing itinerary.',
    variables: [
      'destination',
      'style',
      'budget.currency',
      'userMessage'
    ],
    systemPrompt:
      'You are the {{destination}} Travel Expert. You edit itineraries IN PLACE. The data shape is `itinerary[day].sessions[]` where each session is `{ time, activity }`. You NEVER duplicate sessions for the same time slot. You replace, you don\'t accumulate.',
    userTemplate: `You are a specialized Local Travel Expert for {{destination}}.

DATA SHAPE (do not change it):
- trip.itinerary[N].sessions is an array of { time, activity } objects.
- "time" is one of "Morning", "Lunch", "Afternoon", "Evening" (a label, not a clock time).
- "activity" has { name, category, cost, duration, lat, lon, isIndoor, description }.
- Each day has AT MOST ONE session per "time" value. Never two "Morning" sessions on the same day.

STRICT CONSTRAINTS:
1. GEOGRAPHY: stay within {{destination}} unless the user explicitly asks for a day trip.
2. COORDINATES: every activity must have real lat/lon. Do not invent them — use the true coordinates of the place you mention.
3. CONSISTENCY: keep the existing style ({{style}}) and currency ({{budget.currency}}).
4. OUTPUT: return the FULL trip object inside "updatedTrip" — same top-level keys, same array lengths, only the requested change differs.

⚠️ EDIT-IN-PLACE RULES (this is the #1 thing you get wrong — read carefully):
- "Change/replace the {slot} of day N" → find the session with that time on that day and REPLACE its activity. Same array length. Same time label. Different activity content.
- "Replace X with Y" → keep the session, swap activity.name (and related fields) from X's data to Y's data. Do NOT push a new session.
- "Add a Z" → only insert if the matching slot is empty. Never push a second session with a time that already exists that day.
- Preserve fields you weren't asked to touch (other days, other sessions, cost, duration, photos).
- BEFORE you output: mentally count sessions per time slot per day. If any day has two "Morning" sessions, you've made the canonical mistake — fix it before responding.
- NEVER return null inside the sessions array.

USER REQUEST: "{{userMessage}}"

Return ONLY valid JSON in this exact shape:
{
  "aiResponse": "Short (max 2 sentences) friendly explanation of which day + slot you changed and why.",
  "updatedTrip": { ... entire trip object, in-place edit only ... }
}`
  },
  {
    key: 'destination.suggest',
    title: 'Destination — AI Suggestion',
    description:
      'Used by Step 1 of the planner when the user picks "Let AI choose for me" and describes their dream trip. Must return a single real city.',
    variables: ['description'],
    systemPrompt:
      'You are a travel concierge. Pick exactly ONE real, well-known city that best matches the user description. Output strict JSON only.',
    userTemplate: `The traveler describes their dream trip as:
"{{description}}"

Pick exactly ONE real-world city that best matches. Prefer well-known cities so they can be geocoded reliably. Avoid country names, regions, or vague areas.

Return ONLY valid JSON in this exact shape:
{"city": "City name", "country": "Country name", "reason": "One short sentence (max 18 words) explaining the pick."}`
  },
  {
    key: 'livemap.areaSummary',
    title: 'Live Map — Area Summary',
    description:
      'Used by the live map overlay to summarize a cluster of recent traveler posts in one area, producing a short human-readable verdict + recommended action.',
    variables: [
      'posts',
      'dominantSentiment',
      'types'
    ],
    systemPrompt: 'You output only strict JSON. No markdown, no commentary.',
    userTemplate: `You are a real-time travel intelligence analyst. Based on these short live posts from travelers in one area, produce a JSON response with two fields:
- "summary": a single sentence (max 18 words) describing the current situation in this area.
- "action": one of "visit" (good time to go), "avoid" (skip this area), "alternative" (suggest another route), or "monitor" (no strong signal).

Posts:
{{posts}}

Dominant sentiment: {{dominantSentiment}}.
Types reported: {{types}}.

Return ONLY valid JSON: {"summary": "...", "action": "..."}`
  }
];

// ---------------------------------------------------------------------------
// Template rendering — supports {{dot.notation}} and stringifies objects.
// ---------------------------------------------------------------------------
const resolvePath = (ctx, path) => {
  if (!path) return '';
  const parts = String(path).split('.');
  let cur = ctx;
  for (const p of parts) {
    if (cur == null) return '';
    cur = cur[p];
  }
  return cur;
};

const stringifyValue = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const render = (template, context = {}) => {
  if (typeof template !== 'string') return '';
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const value = resolvePath(context, path);
    return stringifyValue(value);
  });
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const getDefault = (key) => DEFAULTS.find((d) => d.key === key) || null;

const listDefaults = () => DEFAULTS.map((d) => ({ ...d }));

// Returns the currently effective prompt (override or default) for a key.
const getPrompt = async (key) => {
  const def = getDefault(key);
  if (!def) return null;
  let override = null;
  try {
    override = await AiPrompt.findOne({ key }).lean();
  } catch (err) {
    console.warn('getPrompt DB error, falling back to default:', err.message);
  }
  return {
    key,
    title: def.title,
    description: def.description,
    variables: def.variables,
    systemPrompt: override?.systemPrompt || def.systemPrompt,
    userTemplate: override?.userTemplate || def.userTemplate,
    isOverridden: !!override,
    updatedAt: override?.updatedAt || null,
    updatedBy: override?.updatedBy || null,
    defaults: { systemPrompt: def.systemPrompt, userTemplate: def.userTemplate }
  };
};

// Lists every prompt with its current effective value (for the admin UI).
const listPrompts = async () => {
  const overrides = await AiPrompt.find().lean();
  const byKey = new Map(overrides.map((o) => [o.key, o]));
  return DEFAULTS.map((def) => {
    const override = byKey.get(def.key);
    return {
      key: def.key,
      title: def.title,
      description: def.description,
      variables: def.variables,
      systemPrompt: override?.systemPrompt || def.systemPrompt,
      userTemplate: override?.userTemplate || def.userTemplate,
      isOverridden: !!override,
      updatedAt: override?.updatedAt || null,
      updatedBy: override?.updatedBy || null,
      defaults: { systemPrompt: def.systemPrompt, userTemplate: def.userTemplate }
    };
  });
};

const setPrompt = async (key, { systemPrompt, userTemplate }, editor) => {
  const def = getDefault(key);
  if (!def) throw new Error(`Unknown prompt key: ${key}`);
  const update = {
    key,
    systemPrompt: typeof systemPrompt === 'string' ? systemPrompt : def.systemPrompt,
    userTemplate: typeof userTemplate === 'string' ? userTemplate : def.userTemplate,
    updatedAt: new Date(),
    updatedBy: editor
      ? { userId: editor.userId || editor._id || editor.id, email: editor.email }
      : undefined
  };
  return AiPrompt.findOneAndUpdate({ key }, update, { upsert: true, new: true });
};

const resetPrompt = async (key) => {
  const def = getDefault(key);
  if (!def) throw new Error(`Unknown prompt key: ${key}`);
  await AiPrompt.deleteOne({ key });
  return def;
};

// Convenience helper for consumers: fetch effective prompt and render both
// system + user templates in a single call.
const resolveForCall = async (key, context = {}) => {
  const prompt = await getPrompt(key);
  if (!prompt) throw new Error(`Unknown prompt key: ${key}`);
  return {
    system: render(prompt.systemPrompt, context),
    user: render(prompt.userTemplate, context)
  };
};

module.exports = {
  DEFAULTS,
  listDefaults,
  getDefault,
  getPrompt,
  listPrompts,
  setPrompt,
  resetPrompt,
  render,
  resolveForCall
};
