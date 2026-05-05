# TravelAI — Architecture, AI Pipeline & Design Patterns

> Companion document to `README.md`. This file zooms in on **how** the platform is built rather than **what** it does. It is meant for new contributors, jury reviewers and future maintainers.

---

## 1. High-level Architecture

```
┌────────────────────────────────────────────────────────────┐
│                       Browser (SPA)                        │
│  React 18 + Vite + Zustand + React Router + Leaflet + MUI  │
│  socket.io-client (singleton)   axios   i18next  framer    │
└──────────────┬───────────────────────────────┬─────────────┘
               │ REST  /api/*                  │ WebSocket
               ▼                               ▼
┌────────────────────────────────────────────────────────────┐
│                Express server (Node.js, port 5000)         │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Routes  (auth, trips, livemap, chat, search,       │    │
│  │          worldcup, admin)                          │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Services  (orchestrator, ai, weather, poi, photo,  │    │
│  │            chat, prompt, password, apiTracker,     │    │
│  │            onlineTracker, livePost)                │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Mongoose models (User, Trip, ChatRoom, LivePost,   │    │
│  │                  AiPrompt, TripRoom)               │    │
│  └────────────────────────────────────────────────────┘    │
│  socket.io  •  JWT  •  scrypt  •  node-cache  •  multer    │
└──────────────┬─────────────────────┬───────────────────────┘
               │                     │
               ▼                     ▼
       ┌──────────────┐      ┌────────────────────────────┐
       │   MongoDB    │      │  External APIs             │
       │ travelai DB  │      │  Groq LLM, Open-Meteo,     │
       └──────────────┘      │  Photon, Nominatim, Pexels,│
                             │  Overpass                  │
                             └────────────────────────────┘
```

The frontend is a single-page Vite app. The backend is a single Express process that hosts both the HTTP API (`/api/*`) and the WebSocket server (`socket.io`) on the same port. MongoDB is the only datastore; everything else is an external HTTP API.

---

## 2. Tech Stack (full inventory)

### Frontend
| Tech | Role |
|------|------|
| **React 18** | UI library, function components + hooks |
| **Vite** | Dev server + build tool |
| **React Router v6** | Declarative routing (`<Routes>` / `<Route>`) |
| **Zustand** (`stores/tripStore.js`) | Tiny global store, replaces Redux for form state, current trip, auth, joined hubs |
| **axios** | HTTP client |
| **socket.io-client** | Single shared socket via `lib/socket.js` |
| **react-leaflet + Leaflet** | All maps (trip route, live map, world cup) |
| **Framer Motion** | Page transitions and the cinematic landing intro |
| **Lucide React** | Icon set |
| **i18next** | EN / FR / AR translations with RTL support |
| **Plain CSS + variables** | Theme tokens, dark/light mode via `body.light-mode` class |
| **In-app providers** | `ToastProvider`, `ConfirmProvider` (replace native `alert`/`confirm`) |

### Backend
| Tech | Role |
|------|------|
| **Node.js + Express** | HTTP server, route handlers, middleware |
| **Mongoose** | MongoDB ODM, schemas in `backend/models/` |
| **socket.io** | WebSockets for live posts, chat, presence, admin metrics |
| **jsonwebtoken** | Stateless JWT auth (Authorization: Bearer …) |
| **crypto.scrypt** (Node built-in) | Password hashing — no bcrypt dependency, with auto-upgrade of legacy plaintext rows |
| **groq-sdk** | LLM client — `llama-3.3-70b-versatile`, `response_format: json_object` |
| **node-cache** | In-memory TTL cache for search/photo/POI/weather lookups |
| **multer** | Multipart upload (live post images → base64 in MongoDB) |
| **axios** | Outbound calls to external APIs |
| **dotenv** | `.env` loading |

### External services
| API | Purpose |
|-----|---------|
| **Groq** | All LLM completions (itinerary, refinement, destination suggestion, area summary) |
| **Open-Meteo** | Daily weather forecast (`/v1/forecast`) |
| **Photon (Komoot)** | Primary destination autocomplete |
| **Nominatim (OSM)** | Fallback geocoder |
| **Pexels** | Destination cover photos |
| **Overpass API** | OSM points-of-interest near a coordinate |

