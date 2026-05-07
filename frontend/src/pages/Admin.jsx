import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Shield, Users, Wifi, MapPinned, MessagesSquare, Radio, Activity, BarChart3,
  Trash2, ShieldCheck, ShieldOff, Ban, Search, RefreshCw, AlertTriangle, ArrowLeft,
  Key, Eye, X, Pencil, Save, Calendar, Clock, BookOpen, RotateCcw, Lock, Sparkles,
  ChevronDown, ChevronRight, CreditCard
} from 'lucide-react';
import useTripStore from '../stores/tripStore';
import socket from '../lib/socket';
import { useToast } from '../components/UI/Toast';
import AdminPlans from './AdminPlans';
import { useConfirm } from '../components/UI/ConfirmDialog';
import './Admin.css';

const API = 'http://localhost:5000';

// Light helper to format timestamps consistently across the dashboard.
const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const fmtRelative = (d) => {
  if (!d) return '—';
  const ms = Date.now() - new Date(d).getTime();
  if (Number.isNaN(ms)) return '—';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d2 = Math.floor(hr / 24);
  return `${d2}d ago`;
};

const Admin = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, token } = useTripStore();

  // Persist the active admin section across reloads — admins are typically
  // monitoring one tab (e.g. "Users" or "Plans") and re-loading shouldn't
  // bounce them back to Overview.
  const [section, setSectionState] = useState(() => {
    try { return localStorage.getItem('travelai_admin_section') || 'overview'; }
    catch { return 'overview'; }
  });
  const setSection = (s) => {
    setSectionState(s);
    try { localStorage.setItem('travelai_admin_section', s); } catch { /* ignore */ }
  };
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState({ items: [], total: 0, page: 1 });
  const [userQuery, setUserQuery] = useState('');
  const [online, setOnline] = useState({ counts: { totalSockets: 0, onlineUsers: 0, guests: 0 }, sockets: [] });
  const [trips, setTrips] = useState({ items: [], total: 0, page: 1 });
  const [rooms, setRooms] = useState([]);
  const [posts, setPosts] = useState([]);
  const [apiUsage, setApiUsage] = useState(null);
  const [prompts, setPrompts] = useState([]);
  // Password gate for the Prompts editor: kept in memory only, cleared when
  // the user leaves the section. Re-required on every page reload.
  const [promptPassword, setPromptPassword] = useState('');
  const [promptsUnlocked, setPromptsUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal state — at most one of these is non-null at a time.
  const [pwModalUser, setPwModalUser] = useState(null);
  const [messagesModalRoom, setMessagesModalRoom] = useState(null);
  const [tripModalId, setTripModalId] = useState(null);

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // Guard: redirect non-admins.
  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    if (user && user.isAdmin === false) {
      navigate('/', { replace: true });
    }
  }, [token, user, navigate]);

  // Fetch on section change.
  useEffect(() => {
    if (!token || !user?.isAdmin) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        if (section === 'overview' || section === 'online') {
          const [statsRes, onlineRes] = await Promise.all([
            axios.get(`${API}/api/admin/stats`, { headers }),
            axios.get(`${API}/api/admin/online`, { headers })
          ]);
          if (cancelled) return;
          setStats(statsRes.data);
          setOnline(onlineRes.data);
        }
        if (section === 'users') {
          const res = await axios.get(`${API}/api/admin/users`, {
            headers,
            params: { q: userQuery, page: users.page, limit: 20 }
          });
          if (!cancelled) setUsers({ items: res.data.items, total: res.data.total, page: res.data.page });
        }
        if (section === 'trips') {
          const res = await axios.get(`${API}/api/admin/trips`, {
            headers,
            params: { page: trips.page, limit: 20 }
          });
          if (!cancelled) setTrips({ items: res.data.items, total: res.data.total, page: res.data.page });
        }
        if (section === 'rooms') {
          const res = await axios.get(`${API}/api/admin/rooms`, { headers });
          if (!cancelled) setRooms(res.data);
        }
        if (section === 'liveposts') {
          const res = await axios.get(`${API}/api/admin/liveposts`, { headers });
          if (!cancelled) setPosts(res.data.items);
        }
        if (section === 'apiusage') {
          const res = await axios.get(`${API}/api/admin/api-usage`, { headers });
          if (!cancelled) setApiUsage(res.data);
        }
        if (section === 'prompts' && promptsUnlocked) {
          const res = await axios.get(`${API}/api/admin/prompts`, { headers });
          if (!cancelled) setPrompts(res.data.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, token, user?.isAdmin, userQuery, users.page, trips.page, promptsUnlocked]);

  // Lock the Prompts editor whenever the admin navigates to a different
  // section so the in-memory password never lingers across views.
  useEffect(() => {
    if (section !== 'prompts') {
      setPromptsUnlocked(false);
      setPromptPassword('');
    }
  }, [section]);

  // Live polling for online stats every 5 seconds while on the dashboard.
  useEffect(() => {
    if (!token || !user?.isAdmin) return;
    const id = setInterval(async () => {
      try {
        const [s, o] = await Promise.all([
          axios.get(`${API}/api/admin/stats`, { headers }),
          axios.get(`${API}/api/admin/online`, { headers })
        ]);
        setStats(s.data);
        setOnline(o.data);
      } catch {
        /* silent */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [token, user?.isAdmin, headers]);

  // Realtime updates for the Live Posts section: subscribe to the same socket
  // events LiveMap uses so new posts appear immediately and deleted ones
  // vanish without waiting for a section switch or refresh.
  useEffect(() => {
    if (section !== 'liveposts') return undefined;

    const onNew = (post) => {
      if (!post?._id) return;
      setPosts((prev) => {
        // Drop any optimistic duplicate first, then prepend.
        const without = prev.filter((p) => String(p._id) !== String(post._id));
        return [post, ...without];
      });
    };
    const onDelete = ({ _id } = {}) => {
      if (!_id) return;
      setPosts((prev) => prev.filter((p) => String(p._id) !== String(_id)));
    };

    socket.on('livemap:new_post', onNew);
    socket.on('livemap:delete_post', onDelete);
    return () => {
      socket.off('livemap:new_post', onNew);
      socket.off('livemap:delete_post', onDelete);
    };
  }, [section]);

  // ---- mutations -------------------------------------------------------
  const refreshUsers = async () => {
    const res = await axios.get(`${API}/api/admin/users`, {
      headers, params: { q: userQuery, page: users.page, limit: 20 }
    });
    setUsers({ items: res.data.items, total: res.data.total, page: res.data.page });
  };

  const toggleAdmin = async (u) => {
    const action = u.isAdmin ? 'Demote' : 'Promote';
    const ok = await confirm({
      title: `${action} ${u.email}?`,
      message: u.isAdmin
        ? 'This user will lose admin access immediately.'
        : 'This user will gain full admin access.',
      confirmLabel: action,
      variant: u.isAdmin ? 'danger' : 'default'
    });
    if (!ok) return;
    try {
      await axios.patch(`${API}/api/admin/users/${u._id}`, { isAdmin: !u.isAdmin }, { headers });
      await refreshUsers();
      toast.success(`${u.email} ${u.isAdmin ? 'demoted' : 'promoted to admin'}.`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const toggleDisabled = async (u) => {
    const action = u.disabled ? 'Re-enable' : 'Disable';
    const ok = await confirm({
      title: `${action} ${u.email}?`,
      message: u.disabled
        ? 'The user will be able to sign in again.'
        : 'The user will be locked out of their account until re-enabled.',
      confirmLabel: action,
      variant: u.disabled ? 'default' : 'danger'
    });
    if (!ok) return;
    try {
      await axios.patch(`${API}/api/admin/users/${u._id}`, { disabled: !u.disabled }, { headers });
      await refreshUsers();
      toast.success(`${u.email} ${u.disabled ? 're-enabled' : 'disabled'}.`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const deleteUser = async (u) => {
    const ok = await confirm({
      title: `Delete ${u.email}?`,
      message: 'All of their trips will also be removed. This cannot be undone.',
      confirmLabel: 'Delete user',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await axios.delete(`${API}/api/admin/users/${u._id}`, { headers });
      await refreshUsers();
      toast.success(`${u.email} deleted.`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const deleteTrip = async (id) => {
    const ok = await confirm({
      title: 'Delete this trip?',
      message: 'The trip and its itinerary will be permanently removed.',
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await axios.delete(`${API}/api/admin/trips/${id}`, { headers });
      const res = await axios.get(`${API}/api/admin/trips`, { headers, params: { page: trips.page, limit: 20 } });
      setTrips({ items: res.data.items, total: res.data.total, page: res.data.page });
      toast.success('Trip deleted.');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const deleteRoom = async (id) => {
    const ok = await confirm({
      title: 'Delete this hub?',
      message: 'All members will be unsubscribed and chat history will be lost.',
      confirmLabel: 'Delete hub',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await axios.delete(`${API}/api/admin/rooms/${id}`, { headers });
      const res = await axios.get(`${API}/api/admin/rooms`, { headers });
      setRooms(res.data);
      toast.success('Hub deleted.');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const deletePost = async (id) => {
    const ok = await confirm({
      title: 'Delete this live post?',
      message: 'It will be removed from every traveller’s map immediately.',
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await axios.delete(`${API}/api/admin/liveposts/${id}`, { headers });
      setPosts((prev) => prev.filter((p) => String(p._id) !== String(id)));
      toast.success('Post deleted.');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const resetPassword = async (userId, newPassword) => {
    await axios.post(
      `${API}/api/admin/users/${userId}/password`,
      { newPassword },
      { headers }
    );
  };

  const refreshApiUsage = async () => {
    const res = await axios.get(`${API}/api/admin/api-usage`, { headers });
    setApiUsage(res.data);
  };

  // ---- prompts ---------------------------------------------------------
  // Unlock the Prompts editor by re-verifying the admin's password. We keep
  // the password in component state for the rest of the session so each
  // save/reset doesn't require typing it again.
  const unlockPrompts = async (password) => {
    try {
      await axios.post(`${API}/api/admin/verify-password`, { password }, { headers });
      setPromptPassword(password);
      setPromptsUnlocked(true);
      toast.success('Prompts editor unlocked.');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not verify password.');
      return false;
    }
  };

  const savePrompt = async (key, { systemPrompt, userTemplate }) => {
    if (!promptPassword) {
      toast.error('Session expired. Please unlock again.');
      setPromptsUnlocked(false);
      return null;
    }
    try {
      const res = await axios.patch(
        `${API}/api/admin/prompts/${encodeURIComponent(key)}`,
        { systemPrompt, userTemplate, password: promptPassword },
        { headers }
      );
      setPrompts((prev) => prev.map((p) => (p.key === key ? res.data : p)));
      toast.success(`Saved “${res.data.title}”.`);
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      // 401 means the cached password no longer matches (e.g. user changed
      // it from another tab). Force a re-unlock.
      if (err.response?.status === 401) {
        setPromptsUnlocked(false);
        setPromptPassword('');
      }
      toast.error(msg);
      return null;
    }
  };

  const resetPrompt = async (key) => {
    if (!promptPassword) {
      toast.error('Session expired. Please unlock again.');
      setPromptsUnlocked(false);
      return null;
    }
    const target = prompts.find((p) => p.key === key);
    const ok = await confirm({
      title: `Reset “${target?.title || key}”?`,
      message: 'The prompt will revert to the built-in default. Any custom wording will be lost.',
      confirmLabel: 'Reset to default',
      variant: 'danger'
    });
    if (!ok) return null;
    try {
      const res = await axios.post(
        `${API}/api/admin/prompts/${encodeURIComponent(key)}/reset`,
        { password: promptPassword },
        { headers }
      );
      setPrompts((prev) => prev.map((p) => (p.key === key ? res.data : p)));
      toast.success(`Reset “${res.data.title}” to default.`);
      return res.data;
    } catch (err) {
      if (err.response?.status === 401) {
        setPromptsUnlocked(false);
        setPromptPassword('');
      }
      toast.error(err.response?.data?.error || err.message);
      return null;
    }
  };

  const resetApiUsage = async () => {
    const ok = await confirm({
      title: 'Reset API usage counters?',
      message: 'Per-route counts and the recent-calls log will be cleared.',
      confirmLabel: 'Reset',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await axios.post(`${API}/api/admin/api-usage/reset`, {}, { headers });
      await refreshApiUsage();
      toast.success('API usage counters cleared.');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  // Render guard: while we're checking the admin flag, show a loading view.
  if (!token || !user) {
    return (
      <div className="admin-page">
        <div className="admin-blocked">
          <Shield size={32} />
          <h2>Sign in required</h2>
          <p>Admin access is restricted.</p>
        </div>
      </div>
    );
  }
  if (user && user.isAdmin === false) {
    return (
      <div className="admin-page">
        <div className="admin-blocked">
          <AlertTriangle size={32} />
          <h2>Access denied</h2>
          <p>This account is not an administrator.</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'online', label: 'Online now', icon: Wifi },
    { id: 'trips', label: 'Trips', icon: MapPinned },
    { id: 'rooms', label: 'Hubs', icon: MessagesSquare },
    { id: 'liveposts', label: 'Live Posts', icon: Radio },
    { id: 'apiusage', label: 'API Usage', icon: BarChart3 },
    { id: 'prompts', label: 'AI Prompts', icon: BookOpen },
    { id: 'plans', label: 'Plans & Billing', icon: CreditCard }
  ];

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <Shield size={20} />
            <div>
              <span className="brand-title">Admin</span>
              <span className="brand-sub">{user.email}</span>
            </div>
          </div>
          <nav className="admin-nav">
            {navItems.map((it) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`admin-nav-item ${section === it.id ? 'active' : ''}`}
                  onClick={() => setSection(it.id)}
                >
                  <Icon size={16} /> {it.label}
                </button>
              );
            })}
          </nav>
          <button className="admin-back" onClick={() => navigate('/')}>
            <ArrowLeft size={14} /> Back to site
          </button>
        </aside>

        <main className="admin-main">
          <header className="admin-header">
            <div>
              <h1 className="admin-title">{navItems.find((n) => n.id === section)?.label}</h1>
              <p className="admin-subtitle">
                Live · {online.counts.onlineUsers} signed-in · {online.counts.guests} guests
              </p>
            </div>
            <div className="admin-header-actions">
              {error && <span className="admin-error">{error}</span>}
              {loading && <span className="admin-loading"><RefreshCw size={14} className="spin" /> loading…</span>}
            </div>
          </header>

          {section === 'overview' && stats && (
            <Overview stats={stats} online={online} />
          )}

          {section === 'users' && (
            <UsersSection
              data={users}
              query={userQuery}
              onQuery={(q) => { setUserQuery(q); setUsers((u) => ({ ...u, page: 1 })); }}
              onPage={(p) => setUsers((u) => ({ ...u, page: p }))}
              onToggleAdmin={toggleAdmin}
              onToggleDisabled={toggleDisabled}
              onDelete={deleteUser}
              onResetPassword={(u) => setPwModalUser(u)}
              currentUserId={user.id}
            />
          )}

          {section === 'online' && <OnlineSection online={online} />}

          {section === 'trips' && (
            <TripsSection
              data={trips}
              onPage={(p) => setTrips((t) => ({ ...t, page: p }))}
              onDelete={deleteTrip}
              onOpen={(id) => setTripModalId(id)}
            />
          )}

          {section === 'rooms' && (
            <RoomsSection
              rooms={rooms}
              onDelete={deleteRoom}
              onOpenMessages={(room) => setMessagesModalRoom(room)}
            />
          )}

          {section === 'liveposts' && (
            <LivePostsSection
              posts={posts}
              onDelete={deletePost}
              onRefresh={async () => {
                try {
                  const res = await axios.get(`${API}/api/admin/liveposts`, { headers });
                  setPosts(res.data.items);
                } catch (err) {
                  toast.error(err.response?.data?.error || err.message);
                }
              }}
            />
          )}

          {section === 'apiusage' && (
            <ApiUsageSection
              data={apiUsage}
              onRefresh={refreshApiUsage}
              onReset={resetApiUsage}
            />
          )}

          {section === 'plans' && (
            <AdminPlans token={token} toast={toast} />
          )}

          {section === 'prompts' && (
            <PromptsSection
              prompts={prompts}
              unlocked={promptsUnlocked}
              onUnlock={unlockPrompts}
              onSave={savePrompt}
              onReset={resetPrompt}
              onLock={() => {
                setPromptsUnlocked(false);
                setPromptPassword('');
              }}
            />
          )}
        </main>
      </div>

      {pwModalUser && (
        <PasswordModal
          user={pwModalUser}
          onClose={() => setPwModalUser(null)}
          onSubmit={async (pw) => {
            await resetPassword(pwModalUser._id, pw);
            setPwModalUser(null);
          }}
        />
      )}
      {messagesModalRoom && (
        <MessagesModal
          room={messagesModalRoom}
          headers={headers}
          onClose={() => setMessagesModalRoom(null)}
        />
      )}
      {tripModalId && (
        <TripDetailModal
          tripId={tripModalId}
          headers={headers}
          onClose={() => setTripModalId(null)}
        />
      )}
    </div>
  );
};

// =========================================================================
// Sub-sections
// =========================================================================

const Overview = ({ stats, online }) => (
  <div className="stat-grid">
    <StatCard label="Total users" value={stats.users} sub={`${stats.admins} admin · ${stats.disabled} disabled`} />
    <StatCard label="Online now" value={online.counts.onlineUsers} sub={`${online.counts.guests} guests · ${online.counts.totalSockets} sockets`} highlight />
    <StatCard label="Total trips" value={stats.trips} />
    <StatCard label="Hubs" value={stats.rooms} sub={`${stats.totalMessages} messages`} />
    <StatCard label="Live posts" value={stats.livePosts} />
  </div>
);

const StatCard = ({ label, value, sub, highlight }) => (
  <div className={`stat-card ${highlight ? 'is-highlight' : ''}`}>
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
    {sub && <span className="stat-sub">{sub}</span>}
  </div>
);

const UsersSection = ({ data, query, onQuery, onPage, onToggleAdmin, onToggleDisabled, onDelete, onResetPassword, currentUserId }) => (
  <section className="admin-section">
    <div className="section-toolbar">
      <div className="search-input">
        <Search size={14} />
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search by name, email, or IP…"
        />
      </div>
      <span className="muted">{data.total} total</span>
    </div>
    <div className="table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Status</th>
            <th>IP</th>
            <th>Last seen</th>
            <th>Logins</th>
            <th>Trips</th>
            <th className="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((u) => (
            <tr key={u._id} className={u.disabled ? 'is-disabled' : ''}>
              <td>
                <div className="user-cell">
                  <div className="avatar-sm">{u.name?.[0]?.toUpperCase() || 'U'}</div>
                  <div>
                    <strong>{u.name}</strong>
                    <span className="muted">{u.email}</span>
                  </div>
                </div>
              </td>
              <td>
                <div className="status-cell">
                  <span className={`dot ${u.online ? 'on' : 'off'}`} />
                  {u.online ? 'Online' : 'Offline'}
                  {u.isAdmin && <span className="pill pill-admin">Admin</span>}
                  {u.disabled && <span className="pill pill-danger">Disabled</span>}
                </div>
              </td>
              <td><code>{u.lastIp || '—'}</code></td>
              <td title={fmtDate(u.lastSeenAt)}>{u.lastSeenAt ? fmtRelative(u.lastSeenAt) : '—'}</td>
              <td>{u.loginCount || 0}</td>
              <td>{u.tripsCount}</td>
              <td className="col-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title={u.isAdmin ? 'Demote to user' : 'Promote to admin'}
                  onClick={() => onToggleAdmin(u)}
                  disabled={String(u._id) === String(currentUserId)}
                >
                  {u.isAdmin ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title={u.disabled ? 'Re-enable' : 'Disable'}
                  onClick={() => onToggleDisabled(u)}
                >
                  <Ban size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Reset password"
                  onClick={() => onResetPassword(u)}
                >
                  <Key size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  title="Delete user"
                  onClick={() => onDelete(u)}
                  disabled={String(u._id) === String(currentUserId)}
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
          {data.items.length === 0 && (
            <tr><td colSpan={7} className="empty-row">No users found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
    <Pagination page={data.page} total={data.total} limit={20} onPage={onPage} />
  </section>
);

const OnlineSection = ({ online }) => (
  <section className="admin-section">
    <div className="online-summary">
      <SummaryPill label="Sockets" value={online.counts.totalSockets} />
      <SummaryPill label="Signed in" value={online.counts.onlineUsers} highlight />
      <SummaryPill label="Guests" value={online.counts.guests} />
    </div>
    <div className="table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>IP</th>
            <th>User Agent</th>
            <th>Connected</th>
            <th>Socket</th>
          </tr>
        </thead>
        <tbody>
          {online.sockets.map((s) => (
            <tr key={s.socketId}>
              <td>
                {s.user ? (
                  <div className="user-cell">
                    <div className="avatar-sm">{s.user.name?.[0]?.toUpperCase() || 'U'}</div>
                    <div>
                      <strong>{s.user.name}</strong>
                      <span className="muted">{s.user.email}</span>
                    </div>
                  </div>
                ) : (
                  <span className="muted">Guest</span>
                )}
              </td>
              <td><code>{s.ip || '—'}</code></td>
              <td className="ua-cell" title={s.userAgent}>{s.userAgent || '—'}</td>
              <td title={fmtDate(s.since)}>{fmtRelative(s.since)}</td>
              <td><code className="muted">{s.socketId.slice(0, 10)}…</code></td>
            </tr>
          ))}
          {online.sockets.length === 0 && (
            <tr><td colSpan={5} className="empty-row">Nobody connected.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
);

const SummaryPill = ({ label, value, highlight }) => (
  <div className={`summary-pill ${highlight ? 'is-highlight' : ''}`}>
    <span className="summary-label">{label}</span>
    <span className="summary-value">{value}</span>
  </div>
);

const TripsSection = ({ data, onPage, onDelete, onOpen }) => (
  <section className="admin-section">
    <div className="section-toolbar">
      <span className="muted">{data.total} trips</span>
    </div>
    <div className="table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Destination</th>
            <th>Owner</th>
            <th>Dates</th>
            <th>Style</th>
            <th>Budget</th>
            <th>Created</th>
            <th className="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((t) => (
            <tr key={t._id}>
              <td>
                <strong>{t.destination?.name || '—'}</strong>
              </td>
              <td>
                {t.userId ? (
                  <span>
                    <strong>{t.userId.name || '—'}</strong>
                    <span className="muted"> · {t.userId.email}</span>
                  </span>
                ) : <span className="muted">— anonymous</span>}
              </td>
              <td>
                {t.dates?.start ? new Date(t.dates.start).toLocaleDateString() : '—'}
                {t.dates?.end ? ` → ${new Date(t.dates.end).toLocaleDateString()}` : ''}
              </td>
              <td>{t.style || '—'}</td>
              <td>{t.budget?.total ? `${t.budget.total} ${t.budget.currency || ''}` : '—'}</td>
              <td title={fmtDate(t.createdAt)}>{fmtRelative(t.createdAt)}</td>
              <td className="col-actions">
                <button type="button" className="icon-btn" onClick={() => onOpen(t._id)} title="View itinerary">
                  <Eye size={14} />
                </button>
                <button type="button" className="icon-btn danger" onClick={() => onDelete(t._id)} title="Delete trip">
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
          {data.items.length === 0 && <tr><td colSpan={7} className="empty-row">No trips yet.</td></tr>}
        </tbody>
      </table>
    </div>
    <Pagination page={data.page} total={data.total} limit={20} onPage={onPage} />
  </section>
);

const RoomsSection = ({ rooms, onDelete, onOpenMessages }) => (
  <section className="admin-section">
    <div className="section-toolbar">
      <span className="muted">{rooms.length} hubs</span>
    </div>
    <div className="table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Hub</th>
            <th>Code</th>
            <th>Flags</th>
            <th>Members</th>
            <th>Messages</th>
            <th>Created</th>
            <th className="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((r) => (
            <tr key={r._id}>
              <td>
                <strong>{r.roomName}</strong>
                <span className="muted"> · {r.destination}</span>
              </td>
              <td><code>{r.inviteCode}</code></td>
              <td>
                {r.isGlobalDefault && <span className="pill pill-admin">Default</span>}
                {r.isWorldCupFanRoom && <span className="pill pill-warn">Fan room</span>}
              </td>
              <td>{r.memberCount}</td>
              <td>{r.messageCount}</td>
              <td title={fmtDate(r.createdAt)}>{fmtRelative(r.createdAt)}</td>
              <td className="col-actions">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onOpenMessages(r)}
                  title="View / moderate messages"
                >
                  <Eye size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={() => onDelete(r._id)}
                  title="Delete hub"
                  disabled={r.isGlobalDefault}
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
          {rooms.length === 0 && <tr><td colSpan={7} className="empty-row">No hubs.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>
);

const LivePostsSection = ({ posts, onDelete, onRefresh }) => (
  <section className="admin-section">
    <div className="section-toolbar">
      <span className="muted">{posts.length} posts · live updates</span>
      {onRefresh && (
        <button type="button" className="btn-secondary" onClick={onRefresh}>
          <RefreshCw size={14} /> Refresh
        </button>
      )}
    </div>
    <div className="post-grid">
      {posts.map((p) => (
        <article key={p._id} className="post-card">
          <header>
            <strong>{p.author || 'Anonymous'}</strong>
            <span className="muted">{fmtRelative(p.createdAt)}</span>
          </header>
          <div className="post-meta">
            {p.type && <span className={`pill pill-${p.sentiment === 'negative' ? 'danger' : p.sentiment === 'positive' ? 'admin' : 'warn'}`}>{p.type}</span>}
            <span className="muted">▲ {p.upvotes || 0}</span>
          </div>
          <p>{p.message || ''}</p>
          {p.location && (
            <span className="muted">
              📍 {p.location.name || `${p.location.lat?.toFixed(2)}, ${p.location.lon?.toFixed(2)}`}
            </span>
          )}
          <button className="icon-btn danger post-delete" onClick={() => onDelete(p._id)}>
            <Trash2 size={14} /> Delete
          </button>
        </article>
      ))}
      {posts.length === 0 && <p className="muted">No live posts.</p>}
    </div>
  </section>
);

const Pagination = ({ page, total, limit, onPage }) => {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
      <span>Page {page} / {pages}</span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
};

// =========================================================================
// Modals — overlay panels for password reset, hub messages, and trip detail
// =========================================================================

const ModalShell = ({ title, subtitle, onClose, children, wide }) => (
  <div className="admin-modal-overlay" onClick={onClose}>
    <div
      className={`admin-modal ${wide ? 'is-wide' : ''}`}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <header className="admin-modal-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </header>
      <div className="admin-modal-body">{children}</div>
    </div>
  </div>
);

const PasswordModal = ({ user, onClose, onSubmit }) => {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (pw1.length < 6) return setErr('Password must be at least 6 characters.');
    if (pw1 !== pw2) return setErr('Passwords do not match.');
    setBusy(true);
    try {
      await onSubmit(pw1);
    } catch (ex) {
      setErr(ex.response?.data?.error || ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title="Reset password"
      subtitle={`${user.name} · ${user.email}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="pw-form">
        <label>
          New password
          <input
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            minLength={6}
            autoFocus
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            minLength={6}
            required
          />
        </label>
        {err && <span className="admin-error">{err}</span>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Set password'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const MessagesModal = ({ room, headers, onClose }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');

  const load = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await axios.get(`${API}/api/admin/rooms/${room._id}/messages`, { headers });
      setData(res.data);
    } catch (ex) {
      setErr(ex.response?.data?.error || ex.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [room._id]);

  const startEdit = (m) => {
    setEditingId(String(m._id));
    setDraft(m.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
  };

  const saveEdit = async (m) => {
    if (!draft.trim()) return;
    try {
      await axios.patch(
        `${API}/api/admin/rooms/${room._id}/messages/${m._id}`,
        { text: draft.trim() },
        { headers }
      );
      setEditingId(null);
      setDraft('');
      await load();
      toast.success('Message updated.');
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message);
    }
  };

  const deleteMsg = async (m) => {
    const ok = await confirm({
      title: 'Delete this message?',
      message: 'It will be removed from the chat history for everyone.',
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await axios.delete(`${API}/api/admin/rooms/${room._id}/messages/${m._id}`, { headers });
      await load();
      toast.success('Message deleted.');
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message);
    }
  };

  return (
    <ModalShell
      title={room.roomName}
      subtitle={`${room.destination} · ${data?.messages?.length || 0} messages`}
      onClose={onClose}
      wide
    >
      {err && <span className="admin-error">{err}</span>}
      {busy && !data && <p className="muted">Loading…</p>}
      {data && (
        <div className="messages-list">
          {data.messages.length === 0 && <p className="muted">No messages yet.</p>}
          {data.messages.map((m) => {
            const isEditing = editingId === String(m._id);
            return (
              <div key={m._id} className="message-row">
                <div className="message-meta">
                  <strong>{m.sender || 'Unknown'}</strong>
                  <span className="muted" title={fmtDate(m.timestamp)}>
                    {fmtRelative(m.timestamp)}
                  </span>
                </div>
                {isEditing ? (
                  <div className="message-edit">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={2}
                      autoFocus
                    />
                    <div className="message-edit-actions">
                      <button type="button" className="icon-btn" onClick={() => saveEdit(m)} title="Save">
                        <Save size={14} />
                      </button>
                      <button type="button" className="icon-btn" onClick={cancelEdit} title="Cancel">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="message-body">
                    <p>{m.text}</p>
                    <div className="message-actions">
                      <button type="button" className="icon-btn" onClick={() => startEdit(m)} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="icon-btn danger" onClick={() => deleteMsg(m)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
};

const TripDetailModal = ({ tripId, headers, onClose }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [trip, setTrip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await axios.get(`${API}/api/admin/trips/${tripId}`, { headers });
      setTrip(res.data);
    } catch (ex) {
      setErr(ex.response?.data?.error || ex.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tripId]);

  const deleteActivity = async (dayIdx, sessionIdx) => {
    const ok = await confirm({
      title: 'Remove this activity?',
      message: 'The activity will be removed from the itinerary.',
      confirmLabel: 'Remove',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await axios.delete(
        `${API}/api/admin/trips/${tripId}/days/${dayIdx}/sessions/${sessionIdx}`,
        { headers }
      );
      await load();
      toast.success('Activity removed.');
    } catch (ex) {
      toast.error(ex.response?.data?.error || ex.message);
    }
  };

  const ownerLabel = trip?.userId
    ? `${trip.userId.name || ''} · ${trip.userId.email || ''}`
    : 'Anonymous';

  return (
    <ModalShell
      title={trip?.destination?.name || 'Trip'}
      subtitle={ownerLabel}
      onClose={onClose}
      wide
    >
      {err && <span className="admin-error">{err}</span>}
      {busy && !trip && <p className="muted">Loading…</p>}
      {trip && (
        <div className="trip-detail">
          <div className="trip-detail-grid">
            <DetailRow label="Travelers" value={trip.travelers || '—'} />
            <DetailRow label="Style" value={trip.style || '—'} />
            <DetailRow
              label="Dates"
              value={
                trip.dates?.start
                  ? `${new Date(trip.dates.start).toLocaleDateString()}${
                      trip.dates.end ? ' → ' + new Date(trip.dates.end).toLocaleDateString() : ''
                    }`
                  : '—'
              }
            />
            <DetailRow
              label="Budget"
              value={trip.budget?.total ? `${trip.budget.total} ${trip.budget.currency || ''}` : '—'}
            />
            <DetailRow label="Status" value={trip.status || 'draft'} />
            <DetailRow label="Created" value={fmtDate(trip.createdAt)} />
            <DetailRow label="Hub" value={trip.chatRoom?.roomName || '—'} />
            <DetailRow
              label="Coordinates"
              value={
                trip.destination?.lat != null && trip.destination?.lon != null
                  ? `${trip.destination.lat.toFixed(4)}, ${trip.destination.lon.toFixed(4)}`
                  : '—'
              }
            />
          </div>

          {trip.summary && (
            <div className="trip-summary">
              <h4>Summary</h4>
              <p>{trip.summary}</p>
            </div>
          )}

          <div className="trip-itinerary">
            <h4><Calendar size={14} /> Itinerary</h4>
            {(trip.itinerary || []).length === 0 && <p className="muted">No itinerary saved.</p>}
            {(trip.itinerary || []).map((day, dayIdx) => (
              <div key={dayIdx} className="trip-day">
                <h5>
                  Day {day.dayNumber || dayIdx + 1}
                  {day.date && <span className="muted"> · {new Date(day.date).toLocaleDateString()}</span>}
                </h5>
                <div className="trip-sessions">
                  {(day.sessions || []).map((s, sIdx) => (
                    <div key={sIdx} className="trip-session">
                      <span className="session-time">
                        <Clock size={12} /> {s.time || '—'}
                      </span>
                      <div className="session-body">
                        <strong>{s.activity?.name || 'Activity'}</strong>
                        {s.activity?.category && (
                          <span className="muted"> · {s.activity.category}</span>
                        )}
                        {s.activity?.cost != null && (
                          <span className="muted"> · {s.activity.cost} {trip.budget?.currency || ''}</span>
                        )}
                        {s.activity?.description && <p>{s.activity.description}</p>}
                      </div>
                      <button
                        type="button"
                        className="icon-btn danger"
                        title="Remove activity"
                        onClick={() => deleteActivity(dayIdx, sIdx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {(day.sessions || []).length === 0 && <p className="muted">No sessions.</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ModalShell>
  );
};

const DetailRow = ({ label, value }) => (
  <div className="detail-row">
    <span className="detail-label">{label}</span>
    <span className="detail-value">{value}</span>
  </div>
);

// =========================================================================
// API Usage section
// =========================================================================

const ApiUsageSection = ({ data, onRefresh, onReset }) => {
  if (!data) return <p className="muted">Loading…</p>;
  const fmtUptime = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h ${m}m ${s}s`;
  };
  return (
    <section className="admin-section">
      <div className="online-summary">
        <SummaryPill label="Total requests" value={data.totalRequests} highlight />
        <SummaryPill label="Uptime" value={fmtUptime(data.uptimeSec || 0)} />
        <SummaryPill label="2xx" value={data.status?.['2xx'] || 0} />
        <SummaryPill label="4xx" value={data.status?.['4xx'] || 0} />
        <SummaryPill label="5xx" value={data.status?.['5xx'] || 0} />
      </div>

      <div className="section-toolbar">
        <span className="muted">{data.routes?.length || 0} unique routes</span>
        <div className="admin-header-actions">
          <button type="button" className="btn-secondary" onClick={onRefresh}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" className="btn-secondary danger" onClick={onReset}>
            <Trash2 size={14} /> Reset counters
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Method</th>
              <th>Hits</th>
              <th>Avg ms</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            {(data.routes || []).map((r) => (
              <tr key={`${r.method} ${r.path}`}>
                <td><code>{r.path}</code></td>
                <td><span className={`pill pill-${r.method === 'GET' ? 'admin' : 'warn'}`}>{r.method}</span></td>
                <td>{r.count}</td>
                <td>{r.avgMs}</td>
                <td>{r.errors > 0 ? <span className="pill pill-danger">{r.errors}</span> : 0}</td>
              </tr>
            ))}
            {(data.routes || []).length === 0 && (
              <tr><td colSpan={5} className="empty-row">No requests recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h4 className="api-section-title">Recent calls</h4>
      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Method</th>
              <th>Path</th>
              <th>Status</th>
              <th>ms</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {(data.recent || []).slice(0, 50).map((r, i) => (
              <tr key={i}>
                <td title={fmtDate(r.ts)}>{fmtRelative(r.ts)}</td>
                <td>{r.method}</td>
                <td><code>{r.path}</code></td>
                <td>
                  <span className={`pill pill-${r.status >= 500 ? 'danger' : r.status >= 400 ? 'warn' : 'admin'}`}>
                    {r.status}
                  </span>
                </td>
                <td>{r.ms}</td>
                <td><code>{r.ip || '—'}</code></td>
              </tr>
            ))}
            {(data.recent || []).length === 0 && (
              <tr><td colSpan={6} className="empty-row">No recent calls.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// =========================================================================
// Prompts section — password-gated AI prompt editor
// =========================================================================

const PromptsLockScreen = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    const ok = await onUnlock(password);
    setBusy(false);
    if (ok) setPassword('');
  };

  return (
    <section className="admin-section">
      <div className="prompts-lock">
        <div className="prompts-lock-icon"><Lock size={28} /></div>
        <h2>Prompts editor is locked</h2>
        <p className="muted">
          Editing AI prompts changes how the planner, refinement chat and live-map
          summaries behave for everyone. Re-enter your admin password to unlock
          this section for the rest of the session.
        </p>
        <form onSubmit={submit} className="prompts-lock-form">
          <div className="input-group">
            <Key size={16} className="input-icon" />
            <input
              type="password"
              placeholder="Your admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              disabled={busy}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={busy || !password}>
            {busy ? 'Verifying…' : 'Unlock'}
          </button>
        </form>
        <p className="muted prompts-lock-note">
          The password is verified on the server, kept only in memory, and
          cleared as soon as you leave this section.
        </p>
      </div>
    </section>
  );
};

const PromptCard = ({ prompt, onSave, onReset }) => {
  const [open, setOpen] = useState(false);
  const [system, setSystem] = useState(prompt.systemPrompt);
  const [template, setTemplate] = useState(prompt.userTemplate);
  const [busy, setBusy] = useState(false);

  // Re-sync editor state when the upstream prompt changes (e.g. after save
  // or reset elsewhere). Without this, a Reset would visually look unchanged.
  useEffect(() => {
    setSystem(prompt.systemPrompt);
    setTemplate(prompt.userTemplate);
  }, [prompt.systemPrompt, prompt.userTemplate]);

  const dirty =
    system !== prompt.systemPrompt || template !== prompt.userTemplate;

  const handleSave = async () => {
    setBusy(true);
    await onSave(prompt.key, { systemPrompt: system, userTemplate: template });
    setBusy(false);
  };

  const handleReset = async () => {
    setBusy(true);
    await onReset(prompt.key);
    setBusy(false);
  };

  const handleRevert = () => {
    setSystem(prompt.systemPrompt);
    setTemplate(prompt.userTemplate);
  };

  return (
    <article className={`prompt-card ${open ? 'is-open' : ''}`}>
      <header className="prompt-card-head" onClick={() => setOpen((v) => !v)}>
        <div className="prompt-card-title">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Sparkles size={16} className="prompt-card-icon" />
          <div>
            <strong>{prompt.title}</strong>
            <span className="muted prompt-card-key">{prompt.key}</span>
          </div>
        </div>
        <div className="prompt-card-badges">
          {prompt.isOverridden ? (
            <span className="pill pill-warn">Customized</span>
          ) : (
            <span className="pill pill-default">Default</span>
          )}
        </div>
      </header>

      {open && (
        <div className="prompt-card-body">
          <p className="muted">{prompt.description}</p>

          {prompt.variables?.length > 0 && (
            <div className="prompt-vars">
              <span className="prompt-vars-label">Available variables:</span>
              {prompt.variables.map((v) => (
                <code key={v} className="prompt-var">{`{{${v}}}`}</code>
              ))}
            </div>
          )}

          <label className="prompt-field">
            <span>System prompt</span>
            <textarea
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              rows={3}
              spellCheck="false"
              disabled={busy}
            />
          </label>

          <label className="prompt-field">
            <span>User prompt template</span>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={14}
              spellCheck="false"
              disabled={busy}
            />
          </label>

          {prompt.updatedAt && (
            <p className="muted prompt-meta">
              Last edited {fmtRelative(prompt.updatedAt)}
              {prompt.updatedBy?.email ? ` by ${prompt.updatedBy.email}` : ''}.
            </p>
          )}

          <div className="prompt-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleRevert}
              disabled={!dirty || busy}
              title="Discard unsaved edits"
            >
              <X size={14} /> Discard changes
            </button>
            <button
              type="button"
              className="btn-secondary danger"
              onClick={handleReset}
              disabled={!prompt.isOverridden || busy}
              title="Restore the built-in default"
            >
              <RotateCcw size={14} /> Reset to default
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={!dirty || busy}
            >
              <Save size={14} /> {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
};

const PromptsSection = ({ prompts, unlocked, onUnlock, onSave, onReset, onLock }) => {
  if (!unlocked) return <PromptsLockScreen onUnlock={onUnlock} />;
  return (
    <section className="admin-section prompts-section">
      <div className="section-toolbar">
        <span className="muted">
          {prompts.length} prompt{prompts.length === 1 ? '' : 's'} · changes apply on the next AI call
        </span>
        <button type="button" className="btn-secondary" onClick={onLock}>
          <Lock size={14} /> Lock editor
        </button>
      </div>
      <div className="prompt-list">
        {prompts.map((p) => (
          <PromptCard key={p.key} prompt={p} onSave={onSave} onReset={onReset} />
        ))}
        {prompts.length === 0 && <p className="muted">No prompts registered.</p>}
      </div>
    </section>
  );
};

export default Admin;
