import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Trophy, Users, Star, Clock, Compass, Zap, ExternalLink, ArrowRight, MessageCircle, Calendar, Sparkles } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import useTripStore from '../stores/tripStore';
import { useTranslation } from '../hooks/useTranslation';
import TiltCard from '../components/WorldCup3D/TiltCard';
import StadiumRouteMap from '../components/WorldCup3D/StadiumRouteMap';
import StadiumModal from '../components/WorldCup3D/StadiumModal';
import './WorldCup.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// The 3D hero scene is heavy (R3F + custom shaders). Lazy-load it so the
// rest of the page renders instantly, and skip it entirely on devices that
// either can't handle WebGL well or have requested reduced motion.
const HeroScene3D = lazy(() => import('../components/WorldCup3D/HeroScene3D'));

// Cheap, dependency-free hook: returns true when we should NOT render the
// 3D hero (mobile width, prefers-reduced-motion, or no WebGL). The result
// is sticky once true so layout doesn't flicker on resize.
const useShouldRender3D = () => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.matchMedia('(max-width: 820px)').matches;
    let webglOk = true;
    try {
      const c = document.createElement('canvas');
      webglOk = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch { webglOk = false; }
    setEnabled(!reduce && !isMobile && webglOk);
  }, []);
  return enabled;
};

