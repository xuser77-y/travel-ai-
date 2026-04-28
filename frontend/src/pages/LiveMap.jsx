import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  Send, MapPin, Sparkles, AlertTriangle, Users, Utensils,
  Bus, CloudSun, Shield, ThumbsUp, Filter, Crosshair, RefreshCw, X, Navigation, Trash2, Clock
} from 'lucide-react';
import useTripStore from '../stores/tripStore';
import { useToast } from '../components/UI/Toast';
import { useConfirm } from '../components/UI/ConfirmDialog';
import './LiveMap.css';

const API = 'http://localhost:5000/api/livemap';
const SOCKET_URL = 'http://localhost:5000';

const TYPES = [
  { id: 'positive', label: 'Positive', icon: ThumbsUp, color: '#10b981' },
  { id: 'food', label: 'Food', icon: Utensils, color: '#10b981' },
  { id: 'weather', label: 'Weather', icon: CloudSun, color: '#eab308' },
  { id: 'transport', label: 'Transport', icon: Bus, color: '#eab308' },
  { id: 'warning', label: 'Warning', icon: AlertTriangle, color: '#eab308' },
  { id: 'crowd', label: 'Crowd', icon: Users, color: '#ef4444' },
  { id: 'safety', label: 'Safety', icon: Shield, color: '#ef4444' }
];

const sentimentColor = (s) =>
  s === 'positive' ? '#10b981' : s === 'negative' ? '#ef4444' : '#eab308';

const ageHours = (createdAt) => (Date.now() - new Date(createdAt).getTime()) / 3.6e6;
const fadeOpacity = (createdAt) => Math.max(0.35, 1 - ageHours(createdAt) / 6);

