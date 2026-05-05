import React from 'react';
import { Plane, ArrowRight, ExternalLink, Clock, DollarSign } from 'lucide-react';
import './BookingSections.css';

/**
 * Flights section with deep links to multiple booking sites.
 * The user picks their preferred provider and is redirected with pre-filled query params.
 */
const FlightsSection = ({ trip }) => {
  const origin = trip.startCity?.split(',')[0] || '';
  const destination = trip.destination?.name?.split(',')[0] || '';
  const startDate = trip.dates?.start ? new Date(trip.dates.start).toISOString().split('T')[0] : '';
  const endDate = trip.dates?.end ? new Date(trip.dates.end).toISOString().split('T')[0] : '';
  const currency = trip.budget?.currency || 'USD';
  const estimatedPrice = trip.flights?.price || trip.budget?.breakdown?.flights;
  const suggestion = trip.flights?.suggestion;

  const buildLink = (provider) => {
    const o = encodeURIComponent(origin);
    const d = encodeURIComponent(destination);

    switch (provider) {
      case 'skyscanner':
        return `https://www.skyscanner.com/transport/flights/${o}/${d}/${startDate.replace(/-/g, '').slice(2)}/${endDate.replace(/-/g, '').slice(2)}/`;
      case 'google':
        return `https://www.google.com/travel/flights?q=Flights%20from%20${o}%20to%20${d}%20on%20${startDate}%20to%20${endDate}`;
      case 'kiwi':
        return `https://www.kiwi.com/en/search/results/${o}/${d}/${startDate}/${endDate}`;
      case 'kayak':
        return `https://www.kayak.com/flights/${o}-${d}/${startDate}/${endDate}`;
      default:
        return '#';
    }
  };

  const providers = [
    { id: 'google', name: 'Google Flights', logo: 'G', color: '#4285F4' },
    { id: 'skyscanner', name: 'Skyscanner', logo: 'S', color: '#0770e3' },
    { id: 'kiwi', name: 'Kiwi.com', logo: 'K', color: '#00a991' },
    { id: 'kayak', name: 'Kayak', logo: 'K', color: '#ff690f' }
  ];

  const open = (provider) => {
    window.open(buildLink(provider), '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="booking-section flights-section">
      <header className="booking-header">
        <div className="bh-icon flights-icon">
          <Plane size={20} />
        </div>
        <div className="bh-text">
          <h3>Flights</h3>
          <p>Pick your preferred airline & book in one click</p>
        </div>
        {estimatedPrice && (
          <div className="bh-price">
            <small>Est.</small>
            <strong>{currency} {Math.round(estimatedPrice)}</strong>
          </div>
        )}
      </header>

      {/* Route summary */}
      <div className="route-summary">
        <div className="route-leg">
          <span className="leg-label">From</span>
          <strong>{origin || '—'}</strong>
        </div>
        <div className="route-arrow">
          <ArrowRight size={20} />
          <small>{startDate}</small>
        </div>
        <div className="route-leg">
          <span className="leg-label">To</span>
          <strong>{destination || '—'}</strong>
        </div>
      </div>

      {/* Primary AI flight pick */}
      {(suggestion || trip.flights?.airline) && (
        <div className="recommended-hotel">
          <div className="rh-tag">
            <Plane size={12} fill="currentColor" />
            <span>AI RECOMMENDED</span>
          </div>
          {trip.flights?.airline && (
            <h4>{trip.flights.airline}{trip.flights.flightClass ? ` — ${trip.flights.flightClass}` : ''}</h4>
          )}
          {suggestion && <p>{suggestion}</p>}
          <div className="rh-amenities">
            {typeof trip.flights?.stops === 'number' && (
              <span><ArrowRight size={12} /> {trip.flights.stops === 0 ? 'Direct' : `${trip.flights.stops} stop${trip.flights.stops > 1 ? 's' : ''}`}</span>
            )}
            {trip.flights?.durationHours && (
              <span><Clock size={12} /> {trip.flights.durationHours}h</span>
            )}
            {trip.flights?.baggageTip && (
              <span title={trip.flights.baggageTip}><DollarSign size={12} /> {trip.flights.baggageTip}</span>
            )}
          </div>
          {trip.flights?.bookingTip && (
            <div className="ai-suggestion" style={{ marginTop: 10 }}>
              <span className="ai-tag">BOOKING TIP</span>
              <p>{trip.flights.bookingTip}</p>
            </div>
          )}
        </div>
      )}

      {/* Provider buttons */}
      <div className="providers-grid">
        {providers.map((p) => (
          <button
            key={p.id}
            className="provider-btn"
            onClick={() => open(p.id)}
            style={{ '--provider-color': p.color }}
          >
            <span className="provider-logo" style={{ background: p.color }}>{p.logo}</span>
            <div className="provider-info">
              <strong>{p.name}</strong>
              <small>Search & book</small>
            </div>
            <ExternalLink size={14} className="provider-ext" />
          </button>
        ))}
      </div>
    </section>
  );
};

export default FlightsSection;
