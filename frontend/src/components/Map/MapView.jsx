import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

// Build a numbered DivIcon (1, 2, 3...) for each activity
const makeNumberedIcon = (number, isActive = false) => {
  const className = `numbered-marker ${isActive ? 'active' : ''}`;
  return L.divIcon({
    className: 'numbered-marker-wrap',
    html: `
      <div class="${className}">
        <div class="num-pin">
          <span class="num-label">${number}</span>
        </div>
        <div class="num-shadow"></div>
      </div>
    `,
    iconSize: [40, 50],
    iconAnchor: [20, 48],
    popupAnchor: [0, -44]
  });
};

// Auto-fit bounds when activities change
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [points, map]);
  return null;
}

const PEXELS_KEY = import.meta.env.VITE_PEXELS_KEY; // Optional - set via .env

// Cache photos so we don't re-fetch on every popup open
const photoCache = new Map();

const fetchPlacePhoto = async (query) => {
  if (photoCache.has(query)) return photoCache.get(query);
  // Wikipedia REST first (free, no key)
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.thumbnail?.source) {
        const url = data.thumbnail.source.replace(/\/\d+px-/, '/640px-');
        photoCache.set(query, url);
        return url;
      }
    }
  } catch {/* ignore */}

  // Pexels fallback
  if (PEXELS_KEY) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`,
        { headers: { Authorization: PEXELS_KEY } }
      );
      const data = await res.json();
      const url = data.photos?.[0]?.src?.medium;
      if (url) {
        photoCache.set(query, url);
        return url;
      }
    } catch {/* ignore */}
  }

  photoCache.set(query, null);
  return null;
};

// Lazy-loaded popup body that fetches a photo on open
const PlacePopup = ({ activity, currency }) => {
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPlacePhoto(activity.name).then((url) => {
      if (!cancelled) {
        setPhoto(url);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [activity.name]);

  const openInGoogleMaps = () => {
    const q = encodeURIComponent(activity.name);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=&center=${activity.lat},${activity.lon}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="place-popup">
      <div className="pp-img-wrap">
        {loading ? (
          <div className="pp-img-skeleton" />
        ) : photo ? (
          <img src={photo} alt={activity.name} loading="lazy" />
        ) : (
          <div className="pp-img-fallback">
            <span>📍</span>
          </div>
        )}
      </div>
      <div className="pp-body">
        {activity.category && <span className="pp-cat">{activity.category}</span>}
        <h4>{activity.name}</h4>
        {activity.description && <p>{activity.description}</p>}
        <div className="pp-meta">
          {typeof activity.cost === 'number' && activity.cost > 0 && (
            <span className="pp-cost">{currency || 'USD'} {activity.cost}</span>
          )}
          {activity.duration && <span className="pp-duration">⏱ {activity.duration}</span>}
        </div>
        <button className="pp-google-btn" onClick={openInGoogleMaps}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          Open in Google Maps
        </button>
      </div>
    </div>
  );
};

const MapView = ({ destination, activities = [], currency = 'USD', activeIndex = -1, onMarkerClick }) => {
  const lat = destination?.lat || 31.7917;
  const lon = destination?.lon || -7.0926;
  const center = [lat, lon];

  // Detect light mode for tile selection
  const [isLight, setIsLight] = useState(() => document.body.classList.contains('light-mode'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLight(document.body.classList.contains('light-mode'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Filter activities with valid coords
  const validActivities = useMemo(
    () => activities.filter((a) => typeof a?.lat === 'number' && typeof a?.lon === 'number'),
    [activities]
  );

  const points = useMemo(() => validActivities.map((a) => [a.lat, a.lon]), [validActivities]);

  if (!lat || !lon) return <div className="map-placeholder">Loading Map…</div>;

  const tileUrl = isLight
    ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  return (
    <div className="map-view-container" style={{ width: '100%', height: '100%' }}>
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={tileUrl}
        />

        <FitBounds points={points} />

        {/* Route polyline connecting activities in order */}
        {points.length >= 2 && (
          <Polyline
            positions={points}
            pathOptions={{
              color: '#eab308',
              weight: 3,
              opacity: 0.7,
              dashArray: '8 6',
              lineCap: 'round'
            }}
          />
        )}

        {validActivities.map((activity, index) => (
          <Marker
            key={`${activity.name}-${index}`}
            position={[activity.lat, activity.lon]}
            icon={makeNumberedIcon(index + 1, index === activeIndex)}
            eventHandlers={{
              click: () => onMarkerClick && onMarkerClick(index)
            }}
          >
            <Popup minWidth={260} maxWidth={300} className="place-popup-wrap">
              <PlacePopup activity={activity} currency={currency} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;

