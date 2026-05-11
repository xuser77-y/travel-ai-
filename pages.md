# Travio — Pages of the Website

> Inventory of every page rendered by `frontend/src/App.jsx`, in route order. For each page you'll find: the URL, who can access it, a description of every section inside, and the backend endpoints / socket events it consumes.

---

## Global frame (visible on every page)

Two components wrap every route in `App.jsx`:

- **`Navbar`** (top) — logo, primary navigation (Home, Planner, Dashboard, Live Map, Community, World Cup 2030, Billing & Plan), **notification bell** with unread badge and dropdown (`new_notification` socket event + relative timestamps + Mark as Read / Mark all as Read), language switcher (EN / FR / AR with RTL flip), dark/light mode toggle, user menu (avatar → Profile, Settings, Logout — or Login button when signed out). On admin accounts an extra **Admin** link appears.
- **`Footer`** (bottom) — brand block, quick links, Legal links (`/terms`, `/privacy`), copyright.

Cross-cutting providers also wrap the router:

- `ToastProvider` — top-right stacked toasts (success / error / warning / info).
- `ConfirmProvider` — promise-based modal used by every destructive action (`useConfirm()`).
- `ScrollToTop` — resets scroll position on every route change.

---

## 1. Landing — `/`

**Audience.** Public (visitors and registered users).

**Purpose.** Hero entry-point of the site. Sets the brand tone and funnels users into the planner or the login page.

**Contents.**

- **Cinematic 3D intro animation** (Framer Motion). A module-level flag ensures it plays **only on first load or a full refresh** — internal navigations skip it so the user is never delayed.
- **Hero block** — animated headline, subheadline, two primary CTAs:
  - **Plan my Trip** → `/planner`
  - **Discover World Cup 2030** → `/worldcup`
- **Value proposition strip** — three cards summarising the platform (AI Planner, Live Map, Community).
- **Coupe du Monde 2030 highlight strip** — visual teaser linking to the World Cup page.
- **Closing CTA** — secondary "Get started" call to action with a `Login` fallback for unauthenticated visitors.

---

## 2. Login / Sign-up — `/login`

**Audience.** Public.

**Purpose.** Single screen that toggles between sign-up and login modes, plus a third inline state for OTP verification.

**Contents.**

- **Mode tabs** — `Sign In` / `Sign Up` with automatic switching when the server says you're in the wrong mode (e.g. "no account found" auto-switches to sign-up).
- **Email + password fields** with client-side validation (non-empty, minimum length).
- **Google one-tap button** (`@react-oauth/google`) for social login.
- **OTP step** (sign-up only) — 6-digit input box that opens after a successful sign-up; **Resend OTP** button included.
- **Inline error banner + per-status toasts** ("Welcome back", "You already have an account", "No account found", "Incorrect password").

**APIs used.**
`POST /api/auth/signup`, `POST /api/auth/verify-otp`, `POST /api/auth/resend-otp`, `POST /api/auth/login`, `POST /api/auth/google`.

---

## 3. AI Planner (multi-step) — `/planner` → `/planner/loading`

The planner is a **wizard** spread across several routes. The Zustand store (`tripStore.formData`) keeps the data between steps. Each step is gated by the previous one being valid.

### 3.1 Step 1 — Destination · `/planner`

- **Manual mode** — debounced city autocomplete with keyboard navigation, country flag chips, type labels (city / town / region). Photon is the primary provider, Nominatim the fallback.
- **AI mode** — toggle "Let AI choose for me" reveals a free-form textarea ("describe your dream trip"). Clicking **Find my destination** calls the LLM and returns a real geocoded city card (flag + country + AI reason). **Change** regenerates.
- **Next** is disabled until a destination with valid `lat`/`lon` is locked in.
- API: `GET /api/search/proxy`, `POST /api/trips/suggest-destination`.

### 3.2 Step 2 — Dates · `/planner/step2`

- **Date range picker** (start + end) with same-day prevention and a sensible default (today → today + 5 days).
- Visible **nights count** + day count that update live.
- Inline copy reminding the user that weather forecasts are most accurate within ~16 days.

### 3.3 Step 3 — Travelers & Budget · `/planner/step3`

