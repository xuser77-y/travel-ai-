import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, MapPin, TrendingUp, Clock,
  ChevronRight, Compass, Settings, Plus, Trash2
} from 'lucide-react';
import axios from 'axios';
import useTripStore from '../stores/tripStore';
import { useToast } from '../components/UI/Toast';
import { useConfirm } from '../components/UI/ConfirmDialog';
import './Dashboard.css';

const formatDateRange = (start, end) => {
  if (!start || !end) return '—';
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const eStr = e.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric'
  });
  return `${sStr} — ${eStr}, ${e.getFullYear()}`;
};

const daysBetween = (start, end) => {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)));
};

const Dashboard = () => {
  const { user, token, setTrip } = useTripStore();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/api/trips/user', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrips(res.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch trips:', err);
      setError(err.response?.data?.error || 'Could not load your trips. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, navigate]);

  const handleOpenTrip = (trip) => {
    setTrip(trip);
    navigate(`/trip/${trip._id}`);
  };

  const handleDeleteTrip = async (e, trip) => {
    e.stopPropagation();
    const place = trip.destination?.name?.split(',')[0] || 'this trip';
    const ok = await confirm({
      title: 'Delete trip?',
      message: `Your trip to ${place} will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await axios.delete(`http://localhost:5000/api/trips/${trip._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrips((prev) => prev.filter((t) => t._id !== trip._id));
      toast.success(`Deleted your trip to ${place}.`);
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error(err.response?.data?.error || 'Could not delete trip. Try again.');
    }
  };

  const totalSpent = trips.reduce((acc, t) => acc + (t.budget?.total || 0), 0);
  const uniqueCities = new Set(trips.map((t) => t.destination?.name?.split(',')[0]).filter(Boolean)).size;

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="header-content">
          <p className="welcome-label">Personal Travel Hub</p>
          <h1>Welcome, {user?.name?.split(' ')[0]}</h1>
        </div>
        <button className="btn-primary create-new" onClick={() => navigate('/planner')}>
          <Plus size={20} /> Plan New Adventure
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-icon sapphire"><Compass size={24} /></div>
          <div className="stat-info">
            <h3>{trips.length}</h3>
            <p>Trips Planned</p>
          </div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-icon gold"><MapPin size={24} /></div>
          <div className="stat-info">
            <h3>{uniqueCities}</h3>
            <p>Cities Explored</p>
          </div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-icon blue"><TrendingUp size={24} /></div>
          <div className="stat-info">
            <h3>${Math.round(totalSpent).toLocaleString()}</h3>
            <p>Travel Value</p>
          </div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-icon purple"><Clock size={24} /></div>
          <div className="stat-info">
            <h3>2030 Ready</h3>
            <p>World Cup Prep</p>
          </div>
        </div>
      </div>

      <div className="dashboard-main">
        {/* Recent Trips */}
        <section className="trips-section">
          <div className="section-header">
            <h2>Recent Itineraries</h2>
            <button className="view-all">View All</button>
          </div>

          <div className="trips-list">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Curating your adventures...</p>
              </div>
            ) : error ? (
              <div className="empty-trips glass-card">
                <Compass size={48} />
                <h3>Something went wrong</h3>
                <p>{error}</p>
                <button className="btn-primary" onClick={fetchTrips}>Retry</button>
              </div>
            ) : trips.length === 0 ? (
              <div className="empty-trips glass-card">
                <Compass size={48} />
                <h3>No adventures yet</h3>
                <p>Your AI-planned itineraries will appear here.</p>
                <button className="btn-primary" onClick={() => navigate('/planner')}>Start Planning</button>
              </div>
            ) : (
              trips.map((trip) => {
                const cityName = trip.destination?.name?.split(',')[0] || 'Trip';
                const country = trip.destination?.name?.split(',').slice(1).join(',').trim();
                const dayCount = trip.itinerary?.length || daysBetween(trip.dates?.start, trip.dates?.end);
                const photo = trip.destination?.photo;
                return (
                  <div
                    key={trip._id}
                    className="trip-dashboard-card"
                    onClick={() => handleOpenTrip(trip)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleOpenTrip(trip);
                    }}
                  >
                    <div
                      className="trip-card-image"
                      style={{
                        backgroundImage: photo
                          ? `linear-gradient(135deg, rgba(0,0,0,0.10), rgba(0,0,0,0.45)), url(${photo})`
                          : undefined
                      }}
                    >
                      {!photo && <MapPin size={32} />}
                      <span className={`status-chip status-${trip.status || 'generated'}`}>
                        {trip.status === 'generated' ? 'Ready' : trip.status || 'Saved'}
                      </span>
                    </div>

                    <div className="trip-card-content">
                      <div className="trip-main-info">
                        <h3>
                          {cityName}
                          {country && <span className="trip-country">, {country}</span>}
                        </h3>
                        <div className="trip-info-row">
                          <span><Calendar size={14} /> {formatDateRange(trip.dates?.start, trip.dates?.end)}</span>
                          <span><Clock size={14} /> {dayCount} day{dayCount > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="trip-meta">
                        {trip.style && <span className="style-badge">{trip.style}</span>}
                        {typeof trip.budget?.total === 'number' && (
                          <span className="price-tag">
                            {trip.budget?.currency || '$'} {Math.round(trip.budget.total).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="trip-card-actions">
                      <button
                        type="button"
                        className="icon-btn-danger"
                        title="Delete trip"
                        onClick={(e) => handleDeleteTrip(e, trip)}
                      >
                        <Trash2 size={16} />
                      </button>
                      <ChevronRight className="arrow" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Sidebar: Profile & Community */}
        <aside className="dashboard-sidebar">
          <div className="profile-mini-card glass-card">
            <div className="mini-header">
              <Settings size={18} />
            </div>
            <div className="mini-content">
              <div className="large-avatar">{user?.name?.[0]}</div>
              <h3>{user?.name}</h3>
              <p>{user?.email}</p>
              <button className="btn-secondary-outline">Edit Profile</button>
            </div>
          </div>

          <div className="community-ad glass-card">
            <h4>Global Chat</h4>
            <p>Connect with other travelers visiting the same spots.</p>
            <button className="btn-community" onClick={() => navigate('/community')}>Join Hub</button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Dashboard;
