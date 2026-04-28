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
import { ToastProvider } from './components/UI/Toast';
import { ConfirmProvider } from './components/UI/ConfirmDialog';
import './App.css';

import useTripStore from './stores/tripStore';
import { setIdentity } from './lib/socket';

const API = 'http://localhost:5000';

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
          joinedHubs: res.data.joinedHubs || []
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
                <Route path="/trip/:id" element={<TripResults />} />
                <Route path="/worldcup" element={<WorldCup />} />
                <Route path="/community" element={<Community />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/livemap" element={<LiveMap />} />
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </main>
          </div>
        </Router>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
