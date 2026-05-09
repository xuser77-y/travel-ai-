import React from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/UI/Navbar';
import Landing from './pages/Landing';
import Step1Destination from './pages/Planner/Step1Destination';
import Step2Dates from './pages/Planner/Step2Dates';
import Step3Budget from './pages/Planner/Step3Budget';
import Step4Interests from './pages/Planner/Step4Interests';
import Loading from './pages/Planner/Loading';
import TripResults from './pages/TripResults';
import WorldCup from './pages/WorldCup';
import Community from './pages/Community';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import LiveMap from './pages/LiveMap';
import Admin from './pages/Admin';
import Billing from './pages/Billing';
import Settings from './pages/Settings';
import { ToastProvider } from './components/UI/Toast';
import { ConfirmProvider } from './components/UI/ConfirmDialog';
import FreemiumGate from './components/Billing/FreemiumGate';
import ScrollToTop from './components/UI/ScrollToTop';
import Footer from './components/UI/Footer';
import Legal from './pages/Legal';
import './App.css';

import useTripStore from './stores/tripStore';
import { setIdentity, setAuthToken } from './lib/socket';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const { isDarkMode, language, token, user, setUser, logout } = useTripStore();

  // Tag the shared socket with the current user so the admin dashboard can
  // attribute connections to accounts. Re-runs whenever the user changes
  // (login, logout, /me refresh).
  React.useEffect(() => {
    setIdentity({
      userId: user?.id || user?._id || null,
      name: user?.name || 'Guest'
    });
    // Reattach the JWT to the socket handshake so the backend's plan gate
    // can resolve the right user on `send_message` and friends.
    setAuthToken(token);
  }, [user]);

  React.useEffect(() => {
    if (!isDarkMode) {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [isDarkMode]);

  // On app boot, refresh the cached user (admin flag, etc.) from /me so a
  // user who was promoted to admin sees the new menu without re-logging in.
  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    axios
      .get(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (cancelled) return;
        setUser({
          id: res.data.id,
          name: res.data.name,
          email: res.data.email,
          isAdmin: !!res.data.isAdmin,
          joinedHubs: res.data.joinedHubs || [],
          subscription: res.data.subscription || null
        });
      })
      .catch((err) => {
        // Token expired/invalid — wipe and force re-login on protected pages.
        if (err.response?.status === 401 || err.response?.status === 403) logout();
      });
    return () => { cancelled = true; };
  }, [token, setUser, logout]);

  return (
    <ToastProvider>
      <ConfirmProvider>
        <Router>
          {/* Resets scroll to top on every route change. Without this,
              users complain that clicking a nav link drops them in the
              middle of the next page (browser SPA default). */}
          <ScrollToTop />
          <div className={`app ${language === 'ar' ? 'rtl' : ''}`}>
            <Navbar />
            <main className="content">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/planner" element={<Step1Destination />} />
                <Route path="/planner/step2" element={<Step2Dates />} />
                <Route path="/planner/step3" element={<Step3Budget />} />
                <Route path="/planner/step4" element={<Step4Interests />} />
                <Route path="/planner/loading" element={<Loading />} />
                {/* Trip results stays accessible — the AI chat inside it
                    handles its own freemium errors so the user can still
                    review the itinerary they generated, even at the limit. */}
                <Route path="/trip/:id" element={<TripResults />} />
                {/* Premium pages: rendered with a blur + upgrade modal
                    overlay once the user has used all 3 free explorations.
                    The page itself doesn't need any changes — the gate
                    component reads `subscription.freemium.locked` from the
                    store, which the backend keeps in sync via /me. */}
                <Route path="/worldcup" element={
                  <FreemiumGate feature="worldcup" featureLabel="World Cup 2030 Companion"><WorldCup /></FreemiumGate>
                } />
                <Route path="/community" element={
                  <FreemiumGate feature="community" featureLabel="Community Hubs"><Community /></FreemiumGate>
                } />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/livemap" element={
                  <FreemiumGate feature="livemap" featureLabel="Live Map"><LiveMap /></FreemiumGate>
                } />
                <Route path="/admin" element={<Admin />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/terms" element={<Legal mode="terms" />} />
                <Route path="/privacy" element={<Legal mode="privacy" />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
