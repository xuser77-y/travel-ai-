# Travio — AI-Powered Travel Planning Platform

> Plan smarter. Travel together. A full-stack platform that combines AI itinerary generation, real-time community signals, an interactive live map, persistent fan hubs, a dedicated **FIFA World Cup 2030 Morocco** companion experience, and a complete admin console with live operational metrics and editable AI prompts.

---

## 1. Vision

Travio is built around a single idea: *travel planning should feel alive*. Instead of static guides, the app generates a personalized day-by-day itinerary in seconds, lets travelers share what's actually happening on the ground in real time, and adds a curated companion mode for the **2030 World Cup co-hosted by Morocco, Spain and Portugal**.

The platform ships with five first-class experiences:

- **AI Planner** — Multi-step form → Groq LLM → ranked itinerary with weather, hotels, flights, POIs and a chat assistant for refinements.
- **Live Map** — A real-time map where travelers drop posts (text + photo + emotion), see clustered crowd activity per area, and get AI-generated area summaries.
- **Community Hubs** — Persistent chat rooms per destination with invite codes, join/leave persistence, presence and message moderation.
- **World Cup 2030** — Host-city showcase, stadium grid, countdown, curated AI itineraries per host city, and entry into fan rooms.
- **Admin Console** — Live dashboard for users, trips, hubs, live posts, API usage, and a password-gated editor for every AI prompt the app uses.

---

## 2. Tech Stack

### Frontend (`/frontend`)
- **React 18** + **Vite**
- **React Router v6** for routing
- **Zustand** for global state (`tripStore`)
- **Framer Motion** for UI motion and the 3D landing intro
- **react-leaflet** + **Leaflet** for all maps
- **socket.io-client** singleton for live updates and presence
- **axios** for HTTP
- **i18next** for i18n (EN / FR / AR with RTL)
- **Lucide React** icons
- **Recharts** for premium data visualization (Revenue, Growth, Plan Mix)
- **@react-oauth/google** for social authentication
- Plain CSS with CSS variables — full **light / dark mode** via `body.light-mode` toggle
- **In-app `useToast()` and `useConfirm()` providers** that replace every `alert()` and `window.confirm()` across the app

### Backend (`/backend`)
- **Node.js** + **Express**
- **MongoDB** + **Mongoose**
- **socket.io** for real-time events and online-user tracking
- **JWT** auth (`jsonwebtoken`) — passwords hashed with **Node's built-in `crypto.scrypt`** (no bcrypt dependency); legacy plaintext records auto-upgrade on next login
- **groq-sdk** — LLM provider for itinerary generation, refinement, and live-map area summaries
- **node-cache** — caches search/photo/POI/weather lookups
- **API tracker middleware** — counts every `/api/*` call by route + status, keeps a rolling buffer of recent calls for the admin console
- **nodemailer** for transactional emails (OTP verification)
- **google-auth-library** for Google OAuth token verification
- External APIs:
  - **Photon (Komoot)** — primary city autocomplete
  - **Nominatim (OSM)** — fallback geocoding
  - **Open-Meteo** — weather forecast
  - **Pexels** — destination photos
  - **Overpass API** — nearby POIs

### Storage / Infra
- MongoDB local (`mongodb://localhost:27017/travio`)
- Multer in-memory upload → base64 stored on `LivePost.imageData`

---

## 3. Repository Layout

