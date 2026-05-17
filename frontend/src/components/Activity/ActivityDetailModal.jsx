import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  X,
  Sparkles,
  Lightbulb,
  Clock,
  MapPin,
  DollarSign,
  Sun,
  Home,
  Trees,
  Star,
  Loader2
} from 'lucide-react';
import './ActivityDetailModal.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ---------------------------------------------------------------------------
// ActivityDetailModal
//
// Opens when the user clicks an activity card on the Trip Results page.
// Lazy-loads the detail payload from /api/places/info (24h cached server
// side) and renders a rich panel with a hero photo, description, why-visit
// bullets, insider tips, best time to visit and short highlight tags.
//
// Props:
//   open          : boolean
//   onClose       : () => void
//   activity      : { name, category, description, cost, duration, lat, lon, isIndoor }
//   destination   : string  — the trip destination (used for photo + LLM)
//   currency      : string  — the trip currency (USD, EUR, …)
//   onShowOnMap   : () => void  — closes the modal and highlights the marker
// ---------------------------------------------------------------------------
const ActivityDetailModal = ({
  open,
  onClose,
  activity,
  destination,
  currency,
  onShowOnMap
}) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Lock body scroll while the modal is open + close on Esc.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // Fetch the detail payload whenever the modal opens for a new activity.
  useEffect(() => {
    if (!open || !activity?.name) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    axios
      .post(`${API}/api/places/info`, {
        name: activity.name,
        category: activity.category || '',
        destination: destination || '',
        shortDescription: activity.description || '',
        lat: typeof activity.lat === 'number' ? activity.lat : null,
        lon: typeof activity.lon === 'number' ? activity.lon : null
      })
      .then((res) => {
        if (!cancelled) setDetail(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load place detail:', err);
          setError('Could not load extra details — showing what we have.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, activity?.name, activity?.category, destination]);

  if (!open || !activity) return null;

  const heroPhoto = detail?.photo || null;
  const description = detail?.description || activity.description || '';
  const whyVisit = detail?.whyVisit || [];
  const tips = detail?.tips || [];
  const bestTime = detail?.bestTimeToVisit || '';
  const highlights = detail?.highlights || [];

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div className="activity-modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="activity-modal glass-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${activity.name}`}
      >
        {/* ---------------- Hero ---------------- */}
        <div
          className={`activity-modal-hero ${heroPhoto ? 'has-photo' : 'no-photo'}`}
          style={heroPhoto ? { backgroundImage: `url(${heroPhoto})` } : undefined}
        >
          {!heroPhoto && (
            <div className="activity-modal-hero-fallback">
              <MapPin size={36} />
            </div>
          )}
          <div className="activity-modal-hero-overlay">
            {activity.category && (
              <span className="activity-modal-category">{activity.category}</span>
            )}
            <h2 className="activity-modal-title">{activity.name}</h2>
            <div className="activity-modal-meta-row">
              {typeof activity.cost === 'number' && activity.cost > 0 && (
                <span className="meta-pill">
                  <DollarSign size={12} /> {currency || ''} {activity.cost}
                </span>
              )}
              {activity.duration && (
                <span className="meta-pill">
                  <Clock size={12} /> {activity.duration}
                </span>
              )}
              {typeof activity.isIndoor === 'boolean' && (
                <span className="meta-pill">
                  {activity.isIndoor ? <Home size={12} /> : <Trees size={12} />}
                  {activity.isIndoor ? 'Indoor' : 'Outdoor'}
                </span>
              )}
              {bestTime && (
                <span className="meta-pill highlight">
                  <Sun size={12} /> {bestTime}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="activity-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* ---------------- Body ---------------- */}
        <div className="activity-modal-body">
          {loading && (
            <div className="activity-modal-loading">
              <Loader2 size={20} className="spin" />
              <span>Loading details…</span>
            </div>
          )}

          {error && !loading && (
            <div className="activity-modal-error">{error}</div>
          )}

          {highlights.length > 0 && (
            <div className="activity-modal-highlights">
              {highlights.map((tag, idx) => (
                <span key={idx} className="highlight-chip">
                  <Star size={11} /> {tag}
                </span>
              ))}
            </div>
          )}

          {description && (
            <section className="activity-modal-section">
              <h3>About this place</h3>
              <p className="activity-modal-description">{description}</p>
            </section>
          )}

          {whyVisit.length > 0 && (
            <section className="activity-modal-section">
              <h3>
                <Sparkles size={16} /> Why visit
              </h3>
              <ul className="activity-modal-list why-list">
                {whyVisit.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </section>
          )}

          {tips.length > 0 && (
            <section className="activity-modal-section">
              <h3>
                <Lightbulb size={16} /> Insider tips
              </h3>
              <ul className="activity-modal-list tips-list">
                {tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </section>
          )}

          {/* ---------------- Footer actions ---------------- */}
          <div className="activity-modal-actions">
            {typeof activity.lat === 'number' && typeof activity.lon === 'number' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onShowOnMap?.();
                  onClose?.();
                }}
              >
                <MapPin size={16} /> View on map
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityDetailModal;
