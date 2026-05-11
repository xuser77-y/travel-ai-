# 🌍 Travio: The Future of Premium Travel Planning

## 🚀 Project Vision
**Travio** is a state-of-the-art, AI-first travel orchestration platform designed for the luxury and high-intent travel market. Unlike traditional booking sites, Travio focuses on **hyper-personalization** and **real-time contextual intelligence**. Our flagship 2030 World Cup Hub demonstrates our ability to merge major global events with seamless travel logistics.

---

## 💎 Core Idea
The project solves the "Paradox of Choice" in travel. By using Large Language Models (LLMs) and real-time GIS data, we transform a vague desire ("I want to visit Morocco for the World Cup") into a surgical, day-by-day plan that accounts for matches, local weather, cultural nuances, and logistics.

---

## 🛠️ Main APIs & Technologies
We leverage a sophisticated mesh of free and premium services:

1.  **Groq Cloud (LLM Engine)**: Powering the core "AI Planner" using Llama 3.3 for lightning-fast itinerary generation.
2.  **Leaflet & OpenStreetMap**: Providing a high-performance, non-commercial mapping solution for venue and POI visualization.
3.  **Open-Meteo API**: Delivering real-time, forecast-accurate weather data for host cities without API key restrictions.
4.  **Pexels API**: Dynamic sourcing of high-resolution architectural and landscape photography.
5.  **Overpass API (OpenStreetMap)**: Programmatic extraction of local points of interest.
6.  **Google OAuth & Nodemailer**: Secure, modern authentication with Social Login and Email OTP verification.
7.  **Recharts**: High-performance dashboard analytics for platform monitoring.

---

## ✨ Current Features (V1.0)
- **AI Itinerary Engine**: Multi-step planning flow based on budget, interests, dates, and weather; AI even picks the destination from a free-form description.
- **World Cup 2030 Hub**: dynamic countdown, interactive stadium map with live weather, curated fan archetypes, and per-host-city AI itineraries.
- **Live Map**: real-time map with traveler-posted updates (text + photo + emotion), clustered crowd activity per zone, and AI-generated area summaries.
- **Community Hubs**: real-time persistent chat rooms with invitation codes, presence tracking, and admin moderation.
- **AI Concierge Chat**: in-app trip refinement assistant for real-time itinerary edits with no-op detection.
- **Subscription & Billing**: free / basic / pro / premium tiers with feature gating, mock checkout for demos, real Stripe test-mode checkout, and printable PDF receipts.
- **Notifications**: real-time admin broadcasts (global or targeted), expiry logic, and a navbar dropdown with read/unread counts.
- **Multilingual UI**: native support for English, French, and Arabic (RTL).
- **Secure Authentication**: Google Social Login + 6-digit Email OTP verification + scrypt-hashed passwords with legacy auto-upgrade.
- **Admin Command Center**: real-time operational dashboard with Recharts analytics, user/trip/hub/live-post management, password-gated AI prompt editor, plan/feature configuration, and API usage monitoring.
- **Premium UX**: full light/dark mode, Recharts visualization, glassmorphism, in-app toasts and confirm dialogs replacing every native `alert()`/`confirm()`.

---

## 🔮 Future Roadmap: Proposed Features
To elevate Travio to a world-leading platform, we propose adding:

### 1. **AI Concierge Chatbot**
- A persistent sidebar where users can ask, "Where is the nearest Halal restaurant to the Casablanca stadium?" or "Translate 'I need a taxi' to Darija."

### 2. **Visa & Entry Assistant**
- Dynamic integration with global visa requirements based on the user's passport and destination (crucial for the 2030 tri-continental tournament).

### 3. **Collaborative "War Rooms"**
- Real-time group planning with shared maps, expense splitters (using a "Splitwise" logic), and live chat for fan groups.

### 4. **Live Match & Logistics Sync**
- Integration with FIFA match schedules to automatically update itineraries if a user's team advances or match times change.

### 5. **Augmented Reality (AR) Venues**
- AR-powered stadium tours within the app, allowing fans to "sit" in their seats before booking.

### 6. **Eco-Impact Tracker**
- Calculating the carbon footprint of the journey and offering local "green" alternatives (e.g., Al Boraq high-speed train instead of regional flights).

---

## 🏗️ Technical Architecture
- **Frontend**: React 18 with Vite for maximum performance. Zustand for lightweight global state management. React Router v6 for navigation. i18next for EN/FR/AR translations with RTL support.
- **Backend**: Node.js + Express (RESTful API). Mongoose ODM. JWT authentication. `crypto.scrypt` password hashing. Multer for uploads.
- **Database**: MongoDB (single datastore for users, trips, hubs, live posts, subscription history, AI prompt overrides, notifications).
- **Real-time**: Socket.io is in production use today — powers Live Map broadcasts, Community Hub chat, presence tracking, and admin notifications.
- **Styling**: Pure Vanilla CSS with a custom-built design system (CSS variables / design tokens) and a body-class light/dark theme switch.
- **Hosting**: Backend on Render, frontend on Vercel; MongoDB Atlas (cloud) or local `mongodb://localhost:27017/travio` for development.