```
test project/
├── backend/
│   ├── server.js                 # Express + Socket.io bootstrap
│   ├── routes/
│   │   ├── auth.js               # /api/auth/signup, /login, /verify-otp, /google
│   │   ├── trips.js              # generate / list / get / delete / refine / suggest
│   │   ├── search.js             # /api/search/proxy (Photon + Nominatim)
│   │   ├── livemap.js            # posts CRUD + clusters + summary
│   │   ├── chat.js               # hub list / join / leave / messages
│   │   ├── worldcup.js           # /api/worldcup/cities (stadium dataset)
│   │   ├── payments.js           # /plans, /subscription, /checkout (mock),
│   │   │                         #   /receipt/:id, /stripe/{create-session,finalize}
│   │   ├── settings.js           # profile, password, delete self
│   │   ├── notifications.js      # list / mark-read + admin broadcast
│   │   └── admin.js              # all /api/admin/* endpoints
│   ├── middleware/
│   │   └── planGate.js           # requireAuth, requireFeature, requireTripQuota
│   ├── services/
│   │   ├── aiService.js          # Groq itinerary + refine (uses promptService)
│   │   ├── livePostService.js    # AI area summary + heuristic fallback
│   │   ├── chatService.js        # findOrCreateRoom + ensureUserJoined
│   │   ├── photoService.js       # Pexels destination photo (+ circuit breaker + DNS fallback)
│   │   ├── poiService.js         # Overpass POI fetch
│   │   ├── weatherService.js     # Open-Meteo forecast + per-day verdict
│   │   ├── plannerOrchestrator.js# parallel fetch + AI fallback
│   │   ├── promptService.js      # registry/loader/renderer for AI prompts
│   │   ├── planService.js        # PLAN_DEFS, features, effectivePlan, userHasFeature
│   │   ├── stripeService.js      # wraps the Stripe SDK when enabled
│   │   ├── emailService.js       # Nodemailer transactional emails (OTP)
│   │   ├── password.js           # scrypt hash + verify (with legacy upgrade)
│   │   ├── apiTracker.js         # counts/labels/recent calls per route
│   │   └── onlineTracker.js      # socket.id → user mapping for presence
│   ├── models/
│   │   ├── User.js               # email + scrypt + plan + trialLimit + history
│   │   ├── Trip.js               # full itinerary doc
│   │   ├── LivePost.js           # geo + sentiment + base64 image
│   │   ├── ChatRoom.js           # hub with messages, participants, inviteCode
│   │   ├── TripRoom.js           # legacy/light wrapper around ChatRoom
│   │   ├── Notification.js       # admin broadcasts (global / specific + expiry)
│   │   └── AiPrompt.js           # admin-editable prompt overrides (per key)
│   ├── data/                     # admin-editable runtime config (survives restarts)
│   │   ├── plan-overrides.json   # name / price / currency / features per tier
│   │   └── payment-config.json   # { provider: 'mock' | 'stripe' }
│   └── .env                      # see §6
└── frontend/
    └── src/
        ├── pages/
        │   ├── Landing.jsx       # 3D intro (one-shot per refresh)
        │   ├── Login.jsx         # split signup/login form with auto-mode-switch
        │   ├── Dashboard.jsx     # trip cards with delete (toast + confirm)
        │   ├── Planner/          # 7-step planner
        │   ├── TripResults.jsx   # itinerary, weather, hotels, flights, chat
        │   ├── LiveMap.jsx       # real-time map + my recent posts
        │   ├── Community.jsx     # persistent hubs + invite codes + presence
        │   ├── WorldCup.jsx      # host cities + AI planners + fan card
        │   ├── Billing.jsx       # plan cards + checkout + receipts
        │   ├── Settings.jsx      # profile / password / subscription / danger
        │   ├── AdminPlans.jsx    # plan + feature editor (admin tab)
        │   └── Admin.jsx         # full admin console
        ├── stores/tripStore.js
        ├── lib/
        │   ├── socket.js         # singleton socket.io client + identify()
        │   └── receipt.js        # printable HTML invoice (window.print → PDF)
        ├── components/
        │   ├── UI/               # Toast, ConfirmDialog providers
        │   ├── Billing/PlanGate.jsx  # usePlan() + <PlanGate feature="..."/>
        │   └── ...
        └── i18n/                 # EN / FR / AR translations
```

---

## 4. Implemented Features

### 4.1 Auth (split signup / login)
Two strict, dedicated endpoints — no more "signup-or-login" magic:

| Method | Path                  | Behaviour |
|--------|-----------------------|-----------|
| POST   | `/api/auth/signup`    | Sends 6-digit OTP to email, creates unverified account |
| POST   | `/api/auth/verify-otp`| Verifies OTP code and activates the account |
| POST   | `/api/auth/resend-otp`| Renew and resend the verification code |
| POST   | `/api/auth/login`     | Verifies credentials; blocks unverified emails |
| POST   | `/api/auth/google`    | One-tap Social Login (Google OAuth) |

- Passwords are hashed with `crypto.scrypt` (`scrypt:<salt>:<hash>` format). Legacy plaintext records upgrade transparently on next successful login.
- 7-day JWT signed with `JWT_SECRET`.
- The frontend `Login.jsx`:
  - Inline error banner + per-status toasts (welcome / "you already have an account" / "no account found" / "incorrect password").
  - **Auto-bounces** between Sign In and Sign Up when the server says you're in the wrong mode.
  - Client-side validation for empty fields + minimum password length.

### 4.2 AI Planner (7 steps)
Steps 1–7: Destination → Dates → Travelers/Budget → Style → Interests/Diet → Review → Loading.

