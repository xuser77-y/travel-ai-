import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Trophy, Users, Star, Clock, Compass, Zap, ExternalLink, ArrowRight, MessageCircle, Calendar } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import useTripStore from '../stores/tripStore';
import './WorldCup.css';

// Numbered DivIcon marker for stadium pins
const makeStadiumIcon = (number) => L.divIcon({
  className: 'wc-marker-wrap',
  html: `<div class="wc-marker"><span>${number}</span></div>`,
  iconSize: [38, 46],
  iconAnchor: [19, 44],
  popupAnchor: [0, -42]
});

function FitToCities({ cities }) {
  const map = useMap();
  useEffect(() => {
    if (cities && cities.length > 0) {
      const bounds = L.latLngBounds(cities.map((c) => [c.lat, c.lon]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });
    }
  }, [cities, map]);
  return null;
}

function ThemedTiles() {
  const [isLight, setIsLight] = useState(() => document.body.classList.contains('light-mode'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLight(document.body.classList.contains('light-mode'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return (
    <TileLayer
      attribution='&copy; OpenStreetMap &copy; CARTO'
      url={isLight
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'}
    />
  );
}

const WorldCup = () => {
  const navigate = useNavigate();
  const { language: lang, setFormData, resetStore } = useTripStore();
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCity, setActiveCity] = useState(null);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  // Trip templates for the AI-Powered Planners section
  const applyTemplate = (template) => {
    resetStore();
    const today = new Date();
    const start = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000); // ~2 months out
    const end = new Date(start.getTime() + (template.days - 1) * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().split('T')[0];

    setFormData({
      destination: {
        name: template.city + ', Morocco',
        lat: template.lat,
        lon: template.lon
      },
      dates: { start: fmt(start), end: fmt(end) },
      travelers: template.travelers,
      budget: template.budget,
      style: template.style,
      interests: template.interests,
      dietary: []
    });
    navigate('/planner');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const translations = {
    en: {
      heroTitle: "Magical Morocco.",
      heroSub: "THE ROAD TO 2030",
      heroDesc: "Experience the first-ever peri-continental World Cup. Morocco welcomes the world with its legendary hospitality and cinematic landscapes.",
      arenasTitle: "The Grand Arenas",
      stadiumsTitle: "Host Stadiums",
      stadiumsSub: "Six iconic venues, one historic tournament.",
      itinerariesTitle: "Curated Itineraries",
      soulTitle: "Discover the Soul of the Kingdom",
      planJourney: "Plan your Journey",
      exploreVenues: "Explore Venues",
      days: "DAYS", hours: "HOURS", mins: "MINS", secs: "SECS"
    },
    fr: {
      heroTitle: "Maroc Magique.",
      heroSub: "LA ROUTE VERS 2030",
      heroDesc: "Découvrez la toute première Coupe du Monde péri-continentale. Le Maroc accueille le monde avec son hospitalité légendaire et ses paysages cinématographiques.",
      arenasTitle: "Les Grandes Arènes",
      stadiumsTitle: "Stades Hôtes",
      stadiumsSub: "Six lieux emblématiques, un tournoi historique.",
      itinerariesTitle: "Itinéraires Organisés",
      soulTitle: "Découvrez l'Âme du Royaume",
      planJourney: "Planifier votre voyage",
      exploreVenues: "Explorer les sites",
      days: "JOURS", hours: "HEURES", mins: "MINS", secs: "SECS"
    },
    ar: {
      heroTitle: "المغرب الساحر",
      heroSub: "الطريق إلى 2030",
      heroDesc: "جرب أول كأس عالم عابر للقارات على الإطلاق. المغرب يرحب بالعالم بضيافته الأسطورية ومناظره الخلابة.",
      arenasTitle: "الملاعب الكبرى",
      stadiumsTitle: "الملاعب المستضيفة",
      stadiumsSub: "ستة أماكن رمزية، بطولة تاريخية واحدة.",
      itinerariesTitle: "مسارات منسقة",
      soulTitle: "اكتشف روح المملكة",
      planJourney: "خطط رحلتك",
      exploreVenues: "استكشف الملاعب",
      days: "أيام", hours: "ساعات", mins: "دقائق", secs: "ثواني"
    }
  };

  const t = translations[lang] || translations.en;

  useEffect(() => {
    // Dynamic Countdown Logic
    const targetDate = new Date('June 14, 2030 18:00:00').getTime();
    
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;
      
      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        secs: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    const fetchWCData = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/worldcup/cities');
        setCities(res.data);
      } catch (err) {
        console.error('Error fetching World Cup data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWCData();
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`world-cup-v2 ${lang === 'ar' ? 'rtl' : ''}`}>
      {/* Hero Section */}
      <section className="wc-hero-v2" style={{ backgroundImage: `url('/assets/stadiums/magical_morocco_hero_1777285782527.png')` }}>
        <div className="wc-hero-overlay">
          <div className="wc-hero-content-v2">
            <span className="road-tag">{t.heroSub}</span>
            <h1 className="magical-title">{t.heroTitle.split(' ').map((w, i) => <React.Fragment key={i}>{w}<br /></React.Fragment>)}</h1>
            <p className="magical-desc">{t.heroDesc}</p>
            
            <div className="countdown-group">
              <div className="cd-item"><strong>{timeLeft.days}</strong><span>{t.days}</span></div>
              <div className="cd-item"><strong>{timeLeft.hours}</strong><span>{t.hours}</span></div>
              <div className="cd-item"><strong>{timeLeft.mins}</strong><span>{t.mins}</span></div>
              <div className="cd-item"><strong>{timeLeft.secs}</strong><span>{t.secs}</span></div>
            </div>

            <div className="hero-v2-ctas">
              <button className="btn-primary" onClick={() => navigate('/planner')}>{t.planJourney}</button>
              <button className="btn-glass" onClick={() => {
                const el = document.getElementById('host-stadiums');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}>{t.exploreVenues}</button>
            </div>
          </div>
          <div className="hero-flags">
            <img src="https://flagcdn.com/w80/ma.png" alt="Morocco" />
            <img src="https://flagcdn.com/w80/es.png" alt="Spain" />
            <img src="https://flagcdn.com/w80/pt.png" alt="Portugal" />
          </div>
        </div>
      </section>

      {/* Map + Match Preview */}
      <section className="grand-arenas">
        <div className="section-header-v2">
          <h2 className="section-title-v2">{t.arenasTitle}</h2>
          <p>Discover the state-of-the-art stadiums hosting the world's greatest stage.</p>
        </div>

        <div className="arenas-container">
          <div className="map-wrapper">
            {!loading && cities.length > 0 ? (
              <MapContainer center={[31.7917, -7.0926]} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <ThemedTiles />
                <FitToCities cities={cities} />
                {cities.map((city, i) => (
                  <Marker
                    key={city.name}
                    position={[city.lat, city.lon]}
                    icon={makeStadiumIcon(i + 1)}
                    eventHandlers={{ click: () => setActiveCity(city.name) }}
                  >
                    <Popup minWidth={240} maxWidth={280}>
                      <div className="map-popup-content">
                        {city.photoUrl && (
                          <div className="mp-photo" style={{ backgroundImage: `url(${city.photoUrl})` }} />
                        )}
                        <div className="mp-body">
                          <span className="mp-tag">Match Venue</span>
                          <h4>{city.stadium}</h4>
                          <p>{city.name}{city.temp ? ` • ${Math.round(city.temp)}°C today` : ''}</p>
                          <button
                            className="mp-google-btn"
                            onClick={() => window.open(
                              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(city.stadium + ', ' + city.name)}`,
                              '_blank',
                              'noopener,noreferrer'
                            )}
                          >
                            <ExternalLink size={14} /> Open in Google Maps
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="map-skeleton">
                <Compass size={32} />
                <p>Loading host cities…</p>
              </div>
            )}
          </div>

          <div className="match-preview">
            <div className="match-header">
              <Clock size={18} /> <span>Match Highlights</span>
            </div>
            <div className="match-list">
              <div className="match-item">
                <span className="m-date">OPENING • JUNE 14, 2030</span>
                <div className="m-teams">
                  <img src="https://flagcdn.com/w40/ma.png" alt="Morocco" /> Morocco <strong>VS</strong> TBD <img src="https://flagcdn.com/w40/un.png" alt="TBD" />
                </div>
                <span className="m-venue">Grand Stade de Casablanca</span>
              </div>
              <div className="match-item">
                <span className="m-date">GROUP B • JUNE 15, 2030</span>
                <div className="m-teams">
                  <img src="https://flagcdn.com/w40/es.png" alt="Spain" /> Spain <strong>VS</strong> Portugal <img src="https://flagcdn.com/w40/pt.png" alt="Portugal" />
                </div>
                <span className="m-venue">Stade Ibn Batouta, Tangier</span>
              </div>
              <div className="match-item">
                <span className="m-date">QUARTER FINAL • JULY 5, 2030</span>
                <div className="m-teams">
                  <img src="https://flagcdn.com/w40/fr.png" alt="France" /> France <strong>VS</strong> Brazil <img src="https://flagcdn.com/w40/br.png" alt="Brazil" />
                </div>
                <span className="m-venue">Stade Marrakech</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stadium Showcase */}
      <section id="host-stadiums" className="stadiums-section">
        <div className="section-header-v2 centered">
          <span className="st-eyebrow"><Trophy size={14} /> {t.stadiumsTitle.toUpperCase()}</span>
          <h2 className="section-title-v2">{t.stadiumsTitle}</h2>
          <p>{t.stadiumsSub}</p>
        </div>

        <div className="stadium-grid">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="stadium-card stadium-skeleton" />
            ))
          ) : (
            cities.map((city, i) => (
              <article
                key={city.name}
                className={`stadium-card ${activeCity === city.name ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveCity(city.name)}
                onMouseLeave={() => setActiveCity(null)}
              >
                <div
                  className="sc-photo"
                  style={{ backgroundImage: city.photoUrl ? `url(${city.photoUrl})` : undefined }}
                >
                  <span className="sc-num">{String(i + 1).padStart(2, '0')}</span>
                  {city.status && <span className="sc-status">{city.status}</span>}
                </div>
                <div className="sc-body">
                  <div className="sc-meta">
                    <MapPin size={13} /> <span>{city.name}, Morocco</span>
                  </div>
                  <h3>{city.stadium}</h3>
                  <div className="sc-stats">
                    {city.capacity && (
                      <div className="sc-stat">
                        <Users size={14} />
                        <div>
                          <strong>{city.capacity}</strong>
                          <small>Capacity</small>
                        </div>
                      </div>
                    )}
                    {city.temp != null && (
                      <div className="sc-stat">
                        <Zap size={14} />
                        <div>
                          <strong>{Math.round(city.temp)}°C</strong>
                          <small>Today</small>
                        </div>
                      </div>
                    )}
                  </div>
                  {city.features && city.features.length > 0 && (
                    <ul className="sc-features">
                      {city.features.slice(0, 3).map((f, j) => (
                        <li key={j}><Star size={11} /> {f}</li>
                      ))}
                    </ul>
                  )}
                  {city.architect && (
                    <p className="sc-architect"><span>Architect</span> {city.architect}</p>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {/* Soul Section */}
      <section className="soul-kingdom">
        <h2 className="section-title-v2">{t.soulTitle}</h2>
        <div className="soul-grid">
          <div className="soul-card main-card" style={{ backgroundImage: `url('/assets/stadiums/imperial_wonders_fes_1777285825388.png')` }}>
            <div className="soul-card-content">
              <h3>Imperial Wonders</h3>
              <p>Explore the labyrinthine medinas of Fez.</p>
            </div>
          </div>
          <div className="soul-right-col">
            <div className="soul-card sub-card" style={{ backgroundImage: `url('/assets/stadiums/moroccan_culinary_arts_1777285908130.png')` }}>
              <div className="soul-card-content">
                <h3>Culinary Arts</h3>
              </div>
            </div>
            <div className="soul-bottom-row">
              <div className="soul-card mini-card b-blue">
                <div className="soul-card-content"><Zap size={24} /><h3>Al Boraq</h3></div>
              </div>
              <div className="soul-card mini-card" style={{ backgroundImage: `url('https://images.pexels.com/photos/2189696/pexels-photo-2189696.jpeg')` }}>
                <div className="soul-card-content"><Compass size={24} /><h3>Sahara Nights</h3></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Curated Itineraries */}
      <section className="curated-itineraries">
        <div className="itinerary-header">
          <span className="it-tag">AI-POWERED PLANNERS</span>
          <h2>{t.itinerariesTitle}</h2>
          <p>Our AI engines analyzed your team preferences and travel style to build the perfect 2030 experience.</p>
        </div>

        <div className="itinerary-grid">
          {[
            {
              title: "The Ultimate Fan",
              desc: "Match-day adrenaline at the Grand Stade Casablanca. Stadium tours, fan-zone VIP access, premium suites.",
              price: "$2,450",
              days: 7,
              features: ["All Category 1 Match Tickets", "5-Star Stadium Hotels", "Exclusive Fan Zone VIP"],
              btnColor: "#be123c",
              type: "fan",
              city: "Casablanca",
              lat: 33.5731,
              lon: -7.5898,
              travelers: "group",
              budget: { total: 2450, currency: "USD" },
              style: "comfort",
              interests: ["Nightlife \uD83D\uDC83", "Architecture \uD83C\uDFD7\uFE0F", "Shopping \uD83D\uDECD\uFE0F"],
              cta: "Plan Fan Trip"
            },
            {
              title: "Culture + Football",
              desc: "Balance match-day energy with 10 days exploring Imperial cities, Berber medinas and the Atlas.",
              price: "$1,890",
              days: 10,
              features: ["2x Category 2 Match Tickets", "Atlas Mountain Retreat", "Gourmet Food Tour"],
              btnColor: "#1e3a8a",
              popular: true,
              type: "culture",
              city: "Fez",
              lat: 34.0331,
              lon: -5.0003,
              travelers: "couple",
              budget: { total: 1890, currency: "USD" },
              style: "balanced",
              interests: ["Culture \uD83C\uDFDB\uFE0F", "Gastronomy \uD83C\uDF72", "Architecture \uD83C\uDFD7\uFE0F", "Nature \uD83C\uDF32"],
              cta: "Plan Culture Trip"
            },
            {
              title: "Coastal Explorer",
              desc: "Matches in Casablanca and Tangier combined with northern beach vibes, surfing, and yacht days.",
              price: "$2,100",
              days: 9,
              features: ["Matches in Casablanca & Tangier", "Private Yacht Day Trip", "Surf Lessons in Taghazout"],
              btnColor: "#0ea5e9",
              type: "coastal",
              city: "Tangier",
              lat: 35.7595,
              lon: -5.8340,
              travelers: "couple",
              budget: { total: 2100, currency: "USD" },
              style: "comfort",
              interests: ["Beach \uD83C\uDFD6\uFE0F", "Adventure \uD83E\uDDD7", "Gastronomy \uD83C\uDF72"],
              cta: "Plan Coastal Trip"
            }
          ].map((it, i) => (
            <div key={i} className={`itinerary-card-ref ${it.popular ? 'popular' : ''}`}>
              {it.popular && <span className="local-badge">LOCAL FAVORITE</span>}
              <div className="it-card-top">
                <h3>{it.title}</h3>
                <p className="it-desc">{it.desc}</p>
                <div className="it-meta-row">
                  <span><MapPin size={12} /> {it.city}</span>
                  <span><Clock size={12} /> {it.days} days</span>
                </div>
              </div>
              <div className="it-features">
                {it.features.map((f, j) => (
                  <div key={j} className="it-feat-item">
                    <Star size={14} className="feat-icon" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="it-card-bottom">
                <div className="it-price-row">
                  <span>starting at</span>
                  <strong>{it.price}</strong>
                </div>
                <button
                  className="btn-it-ref"
                  style={{ background: it.btnColor, color: 'white' }}
                  onClick={() => applyTemplate(it)}
                >
                  {it.cta} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fan Rooms */}
      <section className="fan-rooms-v2">
        <div className="fr-glow" aria-hidden />
        <div className="fr-grid">
          <div className="fr-content">
            <span className="fr-eyebrow"><MessageCircle size={14} /> COMMUNITY</span>
            <h2>Join the Fan Rooms</h2>
            <p>Connect with thousands of travelers heading to Morocco 2030. Coordinate match-day meetups, split hotel bookings, share insider tips, and ride together to stadiums.</p>

            <div className="fr-stats">
              <div className="fr-stat">
                <Users size={18} />
                <div>
                  <strong>1,247</strong>
                  <small>Active fans</small>
                </div>
              </div>
              <div className="fr-stat">
                <MessageCircle size={18} />
                <div>
                  <strong>32</strong>
                  <small>Live rooms</small>
                </div>
              </div>
              <div className="fr-stat">
                <Calendar size={18} />
                <div>
                  <strong>89</strong>
                  <small>Match meetups</small>
                </div>
              </div>
            </div>

            <button className="fr-cta" onClick={() => navigate('/community')}>
              Join Community <ArrowRight size={18} />
            </button>
          </div>

          <div className="fr-rooms">
            {[
              { name: 'Casablanca · Match Night', members: 412, flag: 'ma', color: '#be123c' },
              { name: 'Spain Fans · Group B', members: 187, flag: 'es', color: '#eab308' },
              { name: 'Atlas Trail Hikers', members: 96, flag: 'ma', color: '#10b981' },
              { name: 'Foodies of Marrakech', members: 254, flag: 'ma', color: '#f97316' }
            ].map((room) => (
              <div key={room.name} className="fr-room-card">
                <div className="fr-room-flag" style={{ background: room.color }}>
                  <img src={`https://flagcdn.com/w40/${room.flag}.png`} alt="" />
                </div>
                <div className="fr-room-info">
                  <h4>{room.name}</h4>
                  <span><Users size={11} /> {room.members} members · live now</span>
                </div>
                <span className="fr-live-dot" aria-hidden />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default WorldCup;
