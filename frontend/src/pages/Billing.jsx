import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Check, X, Sparkles, ShieldCheck, Crown, Star, Download, Loader2, FileText, CreditCard } from 'lucide-react';
import useTripStore from '../stores/tripStore';
import { useToast } from '../components/UI/Toast';
import { fetchAndDownloadReceipt } from '../lib/receiptPdf';
import PaymentSuccessModal from '../components/Billing/PaymentSuccessModal';
import './Billing.css';

const API = 'http://localhost:5000';

// Plan-card icons. The labels for features come from the server now
// (`/api/payments/plans` returns `features` map) so the Billing page never
// drifts from what the admin checked in the dashboard.
const PLAN_ICONS = {
  free: <ShieldCheck size={22} />,
  basic: <Star size={22} />,
  pro: <Sparkles size={22} />,
  premium: <Crown size={22} />
};

// One pricing card. Buying flips the same `/api/payments/checkout` endpoint
// for every paid tier; on success we hand the resulting historyId back up
// so the parent can immediately offer a printable receipt.
const PlanCard = ({ plan, current, allFeatures, featureLabels, onBuy, busyId, currency }) => {
  const isCurrent = current === plan.id;
  const isFree = plan.id === 'free';
  const isBusy = busyId === plan.id;
  const planFeatures = new Set(plan.features || []);

  return (
    <div className={`plan-card ${plan.highlight ? 'highlight' : ''} ${isCurrent ? 'current' : ''}`}>
      {plan.highlight && <span className="plan-badge">Most Popular</span>}
      {isCurrent && <span className="plan-badge current-badge">Your Plan</span>}
      <div className="plan-icon">{PLAN_ICONS[plan.id] || <Sparkles size={22} />}</div>
      <h3>{plan.name}</h3>
      <div className="plan-price">
        {isFree ? (
          <span className="amount">Free</span>
        ) : plan.priceMonthly > 0 ? (
          <>
            <span className="currency">{plan.currency || currency}</span>
            <span className="amount">{plan.priceMonthly}</span>
            <span className="period">/ month</span>
          </>
        ) : (
          <span className="amount tbd">Price TBD</span>
        )}
      </div>
      {plan.description && <p className="plan-desc">{plan.description}</p>}

      {/* Full feature list with yes / no flags. The whole list is rendered
          for every tier so the user can compare at a glance — the admin
          checkboxes drive what shows as "yes" vs "no" here. */}
      <ul className="plan-features full">
        {allFeatures.map((f) => {
          const has = planFeatures.has(f);
          return (
            <li key={f} className={has ? 'yes' : 'no'}>
              {has ? <Check size={14} /> : <X size={14} />}
              <span>{featureLabels[f] || f}</span>
              <em className={`flag ${has ? 'flag-yes' : 'flag-no'}`}>{has ? 'Yes' : 'No'}</em>
            </li>
          );
        })}
      </ul>

      {!isFree && !isCurrent && (
        <button
          className="plan-select-btn primary"
          onClick={() => onBuy(plan)}
          disabled={!plan.priceMonthly || isBusy}
        >
          {isBusy
            ? <><Loader2 size={14} className="spin" /> Processing…</>
            : (plan.priceMonthly
                ? (
                    <>
                      {plan.provider === 'stripe' && <CreditCard size={14} />}
                      &nbsp;Buy {plan.name} — {plan.currency || currency} {plan.priceMonthly}
                    </>
                  )
                : 'Coming soon')}
        </button>
      )}
      {isCurrent && <div className="plan-current-note">Currently active</div>}
      {isFree && !isCurrent && <div className="plan-current-note">Default for new accounts</div>}
    </div>
  );
};