- **Step 1 — Destination (manual)**: debounced autocomplete with cancellation, keyboard navigation, flags, type chips. **Photon** primary, **Nominatim** fallback.
- **Step 1 — Destination (AI)**: a **"Let AI choose for me"** toggle reveals a free-form textarea ("describe your dream trip"). Clicking **Find my destination** calls `POST /api/trips/suggest-destination`, which asks Groq for a single real city, then geocodes it through the same search proxy as the manual flow. The result appears as a card with flag, city/country and a one-line AI reason; users can accept it or click **Change** to regenerate. Next is gated until a real destination (with `lat`/`lon`) is locked in, so the rest of the planner never receives a half-filled state.
- **Step 4 — Interests / Dietary**: predefined chips + an **"Others"** option that opens a custom input, with removable pills.
- **Loading**: animated globe + step list, posts to `POST /api/trips/generate` with the JWT so the trip is bound to the user.
- **Result**: navigates to `/trip/:id`. The store keeps `currentTrip`; if missing (deep link / refresh), `TripResults` re-fetches by ID with the JWT.

### 4.3 Trips API
| Method | Path                                | Auth     | Notes |
|--------|-------------------------------------|----------|-------|
| POST   | `/api/trips/generate`               | required + quota | `requireAuth + requireTripQuota`; generates itinerary via Groq, fetches weather/photo/POIs, increments `freeTripsUsed` only on success |
| POST   | `/api/trips/suggest-destination`    | none     | Powers Step 1's "Let AI choose for me": LLM picks one city from a free-form description, then geocodes via the search proxy |
| GET    | `/api/trips/user`                   | required | Lists trips owned by the current user |
| GET    | `/api/trips/:id`                    | optional | Returns one trip; ownership check if it has a `userId` |
| DELETE | `/api/trips/:id`                    | required | Deletes only if `trip.userId === req.user.id` |
| POST   | `/api/trips/refine`                 | required + feature | `requireAuth + requireFeature('refine')`; returns `{ aiResponse, updatedTrip }`. `updatedTrip` is `null` when the LLM only chatted back or returned an itinerary identical to the input, so the FE can show a "rephrase" hint instead of a fake success |

### 4.4 Dashboard
- Cards with **photo background**, status chip, date range, day count and a **Delete** button.
- Delete now uses the in-app `useConfirm()` modal (no `window.confirm()`) and a toast on success/error.
- Empty / loading / error states + full **light-mode** overrides.

### 4.5 Trip Results
- Tabs: Itinerary, Weather, Hotels, Flights, Chat.
- AI chat refines the trip in place (`/refine`).
- Hero photo from Pexels, fallback gradient.
- Light/dark theme aware.

### 4.6 Live Map
- **ThemedTileLayer** swaps OSM tiles between dark Carto and light Carto on theme change.
- **Stable `authorId`**: logged-in users use their JWT id; guests get a UUID persisted in `localStorage` so they keep ownership across sessions.
- **Pick a custom location** by clicking the map; chip + popup expose a **Remove** button.
- **Create a post** with text, emotion and an optional image (base64, Multer in-memory).
- **My Recent Posts** panel with a **Delete** button per post; deletions are optimistic and confirmed by a `livemap:delete_post` socket event.
- **Clusters** overlay: aggregated counts per zone with an AI-generated area summary (Groq → heuristic fallback).
- **Real-time**: `livemap:new_post` and `livemap:delete_post` broadcast over Socket.io.
- All confirmations / failures use the in-app toast + confirm modals.

#### Live Map API
| Method | Path                          | Notes |
|--------|-------------------------------|-------|
| GET    | `/api/livemap/posts`          | Recent posts within optional bbox |
| POST   | `/api/livemap/posts`          | Persists `authorId`, broadcasts `livemap:new_post` |
| DELETE | `/api/livemap/posts/:id`      | Verifies `authorId` before deleting; broadcasts `livemap:delete_post` |
| GET    | `/api/livemap/clusters`       | Aggregated zone counts |
| POST   | `/api/livemap/summary`        | AI area summary for a cluster (uses editable prompt) |

### 4.7 Community Hubs
- Real persistent chat rooms (`ChatRoom` model) — not scaffolding anymore.
- **Auto-creation**: every new trip creates / reuses a destination hub via `chatService.findOrCreateRoom`.
- **Invite codes** (6-char hex) — paste one to join a private room.
- **Persistent membership**: `User.joinedHubs` mirrors room membership so the Community page knows which rooms are joined without an extra round-trip.
- **Live messages + presence** via Socket.io rooms; member counts adjust on join/leave.
- All `alert()`/`window.confirm()` calls have been replaced by toasts and an in-app confirm dialog.

### 4.8 Search Proxy
`GET /api/search/proxy?q=...` →
1. Calls **Photon** with `osm_tag=place:city` priorities.
2. Falls back to **Nominatim** if Photon returns nothing.
3. Boosts ranking for `city` / `town` types, preserves provider order tie-breaker.
4. Caches results in `node-cache` for 6h.