---

## 3. Repository layout

```
test project/
├─ backend/
│  ├─ server.js              # Express + socket.io bootstrap
│  ├─ models/                # Mongoose schemas
│  ├─ routes/                # auth, trips, livemap, chat, search, worldcup, admin
│  └─ services/              # business logic (orchestrator, ai, weather, etc.)
├─ frontend/
│  ├─ src/
│  │  ├─ App.jsx             # Router + global providers
│  │  ├─ pages/              # Landing, Planner steps, TripResults, LiveMap, …
│  │  ├─ components/         # Booking, Budget, Map, Cinematic, UI primitives
│  │  ├─ stores/tripStore.js # Zustand store
│  │  └─ lib/socket.js       # singleton socket
├─ README.md                 # Product / setup / feature overview
├─ ARCH.md                   # This file
└─ project.md                # Original project brief
```

---

## 4. AI Pipeline

The LLM is called from **three** distinct places. All of them go through `services/promptService.js`, which is the single registry of prompts (admin-editable + DB override).

### 4.1 Prompt registry & rendering
`promptService.js` exposes one canonical list of prompt **defaults**. Each default declares:
- `key` (e.g. `itinerary.generate`)
- `title` and `description` (used by the admin editor)
- `variables[]` (allow-list of `{{dot.notation}}` placeholders the template uses)
- `systemPrompt` and `userTemplate` strings

Admins can override `systemPrompt` / `userTemplate` per key from the admin UI; overrides are stored in the `AiPrompt` collection and **win over defaults**. Resetting just deletes the override doc.

`render(template, context)` walks `{{a.b.c}}` placeholders, resolving them against the context object and stringifying values (objects → JSON). Missing values render as empty strings to never break a generation.

`resolveForCall(key, context)` is the one helper consumers actually use:
```js
const { system, user } = await promptService.resolveForCall('itinerary.generate', ctx);
```

### 4.2 The four prompts
| Key | Used by | What it produces |
|-----|---------|------------------|
| `itinerary.generate` | `aiService.generateItinerary()` via `plannerOrchestrator` | Full trip JSON: summary, hotel + alternatives, a single flight pick (airline, class, stops, duration, baggage & booking tips), day-by-day sessions with `isIndoor` and weather-aware picks |
| `itinerary.refine`   | `POST /api/trips/refine` (chat on Trip Results) | `{ aiResponse, updatedTrip }` — the entire trip is re-emitted with edits, preserving lat/lon |
| `destination.suggest`| `POST /api/trips/suggest-destination` (Step 1 "AI choose for me") | Single real city `{ city, country, reason }`, then geocoded by the search proxy |
| `livemap.areaSummary`| Live Map cluster overlay | `{ summary, action }` — short verdict + recommended action for one cluster |

### 4.3 The trip generation pipeline (`plannerOrchestrator.generateFullTrip`)

```
formData (from /api/trips/generate)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Promise.all                                                 │
│  ├─ weatherService.getForecast(lat, lon, start, end)        │
│  ├─ poiService.getActivities(lat, lon, interests)           │
│  └─ photoService.getDestinationPhoto(name)                  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼  build per-day verdict from raw daily forecast
weatherService.summarizeForecast(weather)
    │  (excellent / good / fair / poor + advice + icon)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Style allocation table  (economy / balanced / comfort /     │
│ luxury) → breakdown { flights, hotels, food, activities }   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼   ── single rendering context ──
aiService.generateItinerary({
  destination, startCity, dates, nights, travelers,
  budget: { total, currency, flights, hotels },   // with envelopes
  style, interests, dietary,
  weather, weatherDaily, pois
})
    │
    │   resolveForCall('itinerary.generate') → groq.chat.completions.create
    │   response_format: json_object → cleanJsonResponse() (strips ```json fences and stray backticks)
    ▼
itineraryData { summary, hotel, alternativeHotels[], flights, days[] }
    │
    ▼   merge weather → days[i].weatherSummary
    ▼   compute hotel total = pricePerNight × nights
    ▼   compute flight total = AI estimate || budget envelope
    ▼   chatService.findOrCreateRoom(destination, dates)
    ▼
