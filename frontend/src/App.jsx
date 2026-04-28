import React from 'react';
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
import './App.css';

import useTripStore from './stores/tripStore';

function App() {
  const { isDarkMode, language } = useTripStore();

  React.useEffect(() => {
    if (!isDarkMode) {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [isDarkMode]);
  
  return (
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
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
