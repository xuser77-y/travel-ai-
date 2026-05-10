import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Lock, CreditCard, Trash2, Save, ShieldCheck } from 'lucide-react';
import useTripStore from '../stores/tripStore';
import { useTranslation } from '../hooks/useTranslation';
import { useToast } from '../components/UI/Toast';
import { useConfirm } from '../components/UI/ConfirmDialog';
import './Settings.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Settings = () => {
  const { user, token, setUser, setSubscription, logout } = useTripStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
      .catch(() => toast.error(t('settings.loadError')));
  }, [token, navigate, setSubscription, toast, t]);

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
      toast.success(t('settings.saveSuccess'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('settings.saveError'));
    } finally { setBusy(false); }
  };

  const changePassword = async () => {
    if (pwd.newPassword !== pwd.confirm) { toast.error(t('settings.pwdMatchError')); return; }
    if (pwd.newPassword.length < 6) { toast.error(t('settings.pwdLengthError')); return; }
    setBusy(true);
    try {
      await axios.post(
        `${API}/api/settings/password`,
        { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t('settings.pwdSuccess'));
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || t('settings.pwdError'));
    } finally { setBusy(false); }
  };

  const deleteAccount = async () => {
    const ok = await confirm({
      title: t('settings.delTitle'),
      message: t('settings.delMsg'),
      confirmLabel: t('settings.delConfirm'),
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await axios.delete(`${API}/api/settings/account`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(t('settings.delSuccess'));
      logout();
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || t('settings.delError'));
    }
  };

  const sub = user?.subscription;

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.subtitle')}</p>
        {user?.isAdmin && (
          <Link to="/admin" className="admin-shortcut">
            <ShieldCheck size={14} /> {t('settings.adminShortcut')}
          </Link>
        )}
      </header>

      <div className="settings-layout">
        <nav className="settings-tabs">
          <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><User size={16}/> {t('settings.tabProfile')}</button>
          <button className={tab === 'password' ? 'active' : ''} onClick={() => setTab('password')}><Lock size={16}/> {t('settings.tabPassword')}</button>
          <button className={tab === 'subscription' ? 'active' : ''} onClick={() => setTab('subscription')}><CreditCard size={16}/> {t('settings.tabSubscription')}</button>
          <button className={`danger ${tab === 'danger' ? 'active' : ''}`} onClick={() => setTab('danger')}><Trash2 size={16}/> {t('settings.tabDanger')}</button>
        </nav>

        <section className="settings-panel">
          {tab === 'profile' && (
            <div>
              <h2>{t('settings.tabProfile')}</h2>
              <label>{t('settings.name')}
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>{t('settings.email')}
                <input value={user?.email || ''} disabled />
              </label>
              <label>{t('settings.bio')}
                <textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </label>
              <label>{t('settings.currency')}
                <select value={form.preferredCurrency} onChange={(e) => setForm({ ...form, preferredCurrency: e.target.value })}>
                  {['USD', 'EUR', 'GBP', 'MAD', 'JPY', 'CAD', 'AUD'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>{t('settings.interests')}
                <input value={form.interests} onChange={(e) => setForm({ ...form, interests: e.target.value })} />
              </label>
              <button className="btn-primary" onClick={saveProfile} disabled={busy}>
                <Save size={14}/> {t('settings.saveBtn')}
              </button>
            </div>
          )}

          {tab === 'password' && (
            <div>
              <h2>{t('settings.changePwd')}</h2>
              <label>{t('settings.currentPwd')}
                <input type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} />
              </label>
              <label>{t('settings.newPwd')}
                <input type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} />
              </label>
              <label>{t('settings.confirmPwd')}
                <input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
              </label>
              <button className="btn-primary" onClick={changePassword} disabled={busy}>
                <Lock size={14}/> {t('settings.updatePwdBtn')}
              </button>
            </div>
          )}

          {tab === 'subscription' && (
            <div>
              <h2>{t('settings.subSnapshot')}</h2>
              {sub ? (
                <div className="sub-snapshot">
                  <div><span>{t('settings.currentPlan')}</span><strong className="cap">{sub.plan}</strong></div>
                  <div><span>{t('settings.effectiveAccess')}</span><strong className="cap">{sub.effectivePlan}</strong></div>
                  <div><span>{t('settings.renewsExpires')}</span><strong>{sub.planExpiresAt ? new Date(sub.planExpiresAt).toLocaleDateString() : '—'}</strong></div>
                  <div><span>{t('settings.freeTrips')}</span><strong>{sub.freeTripsRemaining} / {sub.trialLimit}</strong></div>
                </div>
              ) : <p>{t('settings.noSub')}</p>}
              <Link to="/billing" className="btn-primary linkish">
                <CreditCard size={14}/> {t('settings.manageBilling')}
              </Link>
            </div>
          )}

          {tab === 'danger' && (
            <div>
              <h2 className="danger-title">{t('settings.dangerTitle')}</h2>
              <p>{t('settings.dangerDesc')}</p>
              <button className="btn-danger" onClick={deleteAccount} disabled={user?.isAdmin}>
                <Trash2 size={14}/> {t('settings.delBtn')}
              </button>
              {user?.isAdmin && (
                <p className="hint">{t('settings.adminHint')}</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Settings;