// Build a colored, divIcon marker
const makeIcon = (color, opacity = 1, pulse = false) =>
  L.divIcon({
    className: 'livemap-pin',
    html: `<span class="pin-core ${pulse ? 'pulse' : ''}" style="--pin:${color};opacity:${opacity}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

function FlyToUser({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 13, { duration: 0.8 });
  }, [position]);
  return null;
}

function ClickToReport({ onPick, getCooldown }) {
  useMapEvents({
    click(e) {
      // Ignore stray map clicks fired right after the user clicked
      // "Remove" inside a popup (the popup unmounts mid-click and the
      // event can leak to the map container).
      if (getCooldown && Date.now() - getCooldown() < 350) return;
      onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    }
  });
  return null;
}

// Ref callback that prevents clicks/scrolls inside an element from
// propagating to the underlying Leaflet map. Use on popup contents so
// buttons inside don't accidentally drop a new pin on the map.
const stopMapEvents = (el) => {
  if (!el) return;
  L.DomEvent.disableClickPropagation(el);
  L.DomEvent.disableScrollPropagation(el);
};

function ThemedTileLayer() {
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

// Stable per-browser identity used to prove ownership of LiveMap posts when
// the user isn't logged in. We store a UUID once and keep reusing it.
const guestAuthorId = (() => {
  let id = localStorage.getItem('livemap_guest_id');
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'g-' + Math.random().toString(36).slice(2) + '-' + Date.now();
    localStorage.setItem('livemap_guest_id', id);
  }
  return id;
})();

const LiveMap = () => {
  const { user, language } = useTripStore();
  const toast = useToast();
  const confirm = useConfirm();
  const myAuthorId = user?._id || user?.id || guestAuthorId;
  const [posts, setPosts] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [userPos, setUserPos] = useState(null);
  const [pickedPos, setPickedPos] = useState(null);
  const [draftType, setDraftType] = useState('crowd');
  const [draftMsg, setDraftMsg] = useState('');
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeArea, setActiveArea] = useState(null);
  const socketRef = useRef(null);
  // Timestamp of the last "Remove picked location" action; used to
  // suppress map.click that immediately follows the popup unmount.
  const removeCooldownRef = useRef(0);

  const t = {
    en: { title: 'Live Travel Pulse', subtitle: 'Real-time intelligence from travelers around you.',
      report: 'Report something', message: 'What is happening?', share: 'Share', filter: 'Filter',
      all: 'All reports', recenter: 'My location', refresh: 'Refresh',
      summary: 'AI area summary', noActivity: 'Tap on the map or a marker to analyze the area.',
      action_visit: 'Good time to visit', action_avoid: 'Avoid this area',
      action_alternative: 'Take an alternative route', action_monitor: 'Monitor for updates',
      live: 'LIVE', clusters: 'Active zones', pickedHint: 'Selected location',
      clearPick: 'Clear selected location', useMyLocation: 'Use my location',
      remove: 'Remove', myPosts: 'My recent posts', noMyPosts: 'You haven\u2019t shared anything yet.',
      confirmDelete: 'Delete this post?' },
    fr: { title: 'Pouls Voyage en Direct', subtitle: 'Intelligence en temps réel des voyageurs autour de vous.',
      report: 'Signaler', message: 'Que se passe-t-il ?', share: 'Partager', filter: 'Filtrer',
      all: 'Tous', recenter: 'Ma position', refresh: 'Actualiser',
      summary: 'Résumé IA de la zone', noActivity: 'Cliquez sur la carte ou un marqueur pour analyser.',
      action_visit: 'Bon moment pour visiter', action_avoid: 'Évitez cette zone',
      action_alternative: 'Prenez un autre itinéraire', action_monitor: 'Surveillez',
      live: 'EN DIRECT', clusters: 'Zones actives', pickedHint: 'Lieu sélectionné',
      clearPick: 'Effacer le lieu sélectionné', useMyLocation: 'Utiliser ma position',
      remove: 'Retirer', myPosts: 'Mes derniers posts', noMyPosts: 'Vous n\u2019avez encore rien partagé.',
      confirmDelete: 'Supprimer ce post\u00a0?' },
    ar: { title: 'نبض السفر الحي', subtitle: 'معلومات فورية من المسافرين من حولك.',
      report: 'الإبلاغ', message: 'ماذا يحدث؟', share: 'مشاركة', filter: 'تصفية',
      all: 'الكل', recenter: 'موقعي', refresh: 'تحديث',
      summary: 'ملخص الذكاء الاصطناعي', noActivity: 'انقر على الخريطة أو علامة للتحليل.',
      action_visit: 'وقت جيد للزيارة', action_avoid: 'تجنب هذه المنطقة',
      action_alternative: 'اسلك طريقاً بديلاً', action_monitor: 'راقب التحديثات',
      clearPick: 'مسح الموقع المحدد', useMyLocation: 'استخدم موقعي',
      remove: 'إزالة', myPosts: 'منشوراتي الأخيرة', noMyPosts: 'لم تشارك شيئًا بعد.',
      confirmDelete: 'حذف هذا المنشور؟',
      live: 'مباشر', clusters: 'المناطق النشطة', pickedHint: 'الموقع المحدد' }
  }[language] || {};

  // Initial fetch + socket
  const fetchAll = async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        axios.get(`${API}/posts`),
        axios.get(`${API}/clusters`)
      ]);
      setPosts(pRes.data.posts || []);
      setClusters(cRes.data.clusters || []);
      // Auto-seed if empty
      if ((pRes.data.posts || []).length === 0) {
        await axios.post(`${API}/seed`).catch(() => {});
        const after = await axios.get(`${API}/posts`);
        setPosts(after.data.posts || []);
      }
    } catch (err) {
      console.error('LiveMap fetch error:', err);
    }
  };

  useEffect(() => {
    fetchAll();

    socketRef.current = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current.on('livemap:new_post', (post) => {
      setPosts((prev) => [post, ...prev]);
    });
    socketRef.current.on('livemap:delete_post', ({ _id }) => {
      setPosts((prev) => prev.filter((p) => p._id !== _id));
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
        () => setUserPos([33.5731, -7.5898]) // fallback Casablanca
      );
    } else {
      setUserPos([33.5731, -7.5898]);
    }

    return () => socketRef.current?.disconnect();
  }, []);

  // Re-fade markers every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    if (filterType === 'all') return posts;
    return posts.filter((p) => p.type === filterType);
  }, [posts, filterType]);

  // Posts authored by this device/user (matched by stable authorId)
  const myPosts = useMemo(() => {
    if (!myAuthorId) return [];
    return posts
      .filter((p) => p.authorId && String(p.authorId) === String(myAuthorId))
      .slice(0, 8);
  }, [posts, myAuthorId]);

  // Compact "x min/h ago" formatter for the panel
  const timeAgo = (iso) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h`;
  };

  const submitPost = async (e) => {
    e?.preventDefault?.();
    if (!draftMsg.trim() || posting) return;
    const loc = pickedPos || (userPos ? { lat: userPos[0], lon: userPos[1] } : null);
    if (!loc) return;
    setPosting(true);
    try {
      const res = await axios.post(`${API}/posts`, {
        type: draftType,
        message: draftMsg.trim(),
        location: loc,
        author: user?.name || 'Anonymous Traveler',
        authorId: myAuthorId
      });
      // Optimistic add (socket will also push)
      setPosts((prev) => [res.data, ...prev.filter((p) => p._id !== res.data._id)]);
      setDraftMsg('');
      setPickedPos(null);
    } catch (err) {
      console.error('Post failed:', err);
    } finally {
      setPosting(false);
    }
  };

  const deletePost = async (id) => {
    if (!id || deletingId) return;
    const ok = await confirm({
      title: t.confirmDelete || 'Delete this post?',
      message: 'It will disappear from the live feed for everyone.',
      confirmLabel: t.remove || 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });
    if (!ok) return;
    setDeletingId(id);
    // Optimistic remove
    const snapshot = posts;
    setPosts((prev) => prev.filter((p) => p._id !== id));
    try {
      await axios.delete(`${API}/posts/${id}`, {
        data: { authorId: myAuthorId }
      });
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error(err.response?.data?.error || 'Could not delete post.');
      setPosts(snapshot); // Revert on failure
    } finally {
      setDeletingId(null);
    }
  };

  const analyzeArea = async (lat, lon, radiusKm = 1) => {
    setAiLoading(true);
    setActiveArea({ lat, lon, radiusKm });
    try {
      const res = await axios.post(`${API}/summary`, { location: { lat, lon }, radiusKm });
      setAiSummary(res.data);
    } catch (err) {
      setAiSummary({ summary: 'Unable to analyze area right now.', action: 'monitor' });
    } finally {
      setAiLoading(false);
    }
  };

  const center = userPos || [31.7917, -7.0926];

  // Clear the manually picked location and revert to live location.
  // Optionally re-request geolocation if we don't have it yet.
  const useMyLocation = () => {
    setPickedPos(null);
    // Block the next ~350ms of map clicks so the same physical click
    // that triggered the Remove button can't drop a new pin.
    removeCooldownRef.current = Date.now();
    if (!userPos && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
        () => setUserPos([33.5731, -7.5898])
      );
    }
  };

  return (
    <div className={`livemap-page ${language === 'ar' ? 'rtl' : ''}`}>
      <header className="lm-header">
        <div className="lm-title-row">
          <span className="live-pill"><span className="live-dot" /> {t.live}</span>
          <h1>{t.title}</h1>
        </div>
        <p className="lm-sub">{t.subtitle}</p>
      </header>

      <div className="lm-layout">
        {/* Sidebar */}
        <aside className="lm-sidebar">
          <div className="lm-card">
            <div className="card-head"><Filter size={16} /> <span>{t.filter}</span></div>
            <div className="filter-pills">
              <button
                className={`fpill ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >{t.all} <span className="count">{posts.length}</span></button>
              {TYPES.map((tp) => {
                const Icon = tp.icon;
                const count = posts.filter((p) => p.type === tp.id).length;
                return (
                  <button
                    key={tp.id}
                    className={`fpill ${filterType === tp.id ? 'active' : ''}`}
                    style={{ '--accent': tp.color }}
                    onClick={() => setFilterType(tp.id)}
                  >
                    <Icon size={14} /> {tp.label} <span className="count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lm-card">
            <div className="card-head"><MapPin size={16} /> <span>{t.report}</span></div>
            <form className="report-form" onSubmit={submitPost}>
              <div className="type-grid">
                {TYPES.map((tp) => {
                  const Icon = tp.icon;
                  return (
                    <button
                      type="button"
                      key={tp.id}
                      className={`type-btn ${draftType === tp.id ? 'active' : ''}`}
                      style={{ '--accent': tp.color }}
                      onClick={() => setDraftType(tp.id)}
                      aria-label={tp.label}
                    >
                      <Icon size={16} />
                      <span>{tp.label}</span>
                    </button>
                  );
                })}
              </div>
              <textarea
                placeholder={t.message}
                value={draftMsg}
                onChange={(e) => setDraftMsg(e.target.value.slice(0, 280))}
                maxLength={280}
                rows={3}
              />
              <div className="form-foot">
                {pickedPos ? (
                  <span className="hint pick-chip">
                    <MapPin size={12} />
                    {t.pickedHint}: {pickedPos.lat.toFixed(3)}, {pickedPos.lon.toFixed(3)}
                    <button
                      type="button"
                      className="pick-clear"
                      onClick={useMyLocation}
                      aria-label={t.clearPick}
                      title={t.useMyLocation}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ) : (
                  <span className="hint">
                    {userPos ? `📍 ${t.useMyLocation}` : 'Tap map to pick a location'}
                  </span>
                )}
                <button
                  type="submit"
                  className="btn-share"
                  disabled={!draftMsg.trim() || posting}
                >
                  <Send size={14} /> {posting ? '…' : t.share}
                </button>
              </div>
            </form>
          </div>

          <div className="lm-card">
            <div className="card-head"><Sparkles size={16} /> <span>{t.summary}</span></div>
            {aiLoading ? (
              <div className="ai-loading">
                <div className="spinner-sm" />
                <span>Analyzing area…</span>
              </div>
            ) : aiSummary ? (
              <div className={`ai-result action-${aiSummary.action}`}>
                <p className="ai-text">{aiSummary.summary}</p>
                <span className="ai-action">
                  {aiSummary.action === 'visit' && `✅ ${t.action_visit}`}
                  {aiSummary.action === 'avoid' && `⛔ ${t.action_avoid}`}
                  {aiSummary.action === 'alternative' && `↪️ ${t.action_alternative}`}
                  {aiSummary.action === 'monitor' && `👀 ${t.action_monitor}`}
                </span>
              </div>
            ) : (
              <p className="muted-hint">{t.noActivity}</p>
            )}
          </div>

          <div className="lm-card my-posts-card">
            <div className="card-head">
              <Users size={16} /> <span>{t.myPosts}</span>
              {myPosts.length > 0 && <span className="card-count">{myPosts.length}</span>}
            </div>
            {myPosts.length === 0 ? (
              <p className="muted-hint">{t.noMyPosts}</p>
            ) : (
              <ul className="my-posts-list">
                {myPosts.map((p) => {
                  const tp = TYPES.find((tt) => tt.id === p.type);
                  const Icon = tp?.icon || MapPin;
                  return (
                    <li
                      key={p._id}
                      className={`my-post-item ${deletingId === p._id ? 'is-deleting' : ''}`}
                    >
                      <span className="mp-icon" style={{ color: tp?.color || '#94a3b8' }}>
                        <Icon size={14} />
                      </span>
                      <button
                        type="button"
                        className="mp-body"
                        onClick={() => analyzeArea(p.location.lat, p.location.lon, 0.6)}
                        title="Locate on map"
                      >
                        <p className="mp-msg">{p.message}</p>
                        <span className="mp-meta">
                          <Clock size={10} /> {timeAgo(p.createdAt)}
                          {p.location?.name && <> · {p.location.name}</>}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="mp-delete"
                        onClick={() => deletePost(p._id)}
                        disabled={deletingId === p._id}
                        aria-label={t.remove}
                        title={t.remove}
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="lm-card">
            <div className="card-head"><Crosshair size={16} /> <span>{t.clusters}</span></div>
            {clusters.length === 0 ? (
              <p className="muted-hint">No active zones yet.</p>
            ) : (
              <ul className="cluster-list">
                {clusters.slice(0, 6).map((c) => (
                  <li
                    key={c.id}
                    className={`cluster-item s-${c.dominantSentiment}`}
                    onClick={() => analyzeArea(c.center.lat, c.center.lon, 0.8)}
                  >
                    <span className="cdot" />
                    <div>
                      <strong>{c.size} reports</strong>
                      <small>{c.types.join(' · ')}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              className="btn-ghost full"
              onClick={fetchAll}
            ><RefreshCw size={14} /> {t.refresh}</button>
          </div>
        </aside>

        {/* Map */}
        <div className="lm-map-wrap">
          <MapContainer
            center={center}
            zoom={11}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom
          >
            <ThemedTileLayer />
            <ClickToReport
              onPick={setPickedPos}
              getCooldown={() => removeCooldownRef.current}
            />
            {userPos && <FlyToUser position={userPos} />}

            {userPos && (
              <Marker
                position={userPos}
                icon={makeIcon('#3b82f6', 1, true)}
              >
                <Popup>You are here</Popup>
              </Marker>
            )}

            {pickedPos && (
              <Marker
                position={[pickedPos.lat, pickedPos.lon]}
                icon={makeIcon('#a855f7', 1, true)}
              >
                <Popup>
                  <div className="lm-popup pick-popup" ref={stopMapEvents}>
                    <strong>{t.pickedHint}</strong>
                    <small>{pickedPos.lat.toFixed(4)}, {pickedPos.lon.toFixed(4)}</small>
                    <button
                      type="button"
                      className="popup-action danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        useMyLocation();
                      }}
                    >
                      <Trash2 size={12} /> {t.remove}
                    </button>
                  </div>
                </Popup>
              </Marker>
            )}

            {filtered.map((p) => (
              <Marker
                key={p._id}
                position={[p.location.lat, p.location.lon]}
                icon={makeIcon(sentimentColor(p.sentiment), fadeOpacity(p.createdAt))}
                eventHandlers={{
                  click: () => analyzeArea(p.location.lat, p.location.lon, 0.6)
                }}
              >
                <Popup>
                  <div className="lm-popup">
                    <span className={`tag t-${p.sentiment}`}>{p.type}</span>
                    <p>{p.message}</p>
                    <small>
                      {p.author} · {new Date(p.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </small>
                  </div>
                </Popup>
              </Marker>
            ))}

            {clusters.map((c) => (
              <Circle
                key={c.id}
                center={[c.center.lat, c.center.lon]}
                radius={600}
                pathOptions={{
                  color: sentimentColor(c.dominantSentiment),
                  fillColor: sentimentColor(c.dominantSentiment),
                  fillOpacity: 0.12,
                  weight: 1
                }}
                eventHandlers={{
                  click: () => analyzeArea(c.center.lat, c.center.lon, 0.8)
                }}
              />
            ))}

            {activeArea && (
              <Circle
                center={[activeArea.lat, activeArea.lon]}
                radius={activeArea.radiusKm * 1000}
                pathOptions={{ color: '#a855f7', fillOpacity: 0.04, dashArray: '6 6' }}
              />
            )}
          </MapContainer>

          <div className="map-overlay-stats">
            <div><strong>{posts.length}</strong><span>posts</span></div>
            <div><strong>{clusters.length}</strong><span>zones</span></div>
            <div><strong>{posts.filter((p) => ageHours(p.createdAt) < 1).length}</strong><span>last hr</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMap;
