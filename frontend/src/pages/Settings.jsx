import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Lock, CreditCard, Trash2, Save, ShieldCheck } from 'lucide-react';
import useTripStore from '../stores/tripStore';
import { useToast } from '../components/UI/Toast';
import { useConfirm } from '../components/UI/ConfirmDialog';
import './Settings.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Settings = () => {
  const { user, token, setUser, setSubscription, logout } = useTripStore();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({ name: '', bio: '', preferredCurrency: 'USD', interests: '' });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    axios.get(`${API}/api/settings/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        setForm({
          name: data.name || '',
          bio: data.profile?.bio || '',
          preferredCurrency: data.profile?.preferredCurrency || 'USD',
          interests: (data.profile?.interests || []).join(', ')
        });
        setSubscription(data.subscription);
      })
      .catch(() => toast.error('Could not load your settings'));
  }, [token, navigate, setSubscription, toast]);

  const saveProfile = async () => {
    setBusy(true);
    try {
      const { data } = await axios.patch(
        `${API}/api/settings/profile`,
        {
          name: form.name,
          profile: {
            bio: form.bio,
            preferredCurrency: form.preferredCurrency,
            interests: form.interests.split(',').map((s) => s.trim()).filter(Boolean)
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUser({ ...user, name: data.name, subscription: data.subscription });
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save profile');
    } finally { setBusy(false); }
  };

  const changePassword = async () => {
    if (pwd.newPassword !== pwd.confirm) { toast.error('Passwords do not match'); return; }
    if (pwd.newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setBusy(true);
    try {
      await axios.post(
        `${API}/api/settings/password`,
        { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Password changed');
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not change password');
    } finally { setBusy(false); }
  };

  const deleteAccount = async () => {
    const ok = await confirm({
      title: 'Delete account?',
      message: 'This will permanently remove your account, your trips, and your hub memberships. This cannot be undone.',
      confirmLabel: 'Delete forever',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await axios.delete(`${API}/api/settings/account`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Your account has been deleted');
      logout();
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete account');
    }
  };

  const sub = user?.subscription;

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>Settings</h1>
        <p>Manage your profile, password, subscription and account.</p>
        {user?.isAdmin && (
          <Link to="/admin" className="admin-shortcut">
            <ShieldCheck size={14} /> Open Admin Console
          </Link>
        )}
      </header>

      <div className="settings-layout">
        <nav className="settings-tabs">
          <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><User size={16}/> Profile</button>
          <button className={tab === 'password' ? 'active' : ''} onClick={() => setTab('password')}><Lock size={16}/> Password</button>
          <button className={tab === 'subscription' ? 'active' : ''} onClick={() => setTab('subscription')}><CreditCard size={16}/> Subscription</button>
          <button className={`danger ${tab === 'danger' ? 'active' : ''}`} onClick={() => setTab('danger')}><Trash2 size={16}/> Danger zone</button>
        </nav>

        <section className="settings-panel">
          {tab === 'profile' && (
            <div>
              <h2>Profile</h2>
              <label>Name
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>Email
                <input value={user?.email || ''} disabled />
              </label>
              <label>Bio
                <textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </label>
              <label>Preferred currency
                <select value={form.preferredCurrency} onChange={(e) => setForm({ ...form, preferredCurrency: e.target.value })}>
                  {['USD', 'EUR', 'GBP', 'MAD', 'JPY', 'CAD', 'AUD'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>Interests (comma separated)
                <input value={form.interests} onChange={(e) => setForm({ ...form, interests: e.target.value })} />
              </label>
              <button className="btn-primary" onClick={saveProfile} disabled={busy}>
                <Save size={14}/> Save profile
              </button>
            </div>
          )}

          {tab === 'password' && (
            <div>
              <h2>Change password</h2>
              <label>Current password
                <input type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} />
              </label>
              <label>New password
                <input type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} />
              </label>
              <label>Confirm new password
                <input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
              </label>
              <button className="btn-primary" onClick={changePassword} disabled={busy}>
                <Lock size={14}/> Update password
              </button>
            </div>
          )}

          {tab === 'subscription' && (
            <div>
              <h2>Subscription</h2>
              {sub ? (
                <div className="sub-snapshot">
                  <div><span>Current plan</span><strong className="cap">{sub.plan}</strong></div>
                  <div><span>Effective access</span><strong className="cap">{sub.effectivePlan}</strong></div>
                  <div><span>Renews / expires</span><strong>{sub.planExpiresAt ? new Date(sub.planExpiresAt).toLocaleDateString() : '—'}</strong></div>
                  <div><span>Free trips remaining</span><strong>{sub.freeTripsRemaining} / {sub.trialLimit}</strong></div>
                </div>
              ) : <p>No subscription info available.</p>}
              <Link to="/billing" className="btn-primary linkish">
                <CreditCard size={14}/> Manage billing
              </Link>
            </div>
          )}

          {tab === 'danger' && (
            <div>
              <h2 className="danger-title">Danger zone</h2>
              <p>Deleting your account is permanent. Your trips, posts and hub memberships will be removed.</p>
              <button className="btn-danger" onClick={deleteAccount} disabled={user?.isAdmin}>
                <Trash2 size={14}/> Delete my account
              </button>
              {user?.isAdmin && (
                <p className="hint">Admins cannot self-delete from here. Demote yourself first or use the database directly.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Settings;
