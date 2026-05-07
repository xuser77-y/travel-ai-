const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const planService = require('../services/planService');
const stripeService = require('../services/stripeService');
const { requireAuth } = require('../middleware/planGate');

/**
 * Active payment provider — `mock` (default, sandbox) or `stripe` (real
 * card processing in test mode). The admin can flip this in the dashboard
 * and we persist it to disk so it survives restarts. Falls back to env
 * `PAYMENT_PROVIDER` if no override file exists.
 */
const PROVIDER_CONFIG_PATH = path.join(__dirname, '..', 'data', 'payment-config.json');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const loadProvider = () => {
  try {
    if (fs.existsSync(PROVIDER_CONFIG_PATH)) {
      const j = JSON.parse(fs.readFileSync(PROVIDER_CONFIG_PATH, 'utf8') || '{}');
      if (j.provider === 'mock' || j.provider === 'stripe') return j.provider;
    }
  } catch (_) { /* ignore */ }
  return process.env.PAYMENT_PROVIDER === 'stripe' ? 'stripe' : 'mock';
};

const saveProvider = (provider) => {
  if (!fs.existsSync(path.dirname(PROVIDER_CONFIG_PATH))) {
    fs.mkdirSync(path.dirname(PROVIDER_CONFIG_PATH), { recursive: true });
  }
  fs.writeFileSync(PROVIDER_CONFIG_PATH, JSON.stringify({ provider }, null, 2), 'utf8');
};

// Exported so admin.js can flip it without re-importing the file logic.
router.getActiveProvider = loadProvider;
router.setActiveProvider = (p) => {
  if (p !== 'mock' && p !== 'stripe') throw new Error('Invalid provider');
  saveProvider(p);
  return p;
};

/**
 * Payments / billing endpoints (developer / sandbox flow).
 *
 * The real PayPal sandbox always redirects users to a PayPal account
 * creation page, which is annoying for development & PFE demos. So this
 * project ships with a **simulated** checkout instead: the user clicks
 * "Pay now" on the Billing page, the server creates a synthetic order id,
 * marks the plan active for 30 days and appends a history entry. The
 * frontend then renders a printable receipt the user can save as PDF.
 *
 * Endpoints:
 *   GET  /api/payments/plans         -> public tier list + feature labels
 *   GET  /api/payments/subscription  -> auth: snapshot for /settings & /billing
 *   POST /api/payments/checkout      -> auth: simulate buying a plan
 *                                       body: { plan }
 *   GET  /api/payments/receipt/:hid  -> auth: returns the data needed to
 *                                       render the printable receipt page
 *
 * `req.user.subscriptionHistory[]` is the audit log everything else reads
 * from. Each entry has `provider: 'mock'` for simulated buys so the admin
 * can tell them apart from any future real-payment integration.
 */

router.get('/plans', (req, res) => {
  const provider = loadProvider();
  res.json({
    plans: planService.listPlans(),
    features: planService.FEATURE_LABELS,
    allFeatures: planService.ALL_FEATURES,
    // The FE renders a different "Buy" button per provider:
    //   - mock   -> instant simulated purchase + receipt
    //   - stripe -> redirect to Stripe-hosted checkout (test mode)
    provider,
    stripeAvailable: stripeService.enabled()
  });
});

router.get('/subscription', requireAuth, (req, res) => {
  res.json(planService.publicSubscription(req.user));
});