new Trip(...).save()  →  populate('chatRoom')  →  return
```

If Groq fails (rate-limit / quota / network) the orchestrator falls back to a deterministic **POI-rotated** itinerary that still produces one day per date in the range with the four required sessions. The user always gets a usable trip; the AI just adds polish on top.

### 4.4 The refinement pipeline (chat on Trip Results)

```
POST /api/trips/refine { currentTrip, userMessage }
    │
    ▼
aiService.refineItinerary(currentTrip, userMessage)
    │   resolveForCall('itinerary.refine', { destination, style, budget, userMessage })
    │   completion is fed THREE messages: system, current trip JSON, user template
    ▼
{ aiResponse, updatedTrip }
    │   (if currentTrip._id) → Trip.findByIdAndUpdate(_id, updatedTrip)
    ▼
return to client → Zustand setTrip() → UI re-renders + map markers re-draw
```

### 4.5 Robustness
- **Idempotent JSON parsing** — `cleanJsonResponse()` strips Markdown fences and backticks before `JSON.parse`. Returns `null` on failure so callers can fall back.
- **Retry on 429** — both `generateItinerary` and `refineItinerary` recursively retry once after a 3 s back-off.
- **Hard schema** — every prompt ends with an explicit JSON schema; system prompt repeats "strict JSON, no backticks". `response_format: json_object` is set on the Groq call.

---

## 5. Real-time layer (socket.io)

A single `socket.io` server is attached to the same HTTP server. The frontend opens **one** socket via `lib/socket.js` and tags it with the user identity (`setIdentity`) on login/logout.

| Event | Direction | Payload |
|-------|-----------|---------|
| `livepost:new` | server → client | new live map post for everyone |
| `livepost:delete` | server → client | post removal |
| `chat:message` | both ways | community hub messages |
| `online:list` | server → client | currently-connected users (admin) |
| `api:hit` | server → admin | API tracker buffer entry |

`onlineTracker` keeps a `Map<socketId, identity>` and emits `online:list` when it changes. `apiTracker` is an Express middleware that increments per-route counters and pushes the latest N calls to a rolling buffer the admin console subscribes to.

---

## 6. Design Patterns in use

The codebase deliberately keeps things small and idiomatic. The patterns below are the explicit ones; they are named here for clarity.

| Pattern | Where | Why |
|---------|-------|-----|
| **Orchestrator / Façade** | `plannerOrchestrator.generateFullTrip` | One entry point coordinates several services (weather, POI, photo, AI, chat, model) so route handlers stay one-liners. |
| **Strategy** | `allocations` table in the orchestrator | Different style → different budget split, swappable without changing the rest of the pipeline. |
| **Template Method** | `promptService.resolveForCall` | Fixed skeleton (load → resolve override → render) with the variable parts (the templates themselves) pluggable per key. |
| **Registry + Override** | `DEFAULTS` array + `AiPrompt` collection in `promptService` | A single source of truth for every prompt, with hot, persistable overrides keyed by `key`. Reset = `deleteOne({ key })`. |
| **Adapter** | `weatherService.rateDay`, `summarizeForecast` | Adapt Open-Meteo's parallel arrays into a clean per-day object the rest of the app (UI + AI prompt) consumes. |
| **Singleton** | `lib/socket.js` on the FE | One socket per browser tab; `setIdentity` reuses the same connection on login/logout. |
| **Provider / Context** | `ToastProvider`, `ConfirmProvider`, `BrowserRouter` | Cross-cutting concerns are exposed to any descendant via React context. |
| **Pub/Sub** | socket.io rooms + event names | Many clients subscribe to topics like `livepost:new`; producers don't know who consumes. |
| **Repository** | Mongoose models (`Trip`, `User`, `ChatRoom`, `LivePost`, `AiPrompt`) | All persistence goes through these objects; routes never touch the driver directly. |
| **Middleware Chain** | `apiTracker`, `optionalAuth`, `authMiddleware` | Composable Express middleware to attach `req.user`, count calls and gate routes. |
| **Graceful Degradation / Fallback** | Orchestrator's POI-rotated fallback day; `cleanJsonResponse` returning `null`; `weatherDaily` empty array on null forecast; `photoService` deterministic curated fallback | Every external dependency can fail without breaking the user flow. |
| **Circuit Breaker** | `photoService.getDestinationPhoto` trips a 10-minute breaker on DNS / network errors so subsequent trip generations stop hitting the dead endpoint | Protects trip generation latency when the Pexels API is blocked/offline. |
| **State Container** | `tripStore` (Zustand) | Form data, current trip, auth, joined hubs and language live in one tiny store; no Redux boilerplate. |
| **DTO / Mapper** | `aiService.generateItinerary` builds a `context` object specifically shaped for the prompt template | Prevents prompts from being coupled to internal model shape. |
| **Optimistic UI** | Refine chat in `TripResults.jsx` | Local state updates immediately; the server later returns `updatedTrip` and Zustand replaces the trip. |
| **Code-as-config** | `DEFAULTS` for prompts, `allocations` for budget | Domain knobs live in code first, can be edited at runtime via the admin UI when needed. |

---

## 7. Data flow — concrete example

User clicks **"Generate My Dream Trip"** on Step 4:

1. `Loading.jsx` POSTs `formData` to `POST /api/trips/generate`.
2. `routes/trips.js` calls `optionalAuth` (sets `req.user` if a JWT is present) then `plannerOrchestrator.generateFullTrip`.
3. The orchestrator runs the three external lookups in parallel.
4. `weatherService.summarizeForecast` produces `weatherDaily[]` and the orchestrator computes `nights` + `breakdown`.
5. `aiService.generateItinerary` resolves the `itinerary.generate` prompt via `promptService` and calls Groq.
6. The orchestrator merges per-day weather into days, computes hotel total, attaches `flights.options[]` / `hotels.options[]`, finds-or-creates the chat room and saves the trip.
7. `Loading.jsx` receives the populated trip → `setTrip()` → navigate to `/trip/:id`.
8. `TripResults.jsx` renders:
   - left sidebar (summary + budget ring + chat hub card),
   - center timeline (one `WeatherBadge` + sessions),
   - right sticky `MapView` with active-day markers,
   - floating "Ask AI" sidebar that hits `POST /api/trips/refine` for live edits.

---

## 8. Conventions & gotchas

- **JWT** is parsed manually in each route file (`req.headers.authorization?.split(' ')[1]`); two helpers (`optionalAuth`, `authMiddleware`) handle the two cases.
- **Passwords** use Node's built-in `crypto.scrypt`; on first login a legacy plaintext password is auto-upgraded.
- **CORS** is permissive by default in dev — tighten before deploying.
- **Mongo `_id`** is consistently used; both `id` and `_id` are accepted in API payloads where relevant (auth, joined hubs).
- **socket.io rooms** are named after `ChatRoom._id`; presence + message dispatch reuse them.
- **Strict JSON** from the LLM is enforced both via `response_format` and the system prompt; `cleanJsonResponse` adds a defensive parse step.
- **Per-day weather** rendering tolerates legacy trips: components fall back to `trip.weatherDaily?.[idx]` when `day.weatherSummary` is missing.

---

## 9. Where to start when extending

| Goal | Touch this first |
|------|------------------|
| Add a new step to the planner form | `frontend/src/pages/Planner/` and `tripStore.formData` |
| Tweak the LLM behaviour | `backend/services/promptService.js` (or the admin UI prompt editor) |
| Add a new external data source to the trip | `backend/services/<newThing>Service.js` + add it to `Promise.all` in `plannerOrchestrator` and to the prompt context |
| Show a new field on the Trip page | extend `Trip` schema → expose in orchestrator → render in `TripResults.jsx` / a Booking section |
| Add a new socket event | declare in `server.js` or a service, consume in `lib/socket.js` listeners |
| Add a new prompt | append a default in `promptService.DEFAULTS` and call it via `resolveForCall(key, ctx)` |

---

_This document tracks the architecture as of the latest commit; please update it when you change a service boundary, add a new prompt, or introduce a new external dependency._
