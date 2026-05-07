import React from 'react';
import { useNavigate } from 'react-router-dom';
import useTripStore from '../../stores/tripStore';
import { Users, User, Heart, Home, Calendar as CalendarIcon } from 'lucide-react';
import './Planner.css';

// Max trip length the planner accepts. Two reasons we cap it here:
//   1. The weather provider (Open-Meteo free tier) only forecasts 16 days
//      ahead — beyond that we'd silently drop the per-day verdict.
//   2. The LLM has a fixed JSON output budget; asking for 24+ days truncates
//      the response and the user ends up with only ~8 days of itinerary.
// 10 days is the sweet spot that keeps both reliable.
const MAX_TRIP_DAYS = 10;

// Add `days` calendar days to a YYYY-MM-DD string, returning a new YYYY-MM-DD.
const addDays = (ymd, days) => {
  const d = new Date(ymd);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

// Number of nights between two YYYY-MM-DD strings (≥0). Returns null if
// either side is missing so the caller can skip validation.
const diffDays = (start, end) => {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
};

const Step2Dates = () => {
  const navigate = useNavigate();
  const { formData, setFormData } = useTripStore();
  const today = new Date().toISOString().split('T')[0];

  // The check-out date is bounded to start + (MAX_TRIP_DAYS - 1) so that
  // a `start..end` inclusive range is at most MAX_TRIP_DAYS days long.
  const maxEnd = formData.dates.start
    ? addDays(formData.dates.start, MAX_TRIP_DAYS - 1)
    : undefined;

  const tripDays = (() => {
    const nights = diffDays(formData.dates.start, formData.dates.end);
    return nights == null ? null : nights + 1;
  })();
  const tooLong = tripDays != null && tripDays > MAX_TRIP_DAYS;

  const travelerTypes = [
    { id: 'solo', label: 'Solo', icon: <User size={30} />, desc: 'Single adventurer' },
    { id: 'couple', label: 'Couple', icon: <Heart size={30} />, desc: 'Perfect for two' },
    { id: 'family', label: 'Family', icon: <Home size={30} />, desc: 'Fun for all ages' },
    { id: 'group', label: 'Group', icon: <Users size={30} />, desc: 'The more, the merrier' }
  ];

  // Setting a check-in that's after the current check-out (or that would
  // make the range exceed MAX_TRIP_DAYS) clears the check-out so the user
  // gets a fresh, valid pick.
  const onChangeStart = (value) => {
    const next = { ...formData.dates, start: value };
    if (formData.dates.end) {
      const span = diffDays(value, formData.dates.end);
      if (span == null || span < 0 || span + 1 > MAX_TRIP_DAYS) {
        next.end = '';
      }
    }
    setFormData({ dates: next });
  };

  const onChangeEnd = (value) => {
    setFormData({ dates: { ...formData.dates, end: value } });
  };

  const handleNext = () => {
    if (formData.dates.start && formData.dates.end && !tooLong) {
      navigate('/planner/step3');
    }
  };

  return (
    <div className="planner-step glass-card">
      <div className="step-header">
        <span className="step-indicator">Step 2 of 4</span>
        <h2>When and with whom?</h2>
        <p>Set your travel dates and choose your traveler type.</p>
      </div>

      <div className="planner-content">
        <div className="date-inputs-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '12px' }}>
          <div className="input-group">
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', opacity: 0.7 }}>Check-in</label>
            <div className="input-wrapper">
              <CalendarIcon className="input-icon" size={20} />
              <input
                type="date"
                min={today}
                value={formData.dates.start}
                onChange={(e) => onChangeStart(e.target.value)}
              />
            </div>
          </div>
          <div className="input-group">
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', opacity: 0.7 }}>
              Check-out
              {formData.dates.start && (
                <span style={{ marginLeft: 8, opacity: 0.55 }}>
                  (max {MAX_TRIP_DAYS} days)
                </span>
              )}
            </label>
            <div className="input-wrapper">
              <CalendarIcon className="input-icon" size={20} />
              <input
                type="date"
                min={formData.dates.start || today}
                max={maxEnd}
                value={formData.dates.end}
                onChange={(e) => onChangeEnd(e.target.value)}
                disabled={!formData.dates.start}
              />
            </div>
          </div>
        </div>

        {/* Live duration / cap feedback. Stays out of the way until the
            user actually picks a range. */}
        <div
          style={{
            marginBottom: 28,
            fontSize: '0.85rem',
            color: tooLong ? '#ef4444' : 'var(--text-muted, rgba(255,255,255,0.6))',
            minHeight: 20
          }}
        >
          {tripDays != null && (
            tooLong
              ? `Trips are limited to ${MAX_TRIP_DAYS} days — please pick an earlier check-out.`
              : `${tripDays} day${tripDays === 1 ? '' : 's'} selected.`
          )}
        </div>

        <div className="traveler-section">
          <label style={{ display: 'block', marginBottom: '20px', fontWeight: 700, fontSize: '1.1rem' }}>Who is traveling?</label>
          <div className="cards-grid">
            {travelerTypes.map((type) => (
              <div 
                key={type.id}
                className={`option-card glass-card ${formData.travelers === type.id ? 'active' : ''}`}
                onClick={() => setFormData({ travelers: type.id })}
              >
                <div className="icon">{type.icon}</div>
                <h4>{type.label}</h4>
                <p>{type.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="step-footer">
        <button className="btn-secondary" onClick={() => navigate('/planner/step1')}>Back</button>
        <button
          className="btn-primary"
          onClick={handleNext}
          disabled={!formData.dates.start || !formData.dates.end || tooLong}
        >
          Next Step
        </button>
      </div>
    </div>
  );
};

export default Step2Dates;
