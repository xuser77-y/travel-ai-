import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, MapPin, TrendingUp, Clock,
  ChevronRight, Compass, Settings, Plus, Trash2
} from 'lucide-react';
import axios from 'axios';
import useTripStore from '../stores/tripStore';
import { useTranslation } from '../hooks/useTranslation';
import { useToast } from '../components/UI/Toast';
import { useConfirm } from '../components/UI/ConfirmDialog';
import './Dashboard.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/trips/user`, {
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
      title: t('dashboard.deleteTitle'),
      message: `${t('dashboard.deleteMsg')} ${place} ${t('dashboard.deleteMsg2')}`,
      confirmLabel: t('dashboard.deleteConfirm'),
      cancelLabel: t('dashboard.deleteCancel'),
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await axios.delete(`${API}/api/trips/${trip._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrips((prev) => prev.filter((t) => t._id !== trip._id));
      toast.success(`${t('dashboard.deletedSuccess')} ${place}.`);
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
          <p className="welcome-label">{t('dashboard.travelHub')}</p>
          <h1>{t('dashboard.welcome')} {user?.name?.split(' ')[0]}</h1>
        </div>
        <button className="btn-primary create-new" onClick={() => navigate('/planner')}>
          <Plus size={20} /> {t('dashboard.planNew')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-icon sapphire"><Compass size={24} /></div>
          <div className="stat-info">
            <h3>{trips.length}</h3>
            <p>{t('dashboard.tripsPlanned')}</p>
          </div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-icon gold"><MapPin size={24} /></div>
          <div className="stat-info">
            <h3>{uniqueCities}</h3>
            <p>{t('dashboard.citiesExplored')}</p>
          </div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-icon blue"><TrendingUp size={24} /></div>
          <div className="stat-info">
            <h3>${Math.round(totalSpent).toLocaleString()}</h3>
            <p>{t('dashboard.travelValue')}</p>
          </div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-icon purple"><Clock size={24} /></div>
          <div className="stat-info">
            <h3>{t('dashboard.ready2030')}</h3>
            <p>{t('dashboard.wcPrep')}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-main">
        {/* Recent Trips */}
        <section className="trips-section">
          <div className="section-header">
            <h2>{t('dashboard.recentTrips')}</h2>
            <button className="view-all">{t('dashboard.viewAll')}</button>
          </div>

          <div className="trips-list">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>{t('dashboard.curating')}</p>
              </div>
            ) : error ? (
              <div className="empty-trips glass-card">
                <Compass size={48} />
                <h3>{t('dashboard.wentWrong')}</h3>
                <p>{error}</p>
                <button className="btn-primary" onClick={fetchTrips}>{t('dashboard.retry')}</button>
              </div>
            ) : trips.length === 0 ? (
              <div className="empty-trips glass-card">
                <Compass size={48} />
                <h3>{t('dashboard.noAdventures')}</h3>
                <p>{t('dashboard.noAdventuresSub')}</p>
                <button className="btn-primary" onClick={() => navigate('/planner')}>{t('dashboard.startPlanning')}</button>
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
                        {trip.status === 'generated' ? t('dashboard.ready') : trip.status || t('dashboard.saved')}
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
                          <span><Clock size={14} /> {dayCount} {dayCount > 1 ? t('dashboard.days') : t('dashboard.day')}</span>
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
              <button className="btn-secondary-outline">{t('dashboard.editProfile')}</button>
            </div>
          </div>

          <div className="community-ad glass-card">
            <h4>{t('dashboard.globalChat')}</h4>
            <p>{t('dashboard.globalChatDesc')}</p>
            <button className="btn-community" onClick={() => navigate('/community')}>{t('dashboard.joinHub')}</button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Dashboard;