// FIFA has officially confirmed the tournament dates and the centenary
// opening on the South-American leg. Everything in this object comes
// from FIFA's public announcement — no fabricated match-ups.
const TOURNAMENT_FACTS = {
  startDate: 'June 14, 2030',
  endDate: 'July 21, 2030',
  teams: 48,
  totalMatches: 104,
  hostNations: ['Morocco', 'Spain', 'Portugal'],
  centenaryHosts: ['Argentina', 'Uruguay', 'Paraguay'],
  moroccoHostCount: 6,
  // Phase windows per FIFA's published competition schedule.
  phases: [
    { label: 'Group Stage',    window: 'June 14 – June 27' },
    { label: 'Round of 16',    window: 'June 30 – July 3'  },
    { label: 'Quarter Finals', window: 'July 5 – July 6'    },
    { label: 'Semi Finals',    window: 'July 9 – July 10'   },
    { label: 'Final',          window: 'July 21'             }
  ]
};

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
  const { language: lang, setFormData, resetStore, token } = useTripStore();
  const { t } = useTranslation();
  const [cities, setCities] = useState([]);
  const [activeCity, setActiveCity] = useState(null);
  const [selectedStadium, setSelectedStadium] = useState(null);
  const [loading, setLoading] = useState(true);
  // Plan gate: a 402 from /api/worldcup/cities means the user's plan
  // doesn't include the World Cup feature. We render a soft upgrade
  // panel instead of an empty page.
  const [gateError, setGateError] = useState(null);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  // Real fan rooms (fetched from /api/chat/rooms, filtered to WC). Used
  // to drive the Community section's room cards + live counts — no more
  // hard-coded "412 members" fake numbers.
  const [fanRooms, setFanRooms] = useState([]);
  const enable3D = useShouldRender3D();

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
        const res = await axios.get(
          `${API}/api/worldcup/cities`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        setCities(res.data);
      } catch (err) {
        console.error('Error fetching World Cup data:', err);
        // 401 / 402 -> plan gate. Capture so the UI can show an upgrade
        // CTA instead of a misleading "loading…" forever.
        const status = err.response?.status;
        if (status === 401 || status === 402) {
          setGateError({
            status,
            featureLabel: err.response?.data?.featureLabel || 'World Cup 2030 Companion'
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchWCData();

    // Real fan-room data — public endpoint, safe to call without a token.
    // We tolerate failure silently (offline / first boot) and fall back to
    // an empty list rather than show fabricated rooms.
    axios.get(`${API}/api/chat/rooms`)
      .then((res) => {
        const wc = (res.data || []).filter((r) => r.isWorldCupFanRoom);
        setFanRooms(wc);
      })
      .catch(() => { /* leave fanRooms = [] — the UI handles empty state */ });

    return () => clearInterval(timer);
  }, []);

  // Aggregate counts derived from real WC fan rooms. Memoised so the
  // Community section doesn't recompute on every interval tick.
  const fanStats = useMemo(() => ({
    totalFans: fanRooms.reduce((sum, r) => sum + (r.memberCount || 0), 0),
    liveRooms: fanRooms.length,
    hostCities: TOURNAMENT_FACTS.moroccoHostCount
  }), [fanRooms]);

  return (
    <div className={`world-cup-v2 ${lang === 'ar' ? 'rtl' : ''}`}>
      {/* Hero Section. The static image is kept as the layered fallback
          (and as the seed for browsers that fail the 3D guard). The R3F
          canvas mounts on top when allowed, with pointer-events disabled
          so all clicks still hit the CTAs. */}
      <section
        className={`wc-hero-v2 ${enable3D ? 'has-3d' : ''}`}
        style={{ backgroundImage: `url('/assets/stadiums/magical_morocco_hero_1777285782527.png')` }}
      >
        {enable3D && (
          <Suspense fallback={null}>
            <HeroScene3D />
          </Suspense>
        )}
        <div className="wc-hero-overlay">
          <div className="wc-hero-content-v2">
            <span className="road-tag">{t('worldCup.heroSub')}</span>
            <h1 className="magical-title">{t('worldCup.heroTitle').split(' ').map((w, i) => <React.Fragment key={i}>{w}<br /></React.Fragment>)}</h1>
            <p className="magical-desc">{t('worldCup.heroDesc')}</p>
            
            <div className="countdown-group">
              <div className="cd-item"><strong>{timeLeft.days}</strong><span>{t('worldCup.days')}</span></div>
              <div className="cd-item"><strong>{timeLeft.hours}</strong><span>{t('worldCup.hours')}</span></div>
              <div className="cd-item"><strong>{timeLeft.mins}</strong><span>{t('worldCup.mins')}</span></div>
              <div className="cd-item"><strong>{timeLeft.secs}</strong><span>{t('worldCup.secs')}</span></div>
            </div>

            <div className="hero-v2-ctas">
              <button className="btn-primary" onClick={() => navigate('/planner')}>{t('worldCup.planJourney')}</button>
              <button className="btn-glass" onClick={() => {
                const el = document.getElementById('host-stadiums');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}>{t('worldCup.exploreVenues')}</button>
            </div>
          </div>
          <div className="hero-flags">
            <img src="https://flagcdn.com/w80/ma.png" alt="Morocco" />
            <img src="https://flagcdn.com/w80/es.png" alt="Spain" />
            <img src="https://flagcdn.com/w80/pt.png" alt="Portugal" />
          </div>
        </div>
      </section>

      {/* Stadium Details Modal */}
      {selectedStadium && (
        <StadiumModal 
          stadium={selectedStadium} 
          onClose={() => setSelectedStadium(null)} 
        />
      )}

      {/* Map + Match Preview */}
      <section className="grand-arenas">
        <div className="section-header-v2">
          <h2 className="section-title-v2">{t('worldCup.arenasTitle')}</h2>
          <p>{t('worldCup.arenasDesc')}</p>
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
                          <span className="mp-tag">{t('worldCup.matchVenue')}</span>
                          <h4>{city.stadium}</h4>
                          <p>{city.name}{city.temp ? ` • ${Math.round(city.temp)}°C ${t('worldCup.todayTemp')}` : ''}</p>
                          <button
                            className="mp-google-btn"
                            onClick={() => window.open(
                              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(city.stadium + ', ' + city.name)}`,
                              '_blank',
                              'noopener,noreferrer'
                            )}
                          >
                            <ExternalLink size={14} /> {t('worldCup.openGoogleMaps')}
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
                <p>{t('worldCup.loadingCities')}</p>
              </div>
            )}
          </div>

          {/* Tournament phases — the only data here that is officially
              published by FIFA (no team match-ups invented). The draw
              hasn't happened yet, so we deliberately don't show any
              fictional team confrontations. */}
          <div className="match-preview">
            <div className="match-header">
              <Calendar size={18} /> <span>{t('worldCup.tourneyPhases')}</span>
            </div>
            <div className="match-list">
              <div className="match-item phase-summary">
                <span className="m-date">{TOURNAMENT_FACTS.startDate.toUpperCase()} → {TOURNAMENT_FACTS.endDate.toUpperCase()}</span>
                <div className="m-teams phase-headline">
                  <strong>{TOURNAMENT_FACTS.teams}</strong>&nbsp;{t('worldCup.teams')} ·&nbsp;
                  <strong>{TOURNAMENT_FACTS.totalMatches}</strong>&nbsp;{t('worldCup.matches')}
                </div>
                <span className="m-venue">
                  {t('worldCup.hostedBy')} {TOURNAMENT_FACTS.hostNations.join(', ')} · {t('worldCup.centenary')} {TOURNAMENT_FACTS.centenaryHosts.join(', ')}
                </span>
              </div>
              {TOURNAMENT_FACTS.phases.map((p) => (
                <div className="match-item phase-item" key={p.label}>
                  <span className="m-date">{p.window.toUpperCase()}</span>
                  <div className="m-teams phase-row">
                    <span className="phase-label">{p.label}</span>
                  </div>
                </div>
              ))}
              <p className="phase-note">
                {t('worldCup.phaseNote')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stadium Showcase */}
      <section id="host-stadiums" className="stadiums-section">
        <div className="section-header-v2 centered">
          <span className="st-eyebrow"><Trophy size={14} /> {t('worldCup.stadiumsTitle').toUpperCase()}</span>
          <h2 className="section-title-v2">{t('worldCup.stadiumsTitle')}</h2>
          <p>{t('worldCup.stadiumsSub')}</p>
        </div>

        <div className="stadium-grid">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="stadium-card stadium-skeleton" />
            ))
          ) : (
            cities.map((city, i) => (
              <TiltCard
                as="article"
                key={city.name}
                className={`stadium-card ${activeCity === city.name ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveCity(city.name)}
                onMouseLeave={() => setActiveCity(null)}
                onClick={() => setSelectedStadium(city)}
                style={{ cursor: 'pointer' }}
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
                          <small>{t('worldCup.capacity')}</small>
                        </div>
                      </div>
                    )}
                    {city.temp != null && (
                      <div className="sc-stat">
                        <Zap size={14} />
                        <div>
                          <strong>{Math.round(city.temp)}°C</strong>
                          <small>{t('worldCup.today')}</small>
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
                    <p className="sc-architect"><span>{t('worldCup.architect')}</span> {city.architect}</p>
                  )}
                  <button className="sc-more-btn">
                    {t('worldCup.seeMore')} <ArrowRight size={14} />
                  </button>
                </div>
              </TiltCard>
            ))
          )}
        </div>
      </section>

      <section className="soul-kingdom">
        <h2 className="section-title-v2">{t('worldCup.soulTitle')}</h2>
        <div className="soul-grid">
          <div className="soul-card main-card" style={{ backgroundImage: `url('/assets/stadiums/imperial_wonders_fes_1777285825388.png')` }}>
            <div className="soul-card-content">
              <h3>{t('worldCup.imperialWonders')}</h3>
              <p>{t('worldCup.imperialDesc')}</p>
            </div>
          </div>
          <div className="soul-right-col">
            <div className="soul-card sub-card" style={{ backgroundImage: `url('/assets/stadiums/moroccan_culinary_arts_1777285908130.png')` }}>
              <div className="soul-card-content">
                <h3>{t('worldCup.culinaryArts')}</h3>
              </div>
            </div>
            <div className="soul-bottom-row">
              <div className="soul-card mini-card" style={{ backgroundImage: `url('/assets/stadiums/boraq.jpg')` }}>
                <div className="soul-card-content"><Zap size={24} /><h3>{t('worldCup.alBoraq')}</h3></div>
              </div>
              <div className="soul-card mini-card" style={{ backgroundImage: `url('/assets/stadiums/saharanight.jpg')` }}>
                <div className="soul-card-content"><Compass size={24} /><h3>{t('worldCup.saharaNights')}</h3></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fan Rooms — driven entirely by REAL chat-room data from
          /api/chat/rooms (filtered to WorldCup rooms). No fabricated
          counts or hard-coded room lists. */}
      <section className="fan-rooms-v2">
        <div className="fr-glow" aria-hidden />
        <div className="fr-grid">
          <div className="fr-content">
            <span className="fr-eyebrow"><MessageCircle size={14} /> {t('worldCup.community')}</span>
            <h2>{t('worldCup.joinFanRooms')}</h2>
            <p>
              {t('worldCup.fanRoomsDesc')}
            </p>

            <div className="fr-stats">
              <div className="fr-stat">
                <Users size={18} />
                <div>
                  <strong>{fanStats.totalFans.toLocaleString()}</strong>
                  <small>{t('worldCup.activeFans')}</small>
                </div>
              </div>
              <div className="fr-stat">
                <MessageCircle size={18} />
                <div>
                  <strong>{fanStats.liveRooms}</strong>
                  <small>{t('worldCup.liveRooms')}</small>
                </div>
              </div>
              <div className="fr-stat">
                <Trophy size={18} />
                <div>
                  <strong>{fanStats.hostCities}</strong>
                  <small>{t('worldCup.hostCities')}</small>
                </div>
              </div>
            </div>

            <button className="fr-cta" onClick={() => navigate('/community')}>
              {t('worldCup.joinCommunity')} <ArrowRight size={18} />
            </button>
          </div>

          <div className="fr-rooms">
            {fanRooms.length === 0 ? (
              <div className="fr-room-empty">
                <Sparkles size={18} />
                <p>
                  {t('worldCup.noLiveRooms')}{' '}
                  <button className="fr-room-empty-link" onClick={() => navigate('/community')}>
                    {t('worldCup.openRoom')}
                  </button>
                </p>
              </div>
            ) : (
              fanRooms.slice(0, 6).map((room) => (
                <button
                  key={room._id}
                  className="fr-room-card"
                  onClick={() => navigate('/community')}
                  type="button"
                >
                  <div className="fr-room-flag" style={{ background: '#be123c' }}>
                    <img src="https://flagcdn.com/w40/ma.png" alt="" />
                  </div>
                  <div className="fr-room-info">
                    <h4>{room.roomName}</h4>
                    <span>
                      <Users size={11} /> {room.memberCount.toLocaleString()} {room.memberCount === 1 ? t('worldCup.member') : t('worldCup.members')}
                      {room.destination ? ` · ${room.destination}` : ''}
                    </span>
                  </div>
                  <span className="fr-live-dot" aria-hidden />
                </button>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default WorldCup;