### 4.9 World Cup 2030
- **Hero** with countdown, host-country flags, official badge.
- **Stadium showcase grid** with photo cards.
- **Interactive map** with numbered markers + popups for each host city.
- **AI-Powered Planner cards** — one per host city. Clicking prefills the planner store and routes to `/planner/step1`.
- **Fan Rooms card** linked to `/community`.
- Theme-aware Leaflet tiles and full light/dark CSS.

### 4.10 Landing Page
- 3D animated intro (Framer Motion) gated by a **module-level flag** so the animation runs only on **first load or full page refresh**.

### 4.11 i18n
- EN / FR / AR with RTL flipping.
- Translations cover Navbar, Planner, Live Map, World Cup, Community, Dashboard.

### 4.12 Admin Console (`/admin`)
Ten sections in one dashboard, all gated by JWT + `user.isAdmin === true` (re-checked from the DB on every request so demoting is instant):

| Section            | What it shows / does                                                                 |
|--------------------|---------------------------------------------------------------------------------------|
| **Overview**       | Real-time analytics charts: **Revenue Growth (30d)**, **Current Plan Mix**, **Engagement Growth** (Users/Trips), and **Post Categories** distribution |
| **Users**          | Search, paginate, promote/demote admin, disable/enable, delete user (and their trips), reset password, grant plan / trials, revoke trial, force-expire |
| **Online now**     | Live socket list (user / IP / user-agent / connected-since / socket id), polled every 5 s |
| **Trips**          | All trips with paginated list, open detail modal, delete trip or single activity     |
| **Hubs**           | All chat rooms, open messages modal, edit/delete individual messages, delete hub     |
| **Live Posts**     | Every live post; delete; **realtime**: subscribes to `livemap:new_post` / `livemap:delete_post` so new posts appear instantly without manual refresh; manual `Refresh` button as belt-and-suspenders |
| **API Usage**      | Per-route call counts, status breakdown, success rate, recent-call buffer, reset button |
| **AI Prompts**     | **Password-gated** editor for every LLM prompt (see §4.13)                           |
| **Plans & Billing**| Per-tier editor (name / price / currency / description / highlight / features checkboxes); runtime **provider switch** between `mock` and `stripe`; per-user grant / trials / revoke / force-expire actions; overrides persist in `backend/data/plan-overrides.json` |
| **Notifications**  | Compose and broadcast a `Notification` to all users or to specific emails, with an optional expiry date; delivered in real time via the `new_notification` socket event |

All destructive actions use the in-app `useConfirm()` modal with copy explaining the consequences; outcomes are reported via toasts.

#### Admin API (selection)
```
GET    /api/admin/stats
GET    /api/admin/online
GET    /api/admin/users               (q, page, limit)
PATCH  /api/admin/users/:id           ({ isAdmin?, disabled? })
DELETE /api/admin/users/:id
POST   /api/admin/users/:id/password  ({ newPassword })
GET    /api/admin/trips               (page, limit)
GET    /api/admin/trips/:id
DELETE /api/admin/trips/:id
DELETE /api/admin/trips/:id/days/:dayIdx/sessions/:sessionIdx
GET    /api/admin/rooms
DELETE /api/admin/rooms/:id
GET    /api/admin/rooms/:id/messages
PATCH  /api/admin/rooms/:id/messages/:msgId
DELETE /api/admin/rooms/:id/messages/:msgId
GET    /api/admin/liveposts
DELETE /api/admin/liveposts/:id
GET    /api/admin/api-usage
POST   /api/admin/api-usage/reset
POST   /api/admin/verify-password
GET    /api/admin/prompts
GET    /api/admin/prompts/:key
PATCH  /api/admin/prompts/:key
POST   /api/admin/prompts/:key/reset
```

### 4.13 Editable AI Prompts (password-gated)

Every LLM call in the app pulls its prompt from the `promptService` registry at runtime. Admins can rewrite each prompt without redeploying.

**Registered prompts:**

| Key                        | Where it's used                                                | Variables available                                                                       |
|----------------------------|----------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| `itinerary.generate`       | `aiService.generateItinerary` (planner)                        | `destination`, `dates.start/end`, `travelers`, `style`, `budget.currency/total`, `interests`, `dietary`, `weather`, `pois` |
| `itinerary.refine`         | `aiService.refineItinerary` (chat)                             | `destination`, `style`, `budget.currency`, `userMessage`                                  |
| `destination.suggest`      | `POST /api/trips/suggest-destination` (Step 1 "Let AI choose") | `description`                                                                             |
| `livemap.areaSummary`      | `livePostService.generateAreaSummary`                          | `posts`, `dominantSentiment`, `types`                                                     |

**Templating:** `{{dot.notation}}` placeholders are substituted at call time; objects are stringified as JSON; missing values render as empty strings (never crashes the AI call).

