import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Shield, Users, Wifi, MapPinned, MessagesSquare, Radio, Activity, BarChart3,
  Trash2, ShieldCheck, ShieldOff, Ban, Search, RefreshCw, AlertTriangle, ArrowLeft,
  Key, Eye, X, Pencil, Save, Calendar, Clock, BookOpen, RotateCcw, Lock, Sparkles,
  ChevronDown, ChevronRight, CreditCard, Bell, Check, TrendingUp, PieChart
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts';
import useTripStore from '../stores/tripStore';
import socket, { identifySocket } from '../lib/socket';
import { useToast } from '../components/UI/Toast';
import AdminPlans from './AdminPlans';
import { useConfirm } from '../components/UI/ConfirmDialog';
import { useTranslation } from '../hooks/useTranslation';
import './Admin.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, token } = useTripStore();

  // Persist the active admin section across reloads — admins are typically
  // monitoring one tab (e.g. "Users" or "Plans") and re-loading shouldn't
  // bounce them back to Overview.
  const [section, setSectionState] = useState(() => {
    try { return localStorage.getItem('travio_admin_section') || 'overview'; }
    catch { return 'overview'; }
  });
  const setSection = (s) => {
    setSectionState(s);
    try { localStorage.setItem('travio_admin_section', s); } catch { /* ignore */ }
  };
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState({ items: [], total: 0, page: 1 });
  const [userQuery, setUserQuery] = useState('');
  const [online, setOnline] = useState({ counts: { totalSockets: 0, onlineUsers: 0, guests: 0 }, sockets: [] });
  const [trips, setTrips] = useState({ items: [], total: 0, page: 1 });
  const [rooms, setRooms] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [apiUsage, setApiUsage] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [payments, setPayments] = useState({ items: [], total: 0, page: 1 });
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

  // Bring the page back to the top whenever the user switches admin tabs.
  // Without this, deep-scrolling through a long list (e.g. Users) and then
  // clicking another sidebar item leaves them looking at the bottom of the
  // new section instead of its header.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [section]);

  // Guard: redirect non-admins.
  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    if (user && user.isAdmin === false) {
      navigate('/', { replace: true });
      return;
    }
    // Identify this admin's socket so the server knows who is online.
    if (user) {
      identifySocket(user);
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
          const endpoints = [
            axios.get(`${API}/api/admin/stats`, { headers }),
            axios.get(`${API}/api/admin/online`, { headers })
          ];
          if (section === 'overview') {
            endpoints.push(axios.get(`${API}/api/admin/analytics`, { headers }));
          }

          const results = await Promise.all(endpoints);
          if (cancelled) return;
          
          setStats(results[0].data);
          setOnline(results[1].data);
          if (section === 'overview') {
            setAnalytics(results[2].data);
          }
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
        if (section === 'apiusage') {
          const res = await axios.get(`${API}/api/admin/api-usage`, { headers });
          if (!cancelled) setApiUsage(res.data);
        }
        if (section === 'prompts' && promptsUnlocked) {
          const res = await axios.get(`${API}/api/admin/prompts`, { headers });
          if (!cancelled) setPrompts(res.data.items);
        }
        if (section === 'payments') {
          const res = await axios.get(`${API}/api/admin/payments`, {
            headers,
            params: { page: payments.page, limit: 20 }
          });
          if (!cancelled) setPayments({ items: res.data.items, total: res.data.total, page: res.data.page, limit: 20 });
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
  }, [section, token, user?.isAdmin, userQuery, users.page, trips.page, payments.page, promptsUnlocked]);

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
    { id: 'overview', label: t('admin.sidebar.overview'), icon: BarChart3 },
    { id: 'users', label: t('admin.sidebar.users'), icon: Users },
    { id: 'online', label: t('admin.sidebar.online'), icon: Activity },
    { id: 'trips', label: t('admin.sidebar.itineraries'), icon: MapPinned },
    { id: 'rooms', label: t('admin.sidebar.chathubs'), icon: MessagesSquare },
    { id: 'liveposts', label: t('admin.sidebar.livemap'), icon: Radio },
    { id: 'apiusage', label: t('admin.sidebar.logs'), icon: Wifi },
    { id: 'prompts', label: t('admin.sidebar.prompts'), icon: BookOpen },
    { id: 'plans', label: 'Plans & Billing', icon: CreditCard },
    { id: 'payments', label: t('admin.sidebar.payments'), icon: TrendingUp },
    { id: 'notifications', label: t('admin.sidebar.notifications'), icon: Bell }
  ];

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <Shield className="admin-logo" size={24} />
            <h2>{t('admin.sidebar.title')}</h2>
          </div>

          <nav className="admin-nav">
            <button
              className={`admin-nav-item ${section === 'overview' ? 'active' : ''}`}
              onClick={() => setSection('overview')}
            >
              <BarChart3 size={18} /> {t('admin.sidebar.overview')}
            </button>
            <button
              className={`admin-nav-item ${section === 'users' ? 'active' : ''}`}
              onClick={() => setSection('users')}
            >
              <Users size={18} /> {t('admin.sidebar.users')}
            </button>
            <button
              className={`admin-nav-item ${section === 'online' ? 'active' : ''}`}
              onClick={() => setSection('online')}
            >
              <Activity size={18} /> {t('admin.sidebar.online')}
            </button>
            <button
              className={`admin-nav-item ${section === 'liveposts' ? 'active' : ''}`}
              onClick={() => setSection('liveposts')}
            >
              <MapPinned size={18} /> {t('admin.sidebar.livemap')}
            </button>
            <button
              className={`admin-nav-item ${section === 'rooms' ? 'active' : ''}`}
              onClick={() => setSection('rooms')}
            >
              <MessagesSquare size={18} /> {t('admin.sidebar.chathubs')}
            </button>
            <button
              className={`admin-nav-item ${section === 'trips' ? 'active' : ''}`}
              onClick={() => setSection('trips')}
            >
              <Radio size={18} /> {t('admin.sidebar.itineraries')}
            </button>
            <button
              className={`admin-nav-item ${section === 'apiusage' ? 'active' : ''}`}
              onClick={() => setSection('apiusage')}
            >
              <Wifi size={18} /> {t('admin.sidebar.logs')}
            </button>
            <button
              className={`admin-nav-item ${section === 'payments' ? 'active' : ''}`}
              onClick={() => setSection('payments')}
            >
              <TrendingUp size={18} /> {t('admin.sidebar.payments')}
            </button>
            <button
              className={`admin-nav-item ${section === 'plans' ? 'active' : ''}`}
              onClick={() => setSection('plans')}
            >
              <CreditCard size={18} /> Plans &amp; Billing
            </button>
            <button
              className={`admin-nav-item ${section === 'prompts' ? 'active' : ''}`}
              onClick={() => setSection('prompts')}
            >
              <BookOpen size={18} /> {t('admin.sidebar.prompts')}
            </button>
            <button
              className={`admin-nav-item ${section === 'notifications' ? 'active' : ''}`}
              onClick={() => setSection('notifications')}
            >
              <Bell size={18} /> {t('admin.sidebar.notifications')}
            </button>
          </nav>
          <button className="admin-back" onClick={() => navigate('/')}>
            <ArrowLeft size={14} /> {t('back')}
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
            <Overview stats={stats} online={online} analytics={analytics} />
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
              headers={headers}
              toast={toast}
              confirm={confirm}
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

          {section === 'payments' && (
            <PaymentsSection
              data={payments}
              onPage={(p) => setPayments((prev) => ({ ...prev, page: p }))}
            />
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

          {section === 'notifications' && (
            <NotificationsSection
              headers={headers}
              toast={toast}
              confirm={confirm}
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

const Overview = ({ stats, online, analytics }) => {
  const { t } = useTranslation();
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  // Prepare data for the growth chart by merging user and trip growth arrays.
  const growthData = useMemo(() => {
    if (!analytics?.userGrowth || !analytics?.tripGrowth) return [];
    const dates = new Set([
      ...analytics.userGrowth.map(u => u._id),
      ...analytics.tripGrowth.map(t => t._id)
    ]);
    return Array.from(dates).sort().map(date => ({
      name: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      users: analytics.userGrowth.find(u => u._id === date)?.count || 0,
      trips: analytics.tripGrowth.find(t => t._id === date)?.count || 0
    }));
  }, [analytics]);

  const revenueData = useMemo(() => {
    if (!analytics?.revenueGrowth) return [];
    return analytics.revenueGrowth.map(item => ({
      name: new Date(item._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: item.total
    }));
  }, [analytics]);

  const currentPlansData = useMemo(() => {
    if (!analytics?.currentPlans) return [];
    const mapped = analytics.currentPlans.map(item => {
      const label = item._id ? String(item._id) : 'Free';
      return {
        name: label.charAt(0).toUpperCase() + label.slice(1),
        value: item.count
      };
    });
    // Aggregate by name in case of duplicates (e.g. "free" vs null)
    const aggregated = mapped.reduce((acc, curr) => {
      const existing = acc.find(x => x.name === curr.name);
      if (existing) {
        existing.value += curr.value;
      } else {
        acc.push(curr);
      }
      return acc;
    }, []);
    return aggregated;
  }, [analytics]);

  const pieData = useMemo(() => {
    if (!analytics?.postDistribution) return [];
    return analytics.postDistribution.map(item => ({
      name: item._id,
      value: item.count
    }));
  }, [analytics]);

  const totalRevenue = useMemo(() => {
    if (!analytics?.revenueGrowth) return 0;
    return analytics.revenueGrowth.reduce((acc, curr) => acc + curr.total, 0);
  }, [analytics]);

  return (
    <div className="admin-overview">
      <div className="stat-grid">
        <StatCard label={t('admin.overview.totalUsers')} value={stats.users} sub={`${stats.admins} admin · ${stats.disabled} disabled`} />
        <StatCard label={t('admin.sidebar.online')} value={online.counts.onlineUsers} sub={`${online.counts.guests} guests · ${online.counts.totalSockets} sockets`} highlight />
        <StatCard label={t('admin.overview.revenue')} value={`$${totalRevenue.toFixed(2)}`} sub={`${analytics?.planPurchases?.length || 0} sales`} />
        <StatCard label={t('admin.sidebar.chathubs')} value={stats.rooms} sub={`${stats.totalMessages} messages`} />
        <StatCard label={t('admin.sidebar.livemap')} value={stats.livePosts} />
      </div>

      <div className="analytics-grid">
        <div className="admin-card chart-card revenue-chart">
          <header className="card-header">
            <CreditCard size={18} />
            <h3>Revenue Growth (30d)</h3>
          </header>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip 
                  formatter={(value) => [`$${value.toFixed(2)}`, 'Revenue']}
                  contentStyle={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-card chart-card plans-chart">
          <header className="card-header">
            <Users size={18} />
            <h3>Current Plan Mix</h3>
          </header>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={currentPlansData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {currentPlansData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="analytics-grid second-row">
        <div className="admin-card chart-card growth-chart">
          <header className="card-header">
            <TrendingUp size={18} />
            <h3>Engagement Growth (30d)</h3>
          </header>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTrips" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="users" stroke="#6366f1" fillOpacity={1} fill="url(#colorUsers)" />
                <Area type="monotone" dataKey="trips" stroke="#10b981" fillOpacity={1} fill="url(#colorTrips)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-card chart-card distribution-chart">
          <header className="card-header">
            <PieChart size={18} />
            <h3>Post Categories</h3>
          </header>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub, highlight }) => (
  <div className={`stat-card ${highlight ? 'is-highlight' : ''}`}>
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
    {sub && <span className="stat-sub">{sub}</span>}
  </div>
);

const UsersSection = ({ data, query, onQuery, onPage, onToggleAdmin, onToggleDisabled, onDelete, onResetPassword, currentUserId }) => {
  const { t } = useTranslation();
  return (
    <section className="admin-section">
    <div className="section-toolbar">
      <div className="search-input">
        <Search size={14} />
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t('admin.users.searchPlaceholder')}
        />
      </div>
      <span className="muted">{data.total} total</span>
    </div>
    <div className="table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('admin.users.table.user')}</th>
            <th>Status</th>
            <th>IP</th>
            <th>Last seen</th>
            <th>Logins</th>
            <th>{t('admin.sidebar.itineraries')}</th>
            <th className="col-actions">{t('admin.users.table.actions')}</th>
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
};

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

const LivePostsSection = ({ headers, toast, confirm }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/admin/liveposts`, { headers });
      setPosts(res.data.items || []);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();

    const onNew = (post) => {
      if (!post?._id) return;
      setPosts((prev) => {
        const without = prev.filter((p) => String(p._id) !== String(post._id));
        return [post, ...without];
      });
    };
    const onDeleteEvent = ({ _id } = {}) => {
      if (!_id) return;
      setPosts((prev) => prev.filter((p) => String(p._id) !== String(_id)));
    };

    socket.on('livemap:new_post', onNew);
    socket.on('livemap:delete_post', onDeleteEvent);
    return () => {
      socket.off('livemap:new_post', onNew);
      socket.off('livemap:delete_post', onDeleteEvent);
    };
  }, [headers]);

  const handleDelete = async (id) => {
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

  return (
    <section className="admin-section">
      <div className="section-toolbar">
        <span className="muted">
          {loading ? 'Refreshing...' : `${posts.length} posts · live updates`}
        </span>
        <button type="button" className="btn-secondary" onClick={fetchPosts} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>
      <div className="post-grid">
        {posts.map((p) => (
          <article key={p._id} className="post-card">
            <header>
              <strong>{p.author || 'Anonymous'}</strong>
              <span className="muted">{fmtRelative(p.createdAt)}</span>
            </header>
            <div className="post-meta">
              {p.type && (
                <span className={`pill pill-${p.sentiment === 'negative' ? 'danger' : p.sentiment === 'positive' ? 'admin' : 'warn'}`}>
                  {p.type}
                </span>
              )}
              <span className="muted">▲ {p.upvotes || 0}</span>
            </div>
            <p>{p.message || ''}</p>
            {p.location && (
              <span className="muted">
                📍 {p.location.name || `${p.location.lat?.toFixed(2)}, ${p.location.lon?.toFixed(2)}`}
              </span>
            )}
            <button className="icon-btn danger post-delete" onClick={() => handleDelete(p._id)}>
              <Trash2 size={14} /> Delete
            </button>
          </article>
        ))}
        {posts.length === 0 && !loading && <p className="muted">No live posts.</p>}
      </div>
    </section>
  );
};

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

const NotificationsSection = ({ headers, toast, confirm }) => {
  const [form, setForm] = useState({ title: '', message: '', type: 'all', recipients: [], link: '', expiresAt: '' });
  const [busy, setBusy] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [foundUsers, setFoundUsers] = useState([]);
  const [allNotifications, setAllNotifications] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const fetchAll = async () => {
    try {
      setLoadingList(true);
      const res = await axios.get(`${API}/api/notifications/admin`, { headers });
      setAllNotifications(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [headers]);

  useEffect(() => {
    if (userQuery.length < 2) {
      setFoundUsers([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/api/admin/users`, {
          headers,
          params: { q: userQuery, limit: 10 }
        });
        setFoundUsers(res.data.items);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [userQuery, headers]);

  const toggleRecipient = (u) => {
    setForm(prev => {
      const exists = prev.recipients.find(r => r._id === u._id);
      if (exists) {
        return { ...prev, recipients: prev.recipients.filter(r => r._id !== u._id) };
      }
      return { ...prev, recipients: [...prev.recipients, u] };
    });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.title || !form.message) return toast.error('Title and message are required.');

    const ok = await confirm({
      title: 'Send Notification?',
      message: `This will be sent to ${form.type === 'all' ? 'ALL registered users' : `${form.recipients.length} selected users`}.`,
      confirmLabel: 'Send now',
      variant: 'default'
    });
    if (!ok) return;

    try {
      setBusy(true);
      await axios.post(`${API}/api/notifications/admin`, {
        ...form,
        recipients: form.recipients.map(r => r._id),
        expiresAt: form.expiresAt ? new Date(form.expiresAt) : null
      }, { headers });
      toast.success('Notification sent successfully!');
      setForm({ title: '', message: '', type: 'all', recipients: [], link: '', expiresAt: '' });
      setUserQuery('');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteNoti = async (id) => {
    const ok = await confirm({
      title: 'Delete Notification?',
      message: 'This notification will be removed from all users.',
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      await axios.delete(`${API}/api/notifications/${id}`, { headers });
      toast.success('Notification deleted.');
      setAllNotifications(prev => prev.filter(n => n._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  return (
    <section className="admin-section">
      <div className="admin-card noti-form-card">
        <header className="card-header">
          <Bell size={18} />
          <h3>Broadcast Notification</h3>
        </header>
        <form className="noti-admin-form" onSubmit={handleSend}>
          <div className="noti-form-row">
            <div className="form-group flex-2">
              <label>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="System Update, Special Offer, etc."
                required
              />
            </div>
            <div className="form-group flex-1">
              <label>Expires At (optional)</label>
              <div className="custom-date-input">
                <Calendar size={16} />
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>Message</label>
            <textarea
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              placeholder="Enter the notification content..."
              required
            />
          </div>
          <div className="form-group">
            <label>Target Link (optional)</label>
            <input
              type="text"
              value={form.link}
              onChange={e => setForm({ ...form, link: e.target.value })}
              placeholder="https://travio.com/worldcup"
            />
          </div>

          <div className="form-group">
            <label>Target Audience</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="type"
                  checked={form.type === 'all'}
                  onChange={() => setForm({ ...form, type: 'all' })}
                />
                All Users
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="type"
                  checked={form.type === 'specific'}
                  onChange={() => setForm({ ...form, type: 'specific' })}
                />
                Specific Users
              </label>
            </div>
          </div>

          {form.type === 'specific' && (
            <div className="specific-users-zone">
              <div className="search-recipients">
                <Search size={14} />
                <input
                  type="text"
                  value={userQuery}
                  onChange={e => setUserQuery(e.target.value)}
                  placeholder="Search users to add..."
                />
              </div>
              
              {foundUsers.length > 0 && (
                <div className="found-users-list">
                  {foundUsers.map(u => (
                    <button type="button" key={u._id} onClick={() => toggleRecipient(u)} className="found-user-item">
                      {u.email} {form.recipients.find(r => r._id === u._id) ? <Check size={12} /> : '+'}
                    </button>
                  ))}
                </div>
              )}

              <div className="selected-recipients">
                <label>Selected ({form.recipients.length}):</label>
                <div className="recipients-tags">
                  {form.recipients.map(r => (
                    <span key={r._id} className="recipient-tag">
                      {r.email}
                      <button type="button" onClick={() => toggleRecipient(r)}><X size={10} /></button>
                    </span>
                  ))}
                  {form.recipients.length === 0 && <span className="muted">No users selected.</span>}
                </div>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <RefreshCw size={14} className="spin" /> : <Bell size={14} />}
              {busy ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card history-card" style={{ marginTop: '30px' }}>
        <header className="card-header">
          <Clock size={18} />
          <h3>Sent Notifications</h3>
        </header>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Notification</th>
                <th>Audience</th>
                <th>Expiry</th>
                <th>Date</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allNotifications.map((n) => (
                <tr key={n._id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '0.85rem' }}>{n.title}</strong>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{n.message.slice(0, 40)}...</p>
                    </div>
                  </td>
                  <td>
                    {n.type === 'all' ? (
                      <span className="pill pill-admin">All Users</span>
                    ) : (
                      <span className="pill pill-warn">{n.recipients?.length || 0} Users</span>
                    )}
                  </td>
                  <td>
                    {n.expiresAt ? (
                      <span style={{ fontSize: '0.75rem', color: new Date(n.expiresAt) < new Date() ? '#f87171' : 'var(--text-muted)' }}>
                        {new Date(n.expiresAt) < new Date() ? 'Expired' : fmtDate(n.expiresAt)}
                      </span>
                    ) : 'Never'}
                  </td>
                  <td style={{ fontSize: '0.75rem' }}>{fmtDate(n.createdAt)}</td>
                  <td className="col-actions">
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Delete Notification"
                      onClick={() => deleteNoti(n._id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {allNotifications.length === 0 && !loadingList && (
                <tr><td colSpan={5} className="empty-row">No notifications sent yet.</td></tr>
              )}
              {loadingList && (
                <tr><td colSpan={5} className="empty-row">Loading notifications...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

// =========================================================================
// Payments Section
// =========================================================================

const PaymentsSection = ({ data, onPage }) => {
  const totalPages = Math.ceil(data.total / (data.limit || 20));

  return (
    <section className="admin-section">
      <div className="section-toolbar">
        <span className="muted">{data.total} total transactions</span>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Period End</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item._id}>
                <td>{fmtDate(item.createdAt)}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>{item.userName}</strong>
                    <small className="muted">{item.userEmail}</small>
                  </div>
                </td>
                <td><span className={`pill pill-${item.plan}`}>{item.plan}</span></td>
                <td>
                  <strong>{item.amount} {item.currency}</strong>
                </td>
                <td><span className="pill pill-admin">{item.provider}</span></td>
                <td>
                  <span className={`pill pill-${item.status === 'completed' ? 'admin' : 'warn'}`}>
                    {item.status}
                  </span>
                </td>
                <td>{fmtDate(item.periodEnd)}</td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr><td colSpan={7} className="empty-row">No payment history found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className="btn-secondary"
            disabled={data.page <= 1}
            onClick={() => onPage(data.page - 1)}
          >
            Previous
          </button>
          <span className="page-info">Page {data.page} of {totalPages}</span>
          <button
            type="button"
            className="btn-secondary"
            disabled={data.page >= totalPages}
            onClick={() => onPage(data.page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
};

export default Admin;