// Simulated checkout — replaces the PayPal sandbox flow that forced users
// through PayPal account creation. Stamps a synthetic order id, extends
// the user's plan by 30 days, and returns the new history entry so the FE
// can immediately offer a printable receipt.
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const planId = String(req.body?.plan || '').toLowerCase();
    const plan = planService.getPlan(planId);
    if (!plan || planId === 'free') {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    if (!plan.priceMonthly || plan.priceMonthly <= 0) {
      return res.status(400).json({
        error: 'Pricing for this plan has not been set yet. Ask the admin to set a price.'
      });
    }

    const orderId = `MOCK-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const { periodStart, periodEnd } = planService.computePeriod(req.user, planId);

    req.user.plan = planId;
    req.user.planExpiresAt = periodEnd;
    req.user.subscriptionHistory.push({
      plan: planId,
      amount: plan.priceMonthly,
      currency: plan.currency || 'USD',
      provider: 'mock',
      providerOrderId: orderId,
      periodStart,
      periodEnd,
      status: 'completed',
      note: 'Sandbox / developer purchase'
    });
    await req.user.save();

    const last = req.user.subscriptionHistory[req.user.subscriptionHistory.length - 1];
    res.json({
      ok: true,
      orderId,
      historyId: last._id,
      subscription: planService.publicSubscription(req.user)
    });
  } catch (err) {
    console.error('checkout error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Returns the receipt payload the FE renders into a printable invoice page.
// Includes a buyer block, the plan info, the amount and the order id so the
// generated PDF (browser "Save as PDF") is a real-looking receipt.
router.get('/receipt/:historyId', requireAuth, (req, res) => {
  const entry = (req.user.subscriptionHistory || []).find(
    (h) => String(h._id) === String(req.params.historyId)
  );
  if (!entry) return res.status(404).json({ error: 'Receipt not found' });
  const plan = planService.getPlan(entry.plan);
  res.json({
    receipt: {
      historyId: entry._id,
      orderId: entry.providerOrderId,
      provider: entry.provider,
      status: entry.status,
      issuedAt: entry.createdAt,
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      amount: entry.amount,
      currency: entry.currency,
      note: entry.note,
      plan: {
        id: entry.plan,
        name: plan?.name || entry.plan,
        description: plan?.description || '',
        features: plan?.features || []
      },
      featureLabels: planService.FEATURE_LABELS
    },
    buyer: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email
    },
    seller: {
      name: 'Travio',
      legal: 'Travio — PFE Project',
      address: 'Casablanca, Morocco',
      contact: 'support@travio.local'
    }
  });
});

// ---------------------------------------------------------------------------
// Stripe Checkout (test mode) — works in Morocco for developers using the
// Stripe test card 4242 4242 4242 4242. The FE first POSTs to
// `/stripe/create-session` to get a hosted checkout URL, redirects the
// user, and after the success redirect calls `/stripe/finalize?session_id`
// to verify payment and grant the plan.
// ---------------------------------------------------------------------------

router.post('/stripe/create-session', requireAuth, async (req, res) => {
  try {
    if (loadProvider() !== 'stripe') {
      return res.status(400).json({ error: 'Stripe is not the active provider.' });
    }
    if (!stripeService.enabled()) {
      return res.status(503).json({
        error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in backend/.env.'
      });
    }

    const planId = String(req.body?.plan || '').toLowerCase();
    const plan = planService.getPlan(planId);
    if (!plan || planId === 'free') return res.status(400).json({ error: 'Invalid plan' });
    if (!plan.priceMonthly || plan.priceMonthly <= 0) {
      return res.status(400).json({
        error: 'Pricing for this plan has not been set yet. Ask the admin to set a price.'
      });
    }

    const session = await stripeService.createCheckoutSession({
      plan: planId,
      planName: plan.name,
      amount: plan.priceMonthly,
      currency: plan.currency || 'USD',
      userId: req.user._id.toString(),
      email: req.user.email,
      // Land back on the Billing page with the session_id so the FE can
      // call `/stripe/finalize` to verify and grant the plan.
      successUrl: `${FRONTEND_URL}/billing?stripe=success`,
      cancelUrl: `${FRONTEND_URL}/billing?stripe=cancel`
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('stripe create-session:', err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message || 'Stripe error'
    });
  }
});

// Verifies the session post-redirect and applies the plan. Idempotent:
// if the session id is already in the user's subscriptionHistory we
// return the existing entry instead of double-charging.
router.post('/stripe/finalize', requireAuth, async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    if (!sessionId.startsWith('cs_')) return res.status(400).json({ error: 'Invalid session id' });

    // Idempotency check: if we already processed this session, return the
    // existing history entry. Stripe's redirect can be retried by the user.
    const existing = (req.user.subscriptionHistory || []).find(
      (h) => h.providerOrderId === sessionId
    );
    if (existing) {
      return res.json({
        ok: true,
        alreadyProcessed: true,
        historyId: existing._id,
        subscription: planService.publicSubscription(req.user)
      });
    }

    const session = await stripeService.retrieveSession(sessionId);
    if (!session.paid) {
      return res.status(402).json({ error: `Payment not completed (status: ${session.paymentStatus})` });
    }
    // Cross-check: the metadata.userId must match the caller so a leaked
    // session id can't be used to grant a plan to someone else.
    if (String(session.metadata.userId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Session does not belong to this user' });
    }

    const planId = String(session.metadata.plan || '').toLowerCase();
    const plan = planService.getPlan(planId);
    if (!plan || planId === 'free') return res.status(400).json({ error: 'Invalid plan in session' });

    const { periodStart, periodEnd } = planService.computePeriod(req.user, planId);
    req.user.plan = planId;
    req.user.planExpiresAt = periodEnd;
    req.user.subscriptionHistory.push({
      plan: planId,
      amount: (session.amountTotal || 0) / 100,
      currency: session.currency || (plan.currency || 'USD'),
      provider: 'stripe',
      providerOrderId: sessionId,
      periodStart,
      periodEnd,
      status: 'completed',
      note: 'Stripe Checkout (test mode)'
    });
    await req.user.save();

    const last = req.user.subscriptionHistory[req.user.subscriptionHistory.length - 1];
    res.json({
      ok: true,
      historyId: last._id,
      subscription: planService.publicSubscription(req.user)
    });
  } catch (err) {
    console.error('stripe finalize:', err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message || 'Stripe error'
    });
  }
});

module.exports = router;
