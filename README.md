# TravelAI — AI‑Powered Travel Planning Platform

> Plan smarter. Travel together. A full‑stack platform that combines AI itinerary generation, real‑time community signals, interactive maps, and a dedicated **FIFA World Cup 2030 Morocco** companion experience.

---

## 1. Vision

TravelAI is built around a single idea: *travel planning should feel alive*. Instead of static guides, the app generates a personalized day‑by‑day itinerary in seconds, lets travelers share what's actually happening on the ground in real time, and adds a curated companion mode for the **2030 World Cup co‑hosted by Morocco, Spain and Portugal**.

The platform ships with three first‑class experiences:

- **AI Planner** — Multi‑step form → Groq LLM → ranked itinerary with weather, hotels, flights, POIs and a chat assistant for refinements.
- **Live Map** — A real‑time map where travelers drop posts (text + photo + emotion), see clustered crowd activity per area, and get AI‑generated area summaries.
- **World Cup 2030** — Host‑city showcase, stadium grid, countdown, curated AI itineraries per host city, and entry into fan rooms.

---

## 2. Tech Stack

### Frontend (`/frontend`)
- **React 18** + **Vite**
- **React Router v6** for routing
- **Zustand** for global state (`tripStore`)
- **Framer Motion** for UI motion and the 3D landing intro
- **react‑leaflet** + **Leaflet** for all maps
- **socket.io‑client** for live updates
- **axios** for HTTP
- **i18next** for i18n (EN / FR / AR with RTL)
- **Lucide React** icons
- Plain CSS with CSS variables — full **light / dark mode** via `[data-theme]` attribute

### Backend (`/backend`)
- **Node.js** + **Express**
- **MongoDB** + **Mongoose**
- **socket.io** for real‑time events
- **JWT** auth (`jsonwebtoken`) + **bcryptjs**
- **groq-sdk** — LLM provider for itinerary generation, refinement, and live‑map area summaries
- **node‑cache** — caches search/photo/POI/weather lookups
- External APIs:
  - **Photon (Komoot)** — primary city autocomplete
  - **Nominatim (OSM)** — fallback geocoding
  - **Open‑Meteo** — weather forecast
  - **Pexels** — destination photos
  - **Overpass API** — nearby POIs

### Storage / Infra
- MongoDB local (`mongodb://localhost:27017/travelai`)
- Multer in‑memory upload → base64 stored on `LivePost.imageData`

---

## 3. Repository Layout

```
test project/
├── backend/
│   ├── server.js                 # Express + Socket.io bootstrap
│   ├── routes/
│   │   ├── auth.js               # POST /api/auth/login (signup-or-login)
│   │   ├── trips.js              # generate / list / get / delete / refine trips
│   │   ├── search.js             # /api/search/proxy (Photon + Nominatim)
│   │   ├── livemap.js            # posts CRUD + clusters + summary
│   │   └── worldcup.js           # /api/worldcup/cities (stadium dataset)
│   ├── services/
│   │   ├── aiService.js          # Groq itinerary + refine
│   │   ├── photoService.js       # Pexels destination photo
│   │   ├── livePostService.js    # AI area summary + heuristic fallback
│   │   └── poiService.js         # Overpass POI fetch
│   ├── models/
│   │   ├── User.js               # email + bcrypt hash
│   │   ├── Trip.js               # full itinerary doc
│   │   └── LivePost.js           # geo + emotion + base64 image
│   └── .env                      # see §6
└── frontend/
    └── src/
        ├── pages/
        │   ├── Landing.jsx       # 3D intro (one-shot per refresh)
        │   ├── Dashboard.jsx     # trip cards with delete + photo bg
        │   ├── Planner/          # 7-step planner
        │   ├── TripResults.jsx   # itinerary, weather, hotels, flights, chat
        │   ├── LiveMap.jsx       # real-time map + my recent posts
        │   ├── Community.jsx     # fan rooms / forum entry
        │   └── WorldCup.jsx      # host cities + AI planners + fan card
        ├── stores/tripStore.js
        ├── components/           # Navbar, AnimatedPage, etc.
        └── i18n/                 # EN / FR / AR translations
```