**Storage:** overrides live in the `AiPrompt` collection (one document per `key`). If no document exists for a key the code default is used. Resetting deletes the override document.

**Security:**
- The `AI Prompts` admin tab is locked behind a **password re-verification** screen — a stolen JWT alone cannot rewrite prompts.
- `POST /api/admin/verify-password` checks the password against the currently logged-in admin's scrypt hash and unlocks the section in component state only.
- The password is held in memory while the section is mounted and is cleared the moment the admin navigates away or hits **Lock editor**.
- Every `PATCH /api/admin/prompts/:key` and `POST /api/admin/prompts/:key/reset` call also re-checks the password server-side.

**UI:**
- Each prompt is an expandable card with title, description, available-variables chips, system-prompt textarea, user-template textarea, save / reset / discard-changes buttons, last-edited stamp, and a `Customized` / `Default` badge.

### 4.14 In-app Toasts and Confirm Dialogs
Every previous `alert()` / `window.confirm()` across `Login`, `Dashboard`, `Community`, `LiveMap`, and `Admin` has been replaced by:

- **`useToast()`** — tiny pub-sub provider, success / error / warning / info, animated, auto-dismiss, stacked top-right.
- **`useConfirm()`** — promise-based modal with title / message / variant (default | danger), Esc to cancel, Enter to confirm, click-outside to cancel.

Both providers wrap the app in `App.jsx`.

### 4.15 Real-time Notification System
A robust messaging layer allowing administrators to push alerts to logged-in users instantly:

- **Socket.io Delivery**: Notifications are pushed in real-time via dedicated user rooms (`user_<id>`).
- **Admin Broadcasting**:
  - **All Users**: Global broadcast to everyone registered.
  - **Specific Users**: Target individuals by searching their email.
- **Expiry Logic**: Admins can set an optional **expiry date**. Expired notifications are automatically filtered out by the backend and removed from the frontend UI without a page refresh.
- **Premium Dropdown**: A sleek notification bell in the navbar with:
  - Unread badge counts.
  - Relative timestamps (e.g., "2m ago").
  - "Mark as Read" and "Mark all as Read" functionality.
  - Mobile-responsive fullscreen overlay.

---

---

## 5. Real-time Events

| Event                  | Payload                            | Emitted by                          |
|------------------------|------------------------------------|-------------------------------------|
| `livemap:new_post`     | the new `LivePost` doc             | `POST /api/livemap/posts`           |
| `livemap:delete_post`  | `{ _id }`                          | `DELETE /api/livemap/posts/:id`     |
| `chat:message`         | `{ roomId, message }`              | `POST /api/chat/rooms/:id/messages` |
| `new_notification`     | the `Notification` doc             | `POST /api/notifications/admin`     |
| `presence:update`      | `{ counts, sockets }`              | online tracker on connect/disconnect |

`LiveMap.jsx`, `Community.jsx`, and `Admin.jsx` (Live Posts + Online sections) all subscribe via the singleton client in `frontend/src/lib/socket.js`. The admin's Live Posts section now also subscribes to `livemap:new_post`/`livemap:delete_post`, fixing the previous glitch where new posts didn't appear until the admin switched sections.

---

## 6. Environment

`backend/.env`:

```
# --- Core ------------------------------------------------------------
PORT=5000
MONGODB_URI=mongodb://localhost:27017/travio      # or your MongoDB Atlas URI
JWT_SECRET=<long_random_string>

# --- AI & external APIs ---------------------------------------------
GROQ_API_KEY=<your_groq_key>
PEXELS_API_KEY=<your_pexels_key>

# --- Google OAuth (Social Login) ------------------------------------
GOOGLE_CLIENT_ID=<your_google_client_id>

# --- Email OTP (Nodemailer / Gmail SMTP) ----------------------------
EMAIL_USER=<your_gmail@gmail.com>
EMAIL_PASS=<your_gmail_app_password>

# --- Admin bootstrap -------------------------------------------------
# Comma-separated list of emails auto-promoted to superadmin on login.
ADMIN_EMAIL=you@example.com

# --- Billing (optional — mock is the default) ------------------------
# Switch via the admin Plans & Billing tab; persists in data/payment-config.json
PAYMENT_PROVIDER=mock                             # 'mock' | 'stripe'
STRIPE_SECRET_KEY=sk_test_...                     # only if provider = stripe
FRONTEND_URL=http://localhost:5173                # used in Stripe success/cancel redirects
```

`frontend/.env`:

```bash
VITE_API_URL=http://localhost:5000                # backend base URL
VITE_GOOGLE_CLIENT_ID=<your_google_client_id>
VITE_PEXELS_KEY=<optional_pexels_key>             # enables inline Pexels photos in map popups
```

