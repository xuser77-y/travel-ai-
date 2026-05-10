import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Save, RefreshCw, Star, Check } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import './AdminPlans.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AdminPlans = ({ token, toast }) => {
  const { t } = useTranslation();
  const headers = { Authorization: `Bearer ${token}` };

  const [plans, setPlans] = useState([]);
  const [edits, setEdits] = useState({});
  const [featureCatalog, setFeatureCatalog] = useState({});
  const [allFeatures, setAllFeatures] = useState([]);
  const [busy, setBusy] = useState(false);
  const [paymentCfg, setPaymentCfg] = useState({ provider: 'mock', stripeAvailable: false });

  const [userQuery, setUserQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [grantTarget, setGrantTarget] = useState(null);
  const [grant, setGrant] = useState({ plan: 'basic', days: 30, trials: 3 });

  const load = async () => {
    setBusy(true);
    try {
      const [{ data }, { data: pub }, { data: cfg }] = await Promise.all([
        axios.get(`${API}/api/admin/plans`, { headers }),
        axios.get(`${API}/api/payments/plans`),
        axios.get(`${API}/api/admin/payment-config`, { headers })
      ]);
      setPlans(data.plans || []);
      setFeatureCatalog(pub.features || {});
      setAllFeatures(pub.allFeatures || Object.keys(pub.features || {}));
      setPaymentCfg(cfg);
      const e = {};
      (data.plans || []).forEach((p) => {
        e[p.id] = {
          priceMonthly: p.priceMonthly || 0,
          currency: p.currency || 'USD',
          name: p.name || '',
          description: p.description || '',
          features: [...(p.features || [])],
          highlight: !!p.highlight
        };
      });
      setEdits(e);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally { setBusy(false); }
  };

  const toggleFeature = (planId, featureId) => {
    setEdits((prev) => {
      const cur = prev[planId] || {};
      const has = (cur.features || []).includes(featureId);
      const next = has
        ? (cur.features || []).filter((f) => f !== featureId)
        : [...(cur.features || []), featureId];
      return { ...prev, [planId]: { ...cur, features: next } };
    });
  };

  const setProvider = async (provider) => {
    try {
      const { data } = await axios.patch(
        `${API}/api/admin/payment-config`,
        { provider },
        { headers }
      );
      setPaymentCfg((cur) => ({ ...cur, provider: data.provider }));
      toast.success(`Active provider: ${data.provider}`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const savePlan = async (id) => {
    setBusy(true);
    try {
      await axios.patch(`${API}/api/admin/plans/${id}`, edits[id], { headers });
      toast.success(`${id} updated`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally { setBusy(false); }
  };

  const searchUsers = async (q) => {
    setUserQuery(q);
    if (!q.trim()) { setMatches([]); return; }
    try {
      const { data } = await axios.get(`${API}/api/admin/users`, {
        headers, params: { q, limit: 5 }
      });
      setMatches(data.items || []);
    } catch (_) { /* ignore */ }
  };

  const grantPlan = async () => {
    if (!grantTarget) return;
    try {
      await axios.post(
        `${API}/api/admin/users/${grantTarget._id}/grant-plan`,
        { plan: grant.plan, days: Number(grant.days) || 30 },
        { headers }
      );
      toast.success(`Granted ${grant.plan} to ${grantTarget.email} for ${grant.days} days`);
      setGrantTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const revokeTrial = async () => {
    if (!grantTarget) return;
    try {
      const { data } = await axios.post(
        `${API}/api/admin/users/${grantTarget._id}/revoke-trial`,
        {},
        { headers }
      );
      toast.success(`Trial revoked for ${grantTarget.email} (${data.freeTripsUsed}/${data.trialLimit} used)`);
      setGrantTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const grantTrials = async () => {
    if (!grantTarget) return;
    try {
      const { data } = await axios.post(
        `${API}/api/admin/users/${grantTarget._id}/grant-trials`,
        { count: Number(grant.trials) || 1 },
        { headers }
      );
      toast.success(`+${grant.trials} trials → user now has ${data.trialLimit - data.freeTripsUsed} remaining`);
      setGrantTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const expirePlan = async () => {
    if (!grantTarget) return;
    try {
      await axios.post(`${API}/api/admin/users/${grantTarget._id}/expire-plan`, {}, { headers });
      toast.success(`${grantTarget.email} reverted to free`);
      setGrantTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="admin-plans">
      <section className="admin-card">
        <header className="admin-card-header">
          <h3>{t('adminPlans.title')}</h3>
        </header>
        <div className="provider-toggle">
          <button
            className={`provider-btn ${paymentCfg.provider === 'mock' ? 'active' : ''}`}
            onClick={() => setProvider('mock')}
          >
            <span className="dot" /> {t('adminPlans.providerMock')}
          </button>
          <button
            className={`provider-btn ${paymentCfg.provider === 'stripe' ? 'active' : ''}`}
            onClick={() => setProvider('stripe')}
            disabled={!paymentCfg.stripeAvailable}
            title={!paymentCfg.stripeAvailable ? 'Set STRIPE_SECRET_KEY first' : ''}
          >
            <span className="dot" /> {t('adminPlans.providerStripe')}
          </button>
        </div>
      </section>

      <section className="admin-card">
        <header className="admin-card-header">
          <h3>{t('adminPlans.plansTitle')}</h3>
          <button className="admin-btn-ghost" onClick={load} disabled={busy}>
            <RefreshCw size={14} className={busy ? 'spin' : ''} /> {t('admin.common.refresh')}
          </button>
        </header>
        <p className="admin-help">
          {t('adminPlans.help')}
        </p>

        <div className="plan-editors">
          {plans.map((p) => {
            const e = edits[p.id] || {};
            const isFree = p.id === 'free';
            return (
              <article key={p.id} className={`plan-editor ${e.highlight ? 'is-highlight' : ''}`}>
                <header className="plan-editor-head">
                  <span className="plan-id">{p.id}</span>
                  <label className="highlight-toggle" title="Show 'Most Popular' badge">
                    <input
                      type="checkbox"
                      checked={!!e.highlight}
                      onChange={(ev) => setEdits({ ...edits, [p.id]: { ...e, highlight: ev.target.checked } })}
                    />
                    <Star size={12} /> {t('adminPlans.highlight')}
                  </label>
                </header>

                <div className="plan-editor-row">
                  <label>
                    <span>{t('adminPlans.displayName')}</span>
                    <input
                      value={e.name ?? ''}
                      onChange={(ev) => setEdits({ ...edits, [p.id]: { ...e, name: ev.target.value } })}
                    />
                  </label>
                  <label>
                    <span>{t('adminPlans.priceMonth')}</span>
                    <input
                      type="number" min="0" step="0.01"
                      disabled={isFree}
                      value={e.priceMonthly ?? 0}
                      onChange={(ev) => setEdits({ ...edits, [p.id]: { ...e, priceMonthly: Number(ev.target.value) } })}
                    />
                  </label>
                  <label className="narrow">
                    <span>{t('adminPlans.currency')}</span>
                    <input
                      value={e.currency ?? 'USD'}
                      onChange={(ev) => setEdits({ ...edits, [p.id]: { ...e, currency: ev.target.value.toUpperCase() } })}
                    />
                  </label>
                </div>

                <label className="full-width">
                  <span>{t('adminPlans.description')}</span>
                  <input
                    value={e.description ?? ''}
                    onChange={(ev) => setEdits({ ...edits, [p.id]: { ...e, description: ev.target.value } })}
                  />
                </label>

                <div className="feature-grid">
                  <div className="feature-grid-title">
                    <Check size={12} /> {t('adminPlans.features')}
                  </div>
                  <div className="feature-checks">
                    {allFeatures.map((f) => {
                      const checked = (e.features || []).includes(f);
                      return (
                        <label key={f} className={`feature-check ${checked ? 'on' : 'off'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFeature(p.id, f)}
                          />
                          <span className="feature-label">{featureCatalog[f] || f}</span>
                          <span className="feature-flag">{checked ? 'Yes' : 'No'}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <footer className="plan-editor-foot">
                  <button className="admin-btn-primary" onClick={() => savePlan(p.id)} disabled={busy}>
                    <Save size={14}/> {t('adminPlans.save')}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      </section>

      <section className="admin-card">
        <header className="admin-card-header">
          <h3>{t('adminPlans.grantTitle')}</h3>
        </header>
        <div className="grant-grid">
          <div>
            <label>{t('adminPlans.findUser')}</label>
            <input
              value={userQuery}
              onChange={(e) => searchUsers(e.target.value)}
              placeholder="..."
            />
            <ul className="search-results">
              {matches.map((m) => (
                <li key={m._id}>
                  <button
                    className={`pick ${grantTarget?._id === m._id ? 'active' : ''}`}
                    onClick={() => setGrantTarget(m)}
                  >
                    <strong>{m.email}</strong>
                    <small>{m.name} · {m.plan || 'free'} · trials {m.freeTripsUsed || 0}/{m.trialLimit || 0}</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label>{t('adminPlans.grantPlan')}</label>
            <div className="grant-row">
              <select value={grant.plan} onChange={(e) => setGrant({ ...grant, plan: e.target.value })}>
                <option value="basic">basic</option>
                <option value="pro">pro</option>
                <option value="premium">premium</option>
              </select>
              <input
                type="number" min="1" max="365"
                value={grant.days}
                onChange={(e) => setGrant({ ...grant, days: e.target.value })}
                style={{ width: 80 }}
              />
              <span>days</span>
              <button className="admin-btn-primary" disabled={!grantTarget} onClick={grantPlan}>
                {t('adminPlans.grantBtn')}
              </button>
            </div>

            <label style={{ marginTop: 14 }}>{t('adminPlans.grantTrials')}</label>
            <div className="grant-row">
              <input
                type="number" min="1"
                value={grant.trials}
                onChange={(e) => setGrant({ ...grant, trials: e.target.value })}
                style={{ width: 80 }}
              />
              <button className="admin-btn-primary" disabled={!grantTarget} onClick={grantTrials}>
                {t('adminPlans.addTrials')}
              </button>
              <button className="admin-btn-danger" disabled={!grantTarget} onClick={revokeTrial}>
                {t('adminPlans.revokeTrial')}
              </button>
              <button className="admin-btn-danger" disabled={!grantTarget} onClick={expirePlan}>
                {t('adminPlans.forceExpire')}
              </button>
            </div>
            {grantTarget && (
              <p className="grant-target">
                Target: <strong>{grantTarget.email}</strong> ({grantTarget.plan || 'free'})
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminPlans;