---

## 4. Implemented Features

### 4.1 Auth
- `POST /api/auth/login` — single endpoint that **creates an account if email is unknown** or logs in if it exists, returning a 7‑day JWT.
- JWT secret loaded from `JWT_SECRET`.
- Frontend stores `token` in `localStorage`; Zustand exposes `setToken` / `setUser`.

### 4.2 AI Planner (7 steps)
Steps 1–7: Destination → Dates → Travelers/Budget → Style → Interests/Diet → Review → Loading.

- **Step 1 — Destination**: debounced autocomplete with cancellation, keyboard navigation, flags, type chips. **Photon** primary, **Nominatim** fallback. The dropdown no longer flashes *"No matches"* after a selection — fixed by tracking the last fetched query and the input‑focus state.
- **Step 4 — Interests / Dietary**: predefined chips + an **"Others"** option that opens a custom input, with removable pills.
- **Loading**: animated globe + step list, posts to `POST /api/trips/generate` with the JWT so the trip is bound to the user.
- **Result**: navigates to `/trip/:id`. The store keeps `currentTrip`; if missing (deep link / refresh), `TripResults` re‑fetches by ID with the JWT.

### 4.3 Trips API
| Method | Path                    | Auth        | Notes |
|--------|-------------------------|-------------|-------|
| POST   | `/api/trips/generate`   | optional    | Generates itinerary via Groq, fetches weather, photo, POIs, persists with `userId` if token present |
| GET    | `/api/trips/user/me`    | required    | Lists trips owned by the current user |
| GET    | `/api/trips/:id`        | optional*   | Returns one trip; ownership check if it has a `userId` |
| DELETE | `/api/trips/:id`        | required    | Deletes only if `trip.userId === req.user.id` |
| POST   | `/api/trips/:id/refine` | optional    | Sends user message to Groq; merges patch into trip |

### 4.4 Dashboard
- Cards rebuilt with **photo background**, status chip, date range, day count, and a **Delete** button (calls `DELETE /api/trips/:id`).
- Empty / loading / error states.
- Full **light‑mode** overrides for cards, stats, buttons and responsive grid.

### 4.5 Trip Results
- Tabs: Itinerary, Weather, Hotels, Flights, Chat.
- AI chat refines the trip in place (`/refine`).
- Hero photo from Pexels, fallback gradient.
- Light/dark theme aware.

### 4.6 Live Map
- **ThemedTileLayer** swaps OSM tiles between dark Carto and light Carto on theme change.
- **Stable `authorId`**: logged‑in users use their JWT id; guests get a UUID persisted in `localStorage` so they keep ownership across sessions.
- **Pick a custom location** by clicking the map; chip + popup expose a **Remove** button to revert to live geolocation.
- **Create a post** with text, emotion and an optional image (base64, Multer in‑memory).
- **My Recent Posts** panel with a **Delete** button per post; deletions are optimistic and confirmed by a `livepost:deleted` socket event.
- **Clusters** overlay: aggregated counts per zone with an AI‑generated area summary (Groq → heuristic fallback).
- **Real‑time**: `livepost:created` and `livepost:deleted` broadcast over Socket.io.

#### Live Map API
| Method | Path                          | Notes |
|--------|-------------------------------|-------|
| GET    | `/api/livemap/posts`          | Recent posts within optional bbox |
| POST   | `/api/livemap/posts`          | Multipart, persists `authorId`, broadcasts |
| DELETE | `/api/livemap/posts/:id`      | Verifies `authorId` from header before deleting + broadcasts |
| GET    | `/api/livemap/clusters`       | Aggregated zone counts |
| GET    | `/api/livemap/summary`        | AI area summary for a cluster |

### 4.7 Search Proxy
`GET /api/search/proxy?q=...` →
1. Calls **Photon** (`/api/photon` upstream) with `osm_tag=place:city` priorities.
2. Falls back to **Nominatim** if Photon returns nothing.
3. Boosts ranking for `city` / `town` types, preserves provider order tie‑breaker.
4. Caches results in `node-cache` for 6h.