When `VITE_API_URL` is absent the frontend falls back to `http://localhost:5000` (see `frontend/src/pages/*.jsx` and `frontend/src/lib/socket.js`).

### Bootstrapping the first admin

Two ways, pick whichever is easier:

1. **Easiest** — put your email in the `ADMIN_EMAIL` comma-separated whitelist in `backend/.env`. Every login from a whitelisted email is auto-promoted to superadmin on the spot (no manual DB edit).
2. **Manual** — sign up normally, then in MongoDB set `isAdmin: true` on your user document:
   ```js
   db.users.updateOne({ email: 'you@example.com' }, { $set: { isAdmin: true } })
   ```

After either step, additional admins can be promoted from the **Users** tab in the console.

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

## 8. Recent Polish

- **Auth split**: `/api/auth/signup` + `/api/auth/login` with friendly status codes; frontend auto-bounces between modes.
- **Toast + Confirm system**: app-wide replacement for `alert()` / `window.confirm()` in Login, Dashboard, Community, LiveMap, and Admin (including modals).
- **Admin Console**: Overview, Users, Online, Trips, Hubs, Live Posts, API Usage, AI Prompts.
- **Realtime admin Live Posts**: subscribes to `livemap:new_post` / `livemap:delete_post` so posts appear instantly; manual `Refresh` button as a fallback.
- **Editable AI Prompts**: admin-editable templates with `{{var}}` substitution, `Customized`/`Default` badges, last-edited stamps, in-memory password re-auth, and per-call server-side verification on every save/reset.
- **Step 1 "Let AI choose for me" — fixed**: was a dead textarea that left `destination.lat`/`lon` empty and broke later steps. Now hits `POST /api/trips/suggest-destination` (Groq → single-city pick → Photon/Nominatim geocode), shows a suggestion card with flag + reason, allows regenerate, and gates Next until a real, geocoded destination is chosen. The wording is editable from the admin **AI Prompts** tab (`destination.suggest`).
- **Hubs**: real persistent rooms with invite codes, presence, message moderation, and message editing/deletion in the admin modal.
- **Password hashing**: switched from bcrypt-style to native `crypto.scrypt`; legacy plaintext upgrades on next login.
- **API tracker**: per-route counts + recent-calls buffer powering the `API Usage` admin tab.
- **Real-time Notifications**: Socket.io delivery, admin broadcasting (Global/Specific), auto-expiry cleanup logic, and a premium navbar dropdown.
- **Light/Dark**: full overrides for the new admin Prompts editor (lock screen, cards, textareas, badges).
- **Premium Analytics**: Four interactive Recharts in the Admin Overview tracking Revenue, Plan distribution, and Engagement growth.
- **Secure Auth**: Google OAuth (Social Login) and Email OTP verification flow for all traditional accounts.

---

## 9. Known Limitations

- No password reset over email (OTP is for signup only), or rate limiting (yet).
- Live Map images are stored as base64 inside MongoDB — fine for demos, not for scale (move to S3 / Cloudinary later).
- Groq rate-limit handling is a simple recursive retry — no exponential backoff.
- No automated test suite.
- Prompt templates use flat `{{var}}` substitution only; no loops or conditionals (numbered lists must be pre-formatted in code, as `livemap.areaSummary` does).

---

## 10. Roadmap

### Short term
- [ ] Object storage for Live Map images
- [ ] Trip sharing via public link
- [ ] Mobile bottom-nav layout pass
- [ ] Prompt diff / revision history in the admin editor

### Medium term
- [ ] Password reset over email (OTP today is signup-only)
- [ ] Saved POIs / favorites and trip versioning
- [ ] Push notifications for nearby Live Map activity
- [ ] Multi-destination itineraries
- [ ] Per-prompt model + temperature controls in the admin editor

### Long term
- [ ] Native mobile app (React Native) sharing the same API
- [ ] Booking integrations (flights/hotels) — currently mocked
- [ ] Personalized recommendation engine learning from past trips
- [ ] World Cup live match ticker + venue crowd heatmap

---

## 11. Recent Improvements

### Per-day Weather Verdict on Trip Results
The trip planner now turns the raw Open-Meteo forecast into a usable per-day verdict (`excellent` / `good` / `fair` / `poor`) and shows it on the Trip Results page:

- **`backend/services/weatherService.js`** — `summarizeForecast()` and `rateDay()` map every day's WMO code, temperatures, precipitation and wind into `{ icon, label, rating, isGood, advice }`.
- **`backend/services/plannerOrchestrator.js`** — attaches a `weatherSummary` object to every itinerary day and stores a top-level `weatherDaily[]` on the trip.
- **`backend/services/promptService.js`** — the `itinerary.generate` prompt now receives `weatherDaily` and is instructed to pick **indoor** activities on poor/fair days and **outdoor** ones on good/excellent days; every activity gets `isIndoor: true|false`.
- **`frontend/src/components/UI/WeatherBadge.jsx`** — a `WeatherBadge` banner above each day's timeline + a small `WeatherChip` inside each day-tab.