const Billing = () => {
  const { user, token, setSubscription } = useTripStore();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [featureLabels, setFeatureLabels] = useState({});
  const [allFeatures, setAllFeatures] = useState([]);
  const [provider, setProvider] = useState('mock');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  // React 18 StrictMode mounts effects twice in dev. Without this guard the
  // Stripe `finalize` effect below would fire twice, showing TWO success
  // modals / downloading two receipts. We dedupe by session_id so any
  // subsequent payment in the same tab still works.
  const processedSessionsRef = useRef(new Set());

  // Post-payment modal state — drives <PaymentSuccessModal />. We populate
  // `successInfo` after a confirmed payment (mock or Stripe) and the modal
  // gives the user the choice to download a real PDF receipt or skip.
  const [successInfo, setSuccessInfo] = useState(null); // { historyId, planName, amount }

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
  }, [token, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: planRes }, sub] = await Promise.all([
        axios.get(`${API}/api/payments/plans`),
        axios.get(`${API}/api/payments/subscription`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then((r) => r.data).catch(() => null)
      ]);
      // Each plan card needs to know which provider is active so its
      // "Buy" button can render the right CTA + icon.
      const activeProvider = planRes.provider || 'mock';
      setProvider(activeProvider);
      setPlans((planRes.plans || []).map((p) => ({ ...p, provider: activeProvider })));
      setFeatureLabels(planRes.features || {});
      setAllFeatures(planRes.allFeatures || Object.keys(planRes.features || {}));
      if (sub) setSubscription(sub);
    } catch (err) {
      toast.error('Could not load pricing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchAll(); /* eslint-disable-next-line */ }, [token]);

  // Stripe redirects back here after the hosted checkout. The query string
  // tells us whether the buyer paid (`stripe=success&session_id=cs_...`) or
  // backed out (`stripe=cancel`). For success we POST the session id to the
  // backend so it can verify with Stripe and grant the plan.
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(location.search);
    const stripeFlag = params.get('stripe');
    const sessionId = params.get('session_id');
    if (!stripeFlag) return;

    // Strip the query string so a refresh doesn't reprocess the session.
    const cleanUrl = () => navigate('/billing', { replace: true });

    if (stripeFlag === 'cancel') {
      toast.error('Stripe checkout cancelled.');
      cleanUrl();
      return;
    }
    if (stripeFlag === 'success' && sessionId) {
      // StrictMode dedupe — see ref declaration above.
      if (processedSessionsRef.current.has(sessionId)) {
        cleanUrl();
        return;
      }
      processedSessionsRef.current.add(sessionId);
      (async () => {
        try {
          const { data } = await axios.post(
            `${API}/api/payments/stripe/finalize`,
            { sessionId },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setSubscription(data.subscription);
          toast.success(
            data.alreadyProcessed
              ? 'Subscription already activated.'
              : 'Payment confirmed — subscription activated!'
          );
          // Show the success modal instead of auto-opening a receipt.
          // The user can choose to download the PDF or skip.
          setSuccessInfo({
            historyId: data.historyId,
            planName: data.planName || data.subscription?.plan || 'paid',
            amount: data.amountLabel || null
          });
          fetchAll();
        } catch (err) {
          toast.error(err.response?.data?.error || 'Could not finalize Stripe payment');
        } finally {
          cleanUrl();
        }
      })();
    }
    /* eslint-disable-next-line */
  }, [token, location.search]);

  // Buys the selected plan via whichever provider is active. The two
  // branches diverge here — mock completes server-side and shows the
  // receipt immediately; Stripe redirects to a hosted checkout and we
  // come back through the useEffect above to finalize.
  const buyPlan = async (plan) => {
    setBusyId(plan.id);
    try {
      if (provider === 'stripe') {
        const { data } = await axios.post(
          `${API}/api/payments/stripe/create-session`,
          { plan: plan.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!data.url) throw new Error('No checkout URL returned');
        window.location.href = data.url; // hand off to Stripe
        return;
      }
      // mock provider
      const { data } = await axios.post(
        `${API}/api/payments/checkout`,
        { plan: plan.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubscription(data.subscription);
      toast.success(`You're now on the ${plan.name} plan!`);
      setSuccessInfo({
        historyId: data.historyId,
        planName: plan.name,
        amount: plan.priceMonthly
          ? `${plan.currency || currency} ${plan.priceMonthly}`
          : null
      });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Checkout failed');
    } finally {
      setBusyId(null);
    }
  };

  // Direct PDF download for the history table — no modal, the user already
  // knows what they want. Errors surface as a toast.
  const downloadReceipt = async (historyId) => {
    try {
      await fetchAndDownloadReceipt(API, token, historyId);
    } catch (err) {
      console.error('Receipt error:', err);
      toast.error('Could not generate the receipt PDF.');
    }
  };

  // Used by the success modal's primary button. Same helper, but we let
  // the modal manage its own loading state so the button can show a spinner.
  const handleDownloadFromModal = async () => {
    if (!successInfo?.historyId) return;
    try {
      await fetchAndDownloadReceipt(API, token, successInfo.historyId);
    } catch (err) {
      console.error('Receipt error:', err);
      toast.error('Could not generate the receipt PDF.');
    }
  };

  const currentPlan = user?.subscription?.effectivePlan || user?.subscription?.plan || 'free';
  const currency = useMemo(
    () => plans.find((p) => p.id !== 'free')?.currency || 'USD',
    [plans]
  );

  return (
    <div className="billing-page">
      <header className="billing-header">
        <h1>Plans &amp; Billing</h1>
        <p>Pick the plan that matches how you travel. Cancel anytime — each charge covers exactly one month.</p>
        {user?.subscription?.plan === 'free' && (
          <div className="trial-banner">
            <strong>{user.subscription.freeTripsRemaining}</strong>
            &nbsp;of&nbsp;
            <strong>{user.subscription.trialLimit}</strong>
            &nbsp;free trips remaining
          </div>
        )}
        {user?.subscription?.plan !== 'free' && user?.subscription?.planExpiresAt && (
          <div className="trial-banner">
            Active until {new Date(user.subscription.planExpiresAt).toLocaleDateString()}
          </div>
        )}
      </header>

      {loading && <div className="billing-loading">Loading plans…</div>}

      {!loading && (
        <div className="plans-grid">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              current={currentPlan}
              allFeatures={allFeatures}
              featureLabels={featureLabels}
              onBuy={buyPlan}
              busyId={busyId}
              currency={currency}
            />
          ))}
        </div>
      )}

      <div className="sandbox-note">
        {provider === 'stripe' ? <CreditCard size={14} /> : <FileText size={14} />}
        <span>
          {provider === 'stripe' ? (
            <>
              <strong>Stripe test mode</strong> — you'll be redirected to
              Stripe's hosted checkout. Use the test card{' '}
              <code>4242 4242 4242 4242</code>, any future expiry, any CVC.
              No real money is charged.
            </>
          ) : (
            <>
              <strong>Sandbox mode</strong> — no real charge is made. Clicking
              “Buy” simulates a successful payment, activates the plan for 30
              days, and lets you download a PDF receipt.
            </>
          )}
        </span>
      </div>

      {user?.subscription?.history?.length > 0 && (
        <section className="history-section">
          <h2>Purchase history</h2>
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th><th>Plan</th><th>Amount</th><th>Period</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {user.subscription.history.slice().reverse().map((h) => (
                <tr key={h.id || h.createdAt}>
                  <td>{new Date(h.createdAt).toLocaleDateString()}</td>
                  <td className="cap">{h.plan}</td>
                  <td>{h.amount > 0 ? `${h.currency || 'USD'} ${h.amount}` : '—'}</td>
                  <td>
                    {h.periodStart ? new Date(h.periodStart).toLocaleDateString() : '—'}
                    {' → '}
                    {h.periodEnd ? new Date(h.periodEnd).toLocaleDateString() : '—'}
                  </td>
                  <td><span className={`status status-${h.status}`}>{h.status}</span></td>
                  <td>
                    <button
                      className="history-receipt-btn"
                      onClick={() => downloadReceipt(h.id)}
                      title="Download the receipt as PDF"
                    >
                      <Download size={12} /> Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="billing-footer">
        <Link to="/settings" className="link-muted">Manage account →</Link>
      </div>

      <PaymentSuccessModal
        open={!!successInfo}
        planName={successInfo?.planName}
        amount={successInfo?.amount}
        onDownload={handleDownloadFromModal}
        onClose={() => setSuccessInfo(null)}
      />
    </div>
  );
};

export default Billing;