- **Travelers** segmented input (Solo / Couple / Family / Group) with a number stepper for the group size.
- **Total budget** numeric input with currency selector (auto-defaulted from the user's `Profile.preferredCurrency`).
- **Travel style** selector (Economy / Balanced / Comfort / Luxury) — drives the budget breakdown used by the orchestrator.

### 3.4 Step 4 — Interests, Diet & Review · `/planner/step4`

- **Interests** chips (Culture, Nature, Food, Adventure, Nightlife, Family, Beaches, Shopping, History, Wellness, etc.) plus an **"Others"** option that opens a free-form input with removable pills.
- **Dietary restrictions** chips (Halal, Vegetarian, Vegan, Gluten-free, etc.) with the same "Others" pattern.
- **Final review block** — summarises every field collected so far for one-glance confirmation.
- **Generate my Dream Trip** button → navigates to `/planner/loading`.

### 3.5 Loading screen · `/planner/loading`

- Animated globe + checklist of background tasks ("Asking the AI", "Checking the weather", "Picking POIs", "Booking-grade summary").
- POSTs to `POST /api/trips/generate` with the JWT. On 402 (free quota exhausted) it renders a **dedicated Upgrade screen** instead of a generic error, with a deep-link to `/billing`.
- On success: `setTrip()` in the store → navigates to `/trip/:id`.

---

## 4. Trip Results — `/trip/:id`

**Audience.** Authenticated owner of the trip (the route accepts visits but ownership is checked when the trip has a `userId`).

**Purpose.** The destination page of the AI planner. Renders one full itinerary with weather, hotels, flights, budget, map and an AI concierge.

**Contents.**

- **Hero header** — destination photo (Pexels with curated fallback), trip name, date range, traveler count and style chip.
- **Budget ring** — `BudgetRing` donut with 5 proportional segments (flights / hotels / food / activities / other), percentages in the legend, total in the trip's currency at the centre.
- **Day tabs** — one tab per day with weather chip (`WeatherChip`) and date.
- **Timeline (centre column)** — for the active day:
  - **Weather verdict banner** (`WeatherBadge`) — excellent / good / fair / poor + icon + advice.
  - **Four sessions** (morning / midday / afternoon / evening) with name, category, cost, duration, indoor/outdoor flag, lat/lon used by the map.
- **Map (right column, sticky)** — `MapView` Leaflet map zoomed to the active day's markers, switches themed tiles on light/dark.
- **Hotels section** — primary pick + 2 alternative cards (stars, neighborhood, amenities, price per night and total stay, booking tip).
- **Flights section** — single precise AI pick (airline, class, stops, duration, baggage tip, booking tip) with four deep-link provider buttons (Google Flights, Skyscanner, Kiwi, Kayak).
- **Booking section** — call-to-action buttons that open external deep-links for hotels and flights with the destination/dates pre-filled.
- **Linked Community Hub card** — quick join into the hub created for this trip.
- **Floating "Ask AI" chat** — opens a side panel; messages call `POST /api/trips/refine` and:
  - if the LLM produces real edits, the trip is replaced in the store and the map re-renders;
  - if no actual change is detected, a polite "please rephrase" hint is shown instead of pretending success.

**APIs / sockets.**
`GET /api/trips/:id`, `POST /api/trips/refine`, `DELETE /api/trips/:id`.

---

## 5. Dashboard — `/dashboard`

**Audience.** Authenticated users.

**Purpose.** Hub for all the user's saved trips.

**Contents.**

- **Trip cards grid** — one card per saved trip with:
  - photo background, destination name, status chip, date range, day count,
  - a **Delete** button that opens the in-app `useConfirm()` modal and reports the result via a toast.
- **Empty state** — friendly illustration + CTA to start a new trip.
- **Loading state** — skeleton cards.
- **Error state** — retry button.
- Cards link to `/trip/:id` on click.

**APIs.** `GET /api/trips/user`, `DELETE /api/trips/:id`.

---

## 6. Live Map — `/livemap`  *(plan-gated)*

**Audience.** Authenticated users on a tier with the `livemap` feature. Visitors without the feature see a blurred page + upgrade modal (`FreemiumGate`).

**Purpose.** Real-time, world-wide map where travellers drop short geo-located updates.

**Contents.**

- **ThemedTileLayer** Leaflet map that swaps OSM tiles (Carto dark / Carto light) when the theme toggles.
- **Composer card**:
  - text message,
  - **Emotion** selector (Excited, Bored, Anxious, Curious, Tired, etc.),
  - optional **Image upload** (base64, Multer in-memory),
  - **Pick a custom location** by clicking the map (chip + popup with **Remove** action).
- **My Recent Posts** panel — list of the current user's posts with a **Delete** button per row; deletions are optimistic, confirmed by the `livemap:delete_post` socket event.
- **Clusters overlay** — aggregated zone counts; clicking a cluster opens an AI-generated **area summary** (Groq when available, heuristic fallback otherwise).
- **Real-time broadcasts** — every new post appears instantly for everyone via the `livemap:new_post` socket event; deletes via `livemap:delete_post`.
- **Stable authorId** — logged-in users use their JWT id; guests get a UUID in `localStorage` so ownership survives refreshes.

**APIs / sockets.**
`GET/POST/DELETE /api/livemap/posts`, `GET /api/livemap/cluster-summary`, sockets `livemap:new_post`, `livemap:delete_post`.

---

## 7. Community Hubs — `/community`  *(plan-gated)*

**Audience.** Authenticated users on a tier with the `community` feature.

**Purpose.** Persistent chat rooms grouped by destination — a long-form social layer on top of the ephemeral Live Map.

**Contents.**

- **Hub list (left column)** — every hub the user has joined, with last-message preview, unread badge and member count.
- **Discover hubs (top)** — search box + auto-suggested destinations.
- **Join by invite code** — input + button that resolves an invite code to a hub.
- **Chat view (right column)**:
  - hub header (destination, member count, **Leave hub** action),
  - message stream (timestamps, author avatar, edited badge for messages an admin moderated),
  - presence indicators driven by `presence:update`,
  - **Composer** at the bottom (text, Enter to send, Shift+Enter for newline).
- **Real-time** — outgoing messages POST to the API; incoming messages arrive via the `chat:message` socket event.

**APIs / sockets.**
`GET /api/chat/rooms`, `POST /api/chat/rooms/:id/join|leave`, `GET/POST /api/chat/rooms/:id/messages`, socket `chat:message`, `presence:update`.

---

## 8. World Cup 2030 — `/worldcup`  *(plan-gated)*

**Audience.** Authenticated users on a tier with the `worldcup` feature.

**Purpose.** Themed experience for the Morocco–Spain–Portugal 2026/2030 tournament.

**Contents.**

- **Dynamic countdown** to the opening match (days / hours / minutes / seconds).
- **Interactive host-cities map** (Leaflet) — markers for every host city with stadium photo, capacity, current weather pulled from Open-Meteo.
- **City cards grid** — one card per host city with: photo, country flag, stadium info, average weather, and an **AI Plan** CTA that pre-fills the planner for that city.
- **Fan archetype quiz** — short quiz that returns a card persona ("Ultimate Fan", "Coastal Explorer", "Culture Hunter"…) influencing the city recommendations.
- **Travel tips block** — visa, language, currency snippets for each host country.

**APIs.** `GET /api/worldcup/cities`, `GET /api/weather` (proxied through `Open-Meteo`).

---

## 9. Billing & Plan — `/billing`

**Audience.** Authenticated users (all tiers).

**Purpose.** Showcases the four tiers, lets the user upgrade, and lists their purchase history with downloadable receipts.

**Contents.**

- **Plan cards (Free / Basic / Pro / Premium)**:
  - tier name, monthly price, currency, short description,
  - **Yes / No matrix** — every feature in the catalogue rendered with a green ✓ "Yes" or grey ✗ "No" badge (driven by the admin's checkbox grid, never hard-coded),
  - **Buy** button per paid tier — kicks off `POST /api/payments/checkout` (mock) **or** `POST /api/payments/stripe/create-session` (real Stripe Checkout in test mode), depending on the active `paymentConfig.provider`. The button shows a busy spinner while the request is in flight to prevent double-submits.
- **Current subscription snapshot** — plan, expiry date, free trips used / quota.
- **Purchase history table** — every entry from `User.subscriptionHistory[]` with date, plan, amount, provider (`mock` or `stripe`), order id and a **Receipt** button that re-opens the printable invoice.
- **Upgrade screen entry-point** — `Loading.jsx` deep-links here when free quota is exhausted.
- **Printable receipts** — `lib/receipt.js` builds a self-contained HTML invoice in a popup and auto-fires `window.print()` so the user gets a PDF via the browser's "Save as PDF".

**APIs.**
`GET /api/payments/plans`, `GET /api/payments/subscription`, `POST /api/payments/checkout`, `POST /api/payments/stripe/create-session`, `POST /api/payments/stripe/finalize`, `GET /api/payments/receipt/:historyId`.

---

## 10. Settings — `/settings`

**Audience.** Authenticated users.

**Purpose.** Account self-service.

**Contents (tabs).**

- **Profile** — name, bio, preferred currency, interests (chip selector) → saved via `PATCH /api/settings/me`.
- **Password** — current password (verified), new password, confirm.
- **Subscription** — current plan snapshot, trial usage, **Manage billing** deep-link to `/billing`.
- **Danger zone** — **Delete my account** action gated by an `useConfirm()` modal and a typed-confirmation; admins are blocked from self-delete.

**APIs.**
`GET/PATCH /api/settings/me`, `POST /api/settings/password`, `DELETE /api/settings/me`.

---

## 11. Admin Console — `/admin`

**Audience.** Authenticated users with `isAdmin === true` (re-checked server-side on every request).

**Purpose.** Ops cockpit for the platform. Ten sections in a single SPA route.

**Contents (sections).**

- **Overview** — real-time analytics charts (Recharts): **Revenue Growth (30d)**, **Current Plan Mix**, **Engagement Growth (Users/Trips)**, **Post Categories** distribution.
- **Users** — search, paginate, promote/demote admin, disable/enable, delete user (cascades to their trips), reset password, grant plan, add trials, **revoke trial**, force-expire plan.
- **Online now** — live socket list (user, IP, user-agent, connected-since, socket id) polled every 5 s, fed by `presence:update`.
- **Trips** — every trip with a detail modal, delete trip or a single activity (day + session).
- **Hubs** — every chat room, open messages modal, edit or delete individual messages, delete the whole hub.
- **Live Posts** — every live post; delete; **realtime**: subscribes to `livemap:new_post` / `livemap:delete_post` so new posts surface instantly; manual `Refresh` button as belt-and-suspenders.
- **API Usage** — per-route call counts, status breakdown, success rate, rolling buffer of recent calls, reset button.
- **AI Prompts** — **password-gated** editor for every LLM prompt (`itinerary.generate`, `itinerary.refine`, `destination.suggest`, `livemap.areaSummary`). Each card shows title, description, available-variables chips, system-prompt textarea, user-template textarea, save / reset / discard, last-edited stamp, and a `Customized` / `Default` badge. Re-authenticates server-side on every save.
- **Plans & Billing** — `AdminPlans.jsx`:
  - one editor card per tier (name / price / currency / description / highlight toggle) + a **checkbox grid** for every feature in `planService.ALL_FEATURES`,
  - per-user actions row (Grant plan, Add trials, Revoke trial, Force expire),
  - runtime **payment-provider switch** (`mock` ↔ `stripe`) — persists to `backend/data/payment-config.json`.
- **Notifications** — compose a notification (title, message, optional link, optional expiry date), target **all users** or specific emails, and broadcast it. Delivered in real time to each recipient's `user_<id>` socket room via the `new_notification` event.

All destructive actions go through `useConfirm()` with explanatory copy; outcomes reported via toasts.

---

## 12. Legal — `/terms` & `/privacy`

**Audience.** Public.

**Purpose.** Static legal pages for the footer links. Both render through a single component (`Legal.jsx`) with a `mode` prop.

**Contents.**

- **`/terms`** — Terms of Service: project scope, acceptable use, liability disclaimer, contact.
- **`/privacy`** — Privacy Policy: data collected (email, profile, trips, live posts), how it's used, third-party APIs (Groq, Google, Pexels, Open-Meteo), user rights, contact.
- Anchor links + last-updated date.

---

## Page → Plan-gating matrix

| Page | Visitor | Free | Basic | Pro | Premium | Admin |
|------|:------:|:----:|:-----:|:---:|:-------:|:-----:|
| Landing (`/`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Login (`/login`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Planner (`/planner/*`) | ✗ | ✓ (3 lifetime) | ✓ | ✓ | ✓ | ✓ (unlimited) |
| Trip Results (`/trip/:id`) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dashboard (`/dashboard`) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Live Map (`/livemap`) | ✗ | ✗ (blurred + upgrade) | ✗ (blurred + upgrade) | ✓ | ✓ | ✓ |
| Community (`/community`) | ✗ | ✗ (blurred + upgrade) | ✗ (blurred + upgrade) | ✓ | ✓ | ✓ |
| World Cup (`/worldcup`) | ✗ | ✗ (blurred + upgrade) | ✗ (blurred + upgrade) | ✗ (blurred + upgrade) | ✓ | ✓ |
| Billing (`/billing`) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Settings (`/settings`) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Admin (`/admin`) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Legal (`/terms`, `/privacy`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Admins always bypass every plan gate (middleware short-circuits + `usePlan()` returns the full feature list on the FE).