### 4.8 World Cup 2030
- **Hero** with countdown, host‑country flags, official badge.
- **Stadium showcase grid** with photo cards.
- **Interactive map** with numbered markers + popups for each host city.
- **AI‑Powered Planner cards** — one per host city. Clicking prefills the planner store (destination, dates, interests) and routes to `/planner/step1`.
- **Fan Rooms card** — redesigned with stats, links to `/community`.
- Theme‑aware Leaflet tiles and full light/dark CSS.

### 4.9 Community
- Fan rooms / forum scaffolding linked from World Cup and main nav.
- Light/dark theming.

### 4.10 Landing Page
- 3D animated intro (Framer Motion) gated by a **module‑level flag** so the animation runs only on **first load or full page refresh**, never on SPA navigation back to `/`.

### 4.11 i18n
- EN / FR / AR with RTL flipping.
- Translations cover Navbar, Planner, Live Map, World Cup, Community, Dashboard.

---

## 5. Real‑time Events

| Event              | Payload                            | Emitted by                |
|--------------------|------------------------------------|---------------------------|
| `livepost:created` | the new `LivePost` doc             | `POST /api/livemap/posts` |
| `livepost:deleted` | `{ _id }`                          | `DELETE /api/livemap/posts/:id` |

Frontend `LiveMap.jsx` subscribes on mount and updates state without re‑fetching.

---

## 6. Environment

`backend/.env`:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/travelai
GROQ_API_KEY=<your_groq_key>
PEXELS_API_KEY=<your_pexels_key>
JWT_SECRET=<long_random_string>
```

Frontend reads `VITE_API_URL` (defaults to `http://localhost:5000`).

---

## 7. Run It Locally

### Prerequisites
- Node.js 18+
- MongoDB running locally on `:27017` (or update `MONGODB_URI`)

### Backend
```bash
cd backend
npm install
node server.js
# → API on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# → App on http://localhost:5173
```

If port 5000 is already busy on Windows:
```powershell
Get-NetTCPConnection -LocalPort 5000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

---

## 8. Recent Polish (this checkpoint)

- **Search**: Photon primary + Nominatim fallback, ranking boosts for city/town.
- **Step1Destination**: dropdown no longer shows "No matches" right after picking a city.
- **LiveMap**: Remove button on picked‑location chip *and* popup; My Recent Posts panel with delete; backend ownership + socket broadcast on delete; `LivePost.authorId` typed as String to support guest UUIDs.
- **WorldCup**: AI‑Powered Planner cards prefill the planner store; Fan Rooms card redesigned and links to `/community`; numbered map markers; theme‑aware tiles.
- **Landing**: 3D intro plays once per refresh, not on every navigation.
- **Light/Dark**: comprehensive overrides on WorldCup, LiveMap, Community, Landing, Dashboard, TripResults.

---

## 9. Known Limitations

- Auth is a single endpoint (login‑or‑signup); no email verification, password reset, OAuth, or rate limiting yet.
- Live Map images are stored as base64 inside MongoDB — fine for demos, not for scale (move to S3 / Cloudinary later).
- Groq rate‑limit handling is a simple recursive retry — no exponential backoff.
- Community is scaffolding only; real fan rooms (rooms, messages, presence) are not implemented yet.
- No automated test suite.

---

## 10. Roadmap

### Short term
- [ ] Object storage for Live Map images
- [ ] Persistent fan rooms (rooms, messages, typing indicators, presence)
- [ ] Trip sharing via public link
- [ ] Mobile bottom‑nav layout pass

### Medium term
- [ ] OAuth (Google) + proper signup flow
- [ ] Saved POIs / favorites and trip versioning
- [ ] Push notifications for nearby Live Map activity
- [ ] Multi‑destination itineraries

### Long term
- [ ] Native mobile app (React Native) sharing the same API
- [ ] Booking integrations (flights/hotels) — currently mocked
- [ ] Personalized recommendation engine learning from past trips
- [ ] World Cup live match ticker + venue crowd heatmap

---

## 11. License

Educational / portfolio project (PFE). Not for commercial use without permission.