### Sharper Flights & Hotels (single merged prompt)
Rather than splitting into separate prompts, the existing `itinerary.generate` prompt was extended so the LLM returns:

- a single, precise flight pick (`airline`, `flightClass`, `stops`, `durationHours`, `estimatedPrice`, `baggageTip`, `bookingTip`) — alternatives are intentionally **not** requested; the four provider deep-link buttons (Google / Skyscanner / Kiwi / Kayak) act as the comparison layer.
- a primary hotel pick **and 2 alternatives** (`stars`, `pricePerNight`, `neighborhood`, `amenities[]`, `bookingTip`)
- budget-aware pricing — the prompt receives the pre-computed `flights` / `hotels` envelopes from the style allocation
- the orchestrator now stores the **total** hotel stay (`pricePerNight × nights`) instead of confusing per-night vs total

The `Trip` model gained `hotels.options[]`, `weatherDaily[]` and `itinerary[].weatherSummary`. `FlightsSection` renders the richer primary pick only, while `HotelsSection` also renders the alternative cards.

### Logical fixes in the trip pipeline
- **Multi-day fallback** — when the LLM fails (rate-limit / no key) the orchestrator now produces one POI-rotated day for **every** date in the requested range with all 4 sessions, instead of a single day.
- **Hotel total bug** — `trip.hotels.price` is now the realistic total stay; `pricePerNight` is preserved separately for the `BookingSection`.
- **Single source of truth** — the `style → allocation` table is computed once and re-used by both the prompt and the saved `breakdown`.
- **Proportional budget donut** — `BudgetRing` was rendering two hard-coded segments; it now builds 5 proportional segments (flights/hotels/food/activities/other), shows percentages in the legend, uses the trip currency in the centre, and rotates to start at 12 o'clock.
- **Pexels resilience** — `photoService` now swallows `ENOTFOUND` / `EAI_AGAIN` / `ECONNREFUSED` errors, flips an in-memory circuit breaker for 10 minutes so trip generation no longer spams the console, and falls back to a curated deterministic image per destination. Successful lookups are cached for 24 h.

### Subscription plans, PayPal billing, Settings & Superadmin

The whole monetization layer was added in one pass. Highlights:

**Plans (single source of truth: `backend/services/planService.js`)**
- `free` — 3 lifetime trip generations (planner + refine).
- `basic` — unlimited planner + refine.
- `pro` — adds Community Hubs + Live Map.
- `premium` — adds World Cup 2030 + priority generation.
- Prices are placeholders, editable from the admin **Plans & Billing** tab. Overrides persist in `backend/data/plan-overrides.json` so they survive restarts.

**User schema** (`backend/models/User.js`) gained:
`plan`, `planExpiresAt`, `freeTripsUsed`, `trialLimit`, `subscriptionHistory[]`.

**Gating** — `backend/middleware/planGate.js` exposes:
- `requireAuth` — attach `req.user` (full Mongoose doc).
- `requireFeature(feature)` — 402 with `{ feature, currentPlan, upgradeUrl }`.
- `requireTripQuota` — 402 when free trial is exhausted (planner-specific).

Wired on:
- `POST /api/trips/generate` → `requireAuth + requireTripQuota`. Increments `freeTripsUsed` only on success.
- `POST /api/chat/rooms/:id/join` → `requireFeature('community')`.
- `POST /api/livemap/posts` → `requireFeature('livemap')`.
- *Admins always pass every gate.*

**Simulated checkout (sandbox / developer mode)** — `backend/routes/payments.js`
The original PayPal sandbox always redirected the buyer to a "Create a PayPal account" page, which made every demo painful. The project now ships with a **mock checkout** that's perfect for development, demos and the PFE jury:

- `GET  /api/payments/plans` — public; returns tiers + the **feature label catalog** + `provider: 'mock'`.
- `GET  /api/payments/subscription` — auth; current plan snapshot.
- `POST /api/payments/checkout` — auth; body `{ plan }`. Stamps a synthetic order id (`MOCK-...`), extends `planExpiresAt` by 30 days, appends a `subscriptionHistory` entry with `provider: 'mock'`. Replaces the create-order/capture-order pair.
- `GET  /api/payments/receipt/:historyId` — auth; returns the JSON the FE renders into a printable receipt (buyer + seller + line items + totals).

`paypalService.js` is kept as a deprecation stub that throws if anything tries to import it, so the codebase fails loud rather than quietly hitting a real PayPal endpoint.

