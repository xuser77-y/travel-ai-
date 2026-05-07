import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useTripStore from '../stores/tripStore';
import MapView from '../components/Map/MapView';
import BudgetRing from '../components/Budget/BudgetRing';
import FlightsSection from '../components/Booking/FlightsSection';
import HotelsSection from '../components/Booking/HotelsSection';
import WeatherBadge, { WeatherChip } from '../components/UI/WeatherBadge';
import { Calendar, MapPin, Users, Info, MessageCircle, Send, X, Sparkles, Clock, DollarSign } from 'lucide-react';
import axios from 'axios';
import './TripResults.css';

const TripResults = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentTrip, setTrip, token, refreshSubscription } = useTripStore();
  const [activeDay, setActiveDay] = useState(0);
  const [activeActivity, setActiveActivity] = useState(-1);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: `Hello! I'm your Travio assistant. How can I help you with your trip to ${currentTrip?.destination?.name || 'this destination'}?` }
  ]);

  // If we arrived from the Dashboard (deep link with :id) and the store
  // is empty or doesn't match, fetch the trip from the API.
  useEffect(() => {
    if (!id) return;
    if (currentTrip && currentTrip._id === id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/trips/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!cancelled) setTrip(res.data);
      } catch (err) {
        console.error('Failed to load trip:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [id, currentTrip, setTrip, token]);

  // Use currentTrip or fallback for UI rendering
  const trip = currentTrip || {
    destination: { name: 'Casablanca, Morocco', lat: 33.5731, lon: -7.5898, photo: 'https://images.pexels.com/photos/3540608/pexels-photo-3540608.jpeg' },
    dates: { start: '2030-07-12', end: '2030-07-18' },
    travelers: 'couple',
    startCity: 'Paris, France',
    budget: { total: 4850, currency: 'USD', breakdown: { flights: 1500, hotels: 2000, food: 800, activities: 500, other: 50 } },
    flights: { suggestion: 'Direct flight on Royal Air Maroc, ~3h 30m', price: 1500 },
    hotels: { name: 'Four Seasons Casablanca', description: 'Beachfront luxury with panoramic Atlantic views and signature spa.', price: 2000 },
    itinerary: [
      {
        dayNumber: 1,
        date: '2030-07-12',
        sessions: [
          { time: 'Morning', activity: { name: 'Arrival at CMN', category: 'Transport', description: 'Pick up your rental car or take a private transfer to your hotel.', cost: 0, lat: 33.3675, lon: -7.5898 } },
          { time: 'Afternoon', activity: { name: 'Hassan II Mosque', category: 'Culture', description: 'Visit one of the largest mosques in the world, overlooking the Atlantic.', cost: 12, lat: 33.6085, lon: -7.6326 } },
          { time: 'Evening', activity: { name: "Rick's Café", category: 'Food', description: 'Enjoy dinner at this legendary spot inspired by the movie Casablanca.', cost: 50, lat: 33.5997, lon: -7.6214 } }
        ]
      }
    ]
  };

  // Flatten current day's activities for map + ordinal numbering
  const dayActivities = useMemo(
    () => trip.itinerary[activeDay]?.sessions?.map((s) => s.activity).filter(Boolean) || [],
    [trip, activeDay]
  );

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isTyping) return;

    const userMsg = { role: 'user', text: chatInput };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    try {
      // Bug fix: the refine endpoint is now plan-gated, so we MUST send
      // the JWT or we'll get a 401 and the AI chat shows the generic
      // "I'm sorry, I couldn't process that change" error.
      const res = await axios.post(
        'http://localhost:5000/api/trips/refine',
        { currentTrip: trip, userMessage: chatInput },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      const { aiResponse, updatedTrip } = res.data;

      setMessages(prev => [...prev, { role: 'bot', text: aiResponse }]);
      if (updatedTrip) {
        setTrip(updatedTrip); // Update the global state and UI
      }
      // Refresh the freemium counter so the FreemiumGate flips to "locked"
      // immediately if this was the user's 3rd free use, instead of
      // waiting for a navigation to /me.
      refreshSubscription?.();
    } catch (err) {
      console.error('Refinement failed:', err);
      // Translate 401 / 402 into helpful, plan-aware messages instead of
      // the generic "try again" so the user knows whether to log in or
      // upgrade.
      const status = err.response?.status;
      const data = err.response?.data;
      let text = "I'm sorry, I couldn't process that change. Please try again.";
      if (status === 401) {
        text = 'Please sign in again to use the AI chat.';
      } else if (status === 402) {
        const label = data?.featureLabel || 'AI Refinement Chat';
        text = `⚠️ ${label} is not included in your current plan. Upgrade at /billing to keep refining trips with AI.`;
      } else if (data?.error) {
        text = data.error;
      }
      setMessages(prev => [...prev, { role: 'bot', text }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="trip-results">
      {/* Left Column: Overview */}
      <aside className="results-sidebar left-sidebar glass-card">
        <div className="trip-summary">
          <div className="trip-hero-img" style={{ backgroundImage: `url(${trip.destination.photo})` }}>
            <div className="img-overlay">
              <h2>{trip.destination.name.split(',')[0]}</h2>
            </div>
          </div>
          
          <div className="summary-details">
            <div className="detail-item">
              <Calendar size={18} />
              <span>
                {new Date(trip.dates.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' — '}
                {new Date(trip.dates.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="detail-item">
              <Users size={18} />
              <span style={{ textTransform: 'capitalize' }}>{trip.travelers}</span>
            </div>
            <div className="status-badge">Confirmed</div>
          </div>
        </div>

        <div className="budget-section">
          <h3>Budget Analysis</h3>
          <BudgetRing breakdown={trip.budget.breakdown} currency={trip.budget.currency} />
        </div>

        {trip.chatRoom ? (
          <div className="community-card glass-card">
            <div className="comm-header">
              <MessageCircle size={18} />
              <h3>Community Hub</h3>
            </div>
            <p className="room-name">{trip.chatRoom.roomName}</p>
            <div className="invite-box">
              <span className="label">Invite Code</span>
              <span className="code">{trip.chatRoom.inviteCode}</span>
            </div>
            <button
              className="btn-community"
              onClick={() => {
                // Use react-router navigation (NOT a full page reload) so
                // the in-memory `currentTrip` survives the transition and
                // we can also pass the room id explicitly via location
                // state. The Community page reads either signal and
                // pre-selects this trip's room — never falling back to
                // the global hub like the old window.location did.
                navigate('/community', {
                  state: { roomId: trip.chatRoom?._id, fromTripId: trip._id }
                });
              }}
            >
              Join Chat
            </button>
          </div>
        ) : (
          <div className="community-card glass-card">
            <div className="comm-header">
              <MessageCircle size={18} />
              <h3>Join Community</h3>
            </div>
            <p className="room-name">No room active for this trip yet.</p>
            <button className="btn-community" onClick={async () => {
              // Logic to create room for old trips
              try {
                const res = await axios.post(
                  `http://localhost:5000/api/trips/refine`,
                  { currentTrip: trip, userMessage: "System: Please initialize a chat room for this trip." },
                  { headers: token ? { Authorization: `Bearer ${token}` } : {} }
                );
                if (res.data.updatedTrip) setTrip(res.data.updatedTrip);
              } catch (e) {
                window.location.href = '/community';
              }
            }}>
              Initialize Room
            </button>
          </div>
        )}
      </aside>

      {/* Floating AI Chat Button */}
      <button className={`fab-ai-chat ${showChat ? 'hidden' : ''}`} onClick={() => setShowChat(true)}>
        <Sparkles size={24} />
        <span className="tooltip">Ask AI</span>
      </button>

      {/* AI Chat Sidebar Overlay */}
      {showChat && (
        <div className="ai-chat-overlay glass-card">
          <div className="chat-sidebar-header">
            <div className="header-title">
              <Sparkles size={18} className="sparkle-icon" />
              <h3>AI Trip Assistant</h3>
            </div>
            <button className="close-btn" onClick={() => setShowChat(false)}><X size={20} /></button>
          </div>
          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`msg ${msg.role}`}>
                {msg.text}
              </div>
            ))}
            {isTyping && <div className="msg bot typing">Thinking...</div>}
          </div>
          <div className="chat-footer">
            <input 
              type="text" 
              placeholder="Ask for changes or suggestions..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isTyping}
            />
            <button className="btn-send" onClick={handleSendMessage} disabled={isTyping}>
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Center Column: Itinerary */}
      <main className="results-main">
        <header className="itinerary-header">
          {trip.summary && (
            <div className="trip-description-card glass-card">
              <Info size={18} className="info-icon" />
              <p>{trip.summary}</p>
            </div>
          )}
          <div className="day-tabs">
            {trip.itinerary.map((day, idx) => (
              <button
                key={idx}
                className={`day-tab ${activeDay === idx ? 'active' : ''}`}
                onClick={() => {
                  setActiveDay(idx);
                  setActiveActivity(-1);
                }}
              >
                <span className="day-num">Day {day.dayNumber}</span>
                {day.date && (
                  <span className="day-date">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                <WeatherChip summary={day.weatherSummary || trip.weatherDaily?.[idx]} />
              </button>
            ))}
          </div>
        </header>

        <section className="itinerary-timeline">
          <WeatherBadge summary={trip.itinerary[activeDay]?.weatherSummary || trip.weatherDaily?.[activeDay]} />
          {trip.itinerary[activeDay]?.transportSuggestion && (
            <div className="transport-hint">
              🚗 Suggested transport: {trip.itinerary[activeDay].transportSuggestion}
            </div>
          )}

          {/* Filter out any malformed sessions before mapping. The AI
              refine endpoint can occasionally return a session without
              an `activity` payload (e.g. when the model deletes one
              and forgets to also drop the slot). Keeping nulls would
              crash the page on `session.activity.category`. */}
          {(trip.itinerary[activeDay]?.sessions || [])
            .filter((s) => s && s.activity)
            .map((session, sIdx) => {
            const activityIdx = sIdx; // matches MapView marker number (1-based shown)
            const isActive = activeActivity === activityIdx;
            const validSessions = (trip.itinerary[activeDay].sessions || []).filter((s) => s && s.activity);
            return (
              <div key={sIdx} className={`timeline-item ${isActive ? 'is-active' : ''}`}>
                <div className="time-indicator">
                  <div className={`stop-marker ${isActive ? 'is-active' : ''}`}>
                    <span>{activityIdx + 1}</span>
                  </div>
                  <span className="time-label">{session.time}</span>
                  {sIdx < validSessions.length - 1 && <div className="line"></div>}
                </div>

                <button
                  type="button"
                  className={`activity-card ${isActive ? 'is-active' : ''}`}
                  onClick={() => setActiveActivity(isActive ? -1 : activityIdx)}
                >
                  <div className="activity-info">
                    <div className="activity-top">
                      {session.activity?.category && (
                        <span className="category-tag">{session.activity.category}</span>
                      )}
                      <h4>{session.activity?.name}</h4>
                    </div>
                    {session.activity?.description && <p>{session.activity.description}</p>}
                    <div className="activity-meta">
                      {typeof session.activity.cost === 'number' && session.activity.cost > 0 && (
                        <span className="cost-pill">
                          <DollarSign size={12} />
                          {trip.budget.currency} {session.activity.cost}
                        </span>
                      )}
                      {session.activity.duration && (
                        <span className="meta-pill">
                          <Clock size={12} /> {session.activity.duration}
                        </span>
                      )}
                      <span className="meta-pill">
                        <MapPin size={12} /> View on map
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </section>

        {/* Booking sections */}
        <div className="booking-sections-grid">
          <FlightsSection trip={trip} />
          <HotelsSection trip={trip} />
        </div>
      </main>

      {/* Right Column: Map (sticky) */}
      <aside className="results-sidebar right-sidebar">
        <div className="map-card">
          <div className="map-card-header">
            <div>
              <span className="map-day-label">Day {trip.itinerary[activeDay]?.dayNumber} Route</span>
              <h4>{trip.destination?.name?.split(',')[0]}</h4>
            </div>
            <span className="map-stops-count">{dayActivities.length} stops</span>
          </div>
          <div className="map-card-body">
            <MapView
              destination={trip.destination}
              activities={dayActivities}
              currency={trip.budget?.currency}
              activeIndex={activeActivity}
              onMarkerClick={(idx) => setActiveActivity(idx)}
            />
          </div>
        </div>
      </aside>
    </div>
  );
};

export default TripResults;
