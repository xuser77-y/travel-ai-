import React from 'react';
import { Hotel, Star, MapPin, ExternalLink, Coffee, Wifi } from 'lucide-react';
import './BookingSections.css';

/**
 * Hotels section with deep links to Booking.com / Hotels.com / Airbnb / Expedia.
 */
const HotelsSection = ({ trip }) => {
  const destination = trip.destination?.name?.split(',')[0] || '';
  const startDate = trip.dates?.start ? new Date(trip.dates.start).toISOString().split('T')[0] : '';
  const endDate = trip.dates?.end ? new Date(trip.dates.end).toISOString().split('T')[0] : '';
  const currency = trip.budget?.currency || 'USD';
  const estimatedPrice = trip.hotels?.price || trip.budget?.breakdown?.hotels;
  const recommendedName = trip.hotels?.name;
  const recommendedDesc = trip.hotels?.description;
  const recommendedStars = trip.hotels?.stars;
  const recommendedNeighborhood = trip.hotels?.neighborhood;
  const recommendedAmenities = Array.isArray(trip.hotels?.amenities) ? trip.hotels.amenities : [];
  const bookingTip = trip.hotels?.bookingTip;
  const altHotels = Array.isArray(trip.hotels?.options) ? trip.hotels.options : [];

  // Estimate adults from travelers
  const adults = trip.travelers === 'family' ? 2 : trip.travelers === 'group' ? 4 : trip.travelers === 'couple' ? 2 : 1;
  const children = trip.travelers === 'family' ? 2 : 0;

  const buildLink = (provider) => {
    const dest = encodeURIComponent(destination);
    const checkin = startDate;
    const checkout = endDate;

    switch (provider) {
      case 'booking':
        return `https://www.booking.com/searchresults.html?ss=${dest}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&group_children=${children}`;
      case 'hotels':
        return `https://www.hotels.com/Hotel-Search?destination=${dest}&startDate=${checkin}&endDate=${checkout}&rooms[0].numberOfAdults=${adults}`;
      case 'airbnb':
        return `https://www.airbnb.com/s/${dest}/homes?checkin=${checkin}&checkout=${checkout}&adults=${adults}&children=${children}`;
      case 'expedia':
        return `https://www.expedia.com/Hotel-Search?destination=${dest}&startDate=${checkin}&endDate=${checkout}&adults=${adults}`;
      default:
        return '#';
    }
  };

  const providers = [
    { id: 'booking', name: 'Booking.com', logo: 'B', color: '#003580' },
    { id: 'airbnb', name: 'Airbnb', logo: 'A', color: '#ff385c' },
    { id: 'hotels', name: 'Hotels.com', logo: 'H', color: '#d32f2f' },
    { id: 'expedia', name: 'Expedia', logo: 'E', color: '#fbc02d' }
  ];

  const open = (provider) => {
    window.open(buildLink(provider), '_blank', 'noopener,noreferrer');
  };

  // Compute nights
  const nights = startDate && endDate
    ? Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)))
    : 1;
  const pricePerNight = estimatedPrice ? Math.round(estimatedPrice / nights) : null;

  return (
    <section className="booking-section hotels-section">
      <header className="booking-header">
        <div className="bh-icon hotels-icon">
          <Hotel size={20} />
        </div>
        <div className="bh-text">
          <h3>Hotels & Stays</h3>
          <p>Compare and book the perfect accommodation</p>
        </div>
        {pricePerNight && (
          <div className="bh-price">
            <small>From</small>
            <strong>{currency} {pricePerNight}</strong>
            <span className="bh-price-unit">/ night</span>
          </div>
        )}
      </header>

      {/* AI recommended hotel card */}
      {recommendedName && (
        <div className="recommended-hotel">
          <div className="rh-tag">
            <Star size={12} fill="currentColor" />
            <span>AI RECOMMENDED</span>
            {recommendedStars > 0 && (
              <span className="rh-stars">
                {Array.from({ length: Math.min(5, Math.round(recommendedStars)) }).map((_, i) => (
                  <Star key={i} size={11} fill="#eab308" stroke="#eab308" />
                ))}
              </span>
            )}
          </div>
          <h4>{recommendedName}</h4>
          {recommendedDesc && <p>{recommendedDesc}</p>}
          <div className="rh-amenities">
            {recommendedNeighborhood && (
              <span><MapPin size={12} /> {recommendedNeighborhood}</span>
            )}
            {(recommendedAmenities.length ? recommendedAmenities : ['Wi-Fi', 'Breakfast', 'Central']).slice(0, 6).map((a, i) => {
              const lower = String(a).toLowerCase();
              const Icon = lower.includes('wifi') || lower.includes('wi-fi') ? Wifi
                : lower.includes('breakfast') || lower.includes('coffee') ? Coffee
                : MapPin;
              return <span key={i}><Icon size={12} /> {a}</span>;
            })}
          </div>
          {bookingTip && (
            <div className="ai-suggestion" style={{ marginTop: 10 }}>
              <span className="ai-tag">BOOKING TIP</span>
              <p>{bookingTip}</p>
            </div>
          )}
        </div>
      )}

      {/* Alternative hotel options */}
      {altHotels.length > 0 && (
        <div className="alt-options">
          <h5 className="alt-title">Alternatives</h5>
          <ul className="alt-list">
            {altHotels.map((h, i) => (
              <li key={i} className="alt-item">
                <div className="alt-main">
                  <strong>{h.name || 'Hotel'}{h.stars ? ` • ${h.stars}★` : ''}</strong>
                  <span className="alt-meta">
                    {h.neighborhood}
                    {Array.isArray(h.amenities) && h.amenities.length > 0 && ` • ${h.amenities.slice(0, 3).join(' · ')}`}
                  </span>
                  {h.reason && <small className="alt-reason">{h.reason}</small>}
                </div>
                {h.pricePerNight && (
                  <span className="alt-price">{currency} {Math.round(h.pricePerNight)}<small> /night</small></span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stay summary */}
      <div className="stay-summary">
        <div className="ss-item">
          <span className="ss-label">Check-in</span>
          <strong>{startDate || '—'}</strong>
        </div>
        <div className="ss-divider" />
        <div className="ss-item">
          <span className="ss-label">Check-out</span>
          <strong>{endDate || '—'}</strong>
        </div>
        <div className="ss-divider" />
        <div className="ss-item">
          <span className="ss-label">Guests</span>
          <strong>{adults} adult{adults > 1 ? 's' : ''}{children > 0 ? `, ${children} kids` : ''}</strong>
        </div>
        <div className="ss-divider" />
        <div className="ss-item">
          <span className="ss-label">Nights</span>
          <strong>{nights}</strong>
        </div>
      </div>

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
              <small>Compare prices</small>
            </div>
            <ExternalLink size={14} className="provider-ext" />
          </button>
        ))}
      </div>
    </section>
  );
};

export default HotelsSection;