**Printable PDF receipts** — `frontend/src/lib/receipt.js`
After a successful `POST /checkout` (or by clicking **Receipt** in the purchase history), the FE fetches `/payments/receipt/:id`, builds a self-contained HTML invoice (brand + buyer + plan + line items + totals + sandbox notice) and opens it in a new tab. The window auto-triggers `window.print()` so the user can **Save as PDF** in one click — no PDF library needed. If the popup is blocked the helper falls back to downloading the same HTML as a `.html` file.

**Yes / No feature matrix on the Billing page**
Each plan card now renders **every** feature with a green ✓ + "Yes" badge or a grey ✗ + "No" badge. The list is driven by what the admin has checked in the dashboard — never hard-coded — so the Billing page is always in sync with the gating middleware.

**Settings page** (`/settings`)
- `frontend/src/pages/Settings.jsx` + `backend/routes/settings.js`.
- Tabs: **Profile** (name/bio/currency/interests), **Password** (verifies current), **Subscription** (snapshot + "Manage billing" deep link), **Danger zone** (self-delete; admins blocked).

**Admin (a.k.a. superadmin) gets full control over everything**
- `isAdmin === true` is the single superadmin flag. The middleware already short-circuits every gate for admins; the FE `usePlan` hook does the same.
- New admin endpoints in `backend/routes/admin.js`:
  - `GET  /api/admin/plans` and `PATCH /api/admin/plans/:id` — edit tier name/price/currency/description **and the features array** via the dashboard checkboxes (persisted via `plan-overrides.json`).
  - `POST /api/admin/users/:id/grant-plan` `{ plan, days }` — gift a paid plan and append a `granted` history entry.
  - `POST /api/admin/users/:id/grant-trials` `{ count }` — give extra free trips (raises `trialLimit`).
  - `POST /api/admin/users/:id/revoke-trial` — caps `trialLimit` to current `freeTripsUsed` so the user can't generate more free trips.
  - `POST /api/admin/users/:id/expire-plan` — force back to free.
  - `GET  /api/admin/users/:id` — full detail incl. subscription history.
  - The existing `PATCH /api/admin/users/:id` now accepts `plan`, `trialLimit`, `freeTripsUsed`, `planExpiresAt`.
- Frontend: the **Plans & Billing** admin tab (`frontend/src/pages/AdminPlans.jsx`) ships:
  - one card per tier with editable name / price / currency / description / "highlight" toggle,
  - a **checkbox grid** for every feature in `planService.ALL_FEATURES` so the admin decides exactly what each plan unlocks,
  - a per-user search + actions row: **Grant plan**, **Add trials**, **Revoke trial**, **Force expire**.

**Frontend infrastructure**
- `frontend/src/components/Billing/PlanGate.jsx` exposes `usePlan()` (current plan, features, trial counters) and a `<PlanGate feature="...">` wrapper.
- `frontend/src/stores/tripStore.js` gained `setSubscription()` so Billing/Settings can update the cached user without a full re-login.
- `Loading.jsx` (planner) now renders a dedicated **upgrade screen** when generation returns 402, instead of a generic error.
- `Navbar.jsx` gained a **Billing & Plan** entry in the user menu.

**Required env vars (backend `.env`)**
```
JWT_SECRET=...
MONGODB_URI=mongodb://localhost:27017/travio
GROQ_API_KEY=...
PEXELS_API_KEY=...
ADMIN_EMAIL=you@example.com    # comma-separated whitelist that auto-promotes to superadmin

# OPTIONAL — only needed if you want to test real card payments.
# Get a free test key at https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_...
FRONTEND_URL=http://localhost:3000  # used in Stripe success/cancel redirects
PAYMENT_PROVIDER=mock               # default; admin can flip to 'stripe' in the dashboard
```

**Two payment providers are supported**, switchable from the admin dashboard at runtime:

1. **`mock`** (default) — instant in-process simulated purchase. Perfect for the PFE demo and screenshots; no third-party account needed; appends `provider: 'mock'` to `subscriptionHistory`.
2. **`stripe`** — real Stripe Checkout in **test mode**. Works in Morocco for developers (no buyer account needed). Use the test card `4242 4242 4242 4242` with any future expiry, any CVC, any postal code. Backend endpoints:
   - `POST /api/payments/stripe/create-session` → returns the hosted checkout URL.
   - `POST /api/payments/stripe/finalize` → idempotently verifies the session and grants the plan after the success redirect.

The active provider is persisted to `backend/data/payment-config.json` via `PATCH /api/admin/payment-config { provider }` so it survives restarts.

See `ARCH.md` for the full architecture, AI pipeline and design patterns.

---

## 12. License

Educational / portfolio project (PFE). Not for commercial use without permission.
