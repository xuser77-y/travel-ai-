/**
 * Plan / subscription service — single source of truth for the three paid
 * tiers and the free trial. Used by:
 *   - `requireFeature(feature)` middleware to gate routes
 *   - `routes/payments.js` to validate the plan being purchased
 *   - `routes/admin.js` to list / edit plans
 *   - the frontend (via GET /api/payments/plans) to render the pricing page
 *
 * Prices are intentional placeholders (see README §11) — change them here
 * or via the admin Settings tab and both the backend gate and the FE
 * pricing cards stay in sync.
 */

const PLAN_DEFS = {
  free: {
    id: 'free',
    name: 'Free Trial',
    // price shown on the pricing page; not charged anywhere
    priceMonthly: 0,
    currency: 'USD',
    // Trial users can plan AND refine their 3 trips — the quota is enforced
    // separately in `requireTripQuota` on the generate endpoint only.
    features: ['planner', 'refine'],
    highlight: false
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    priceMonthly: 0,   // TODO: set in admin Settings
    currency: 'USD',
    features: ['planner', 'refine'],
    highlight: false,
    description: 'AI trip planner and AI refinement chat — unlimited.'
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 0,   // TODO: set in admin Settings
    currency: 'USD',
    features: ['planner', 'refine', 'community', 'livemap'],
    highlight: true,
    description: 'Everything in Basic, plus Community Hubs and the Live Map.'
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    priceMonthly: 0,   // TODO: set in admin Settings
    currency: 'USD',
    features: ['planner', 'refine', 'community', 'livemap', 'worldcup', 'priority'],
    highlight: false,
    description: 'All features, including the World Cup 2030 companion and priority generation.'
  }
};

// Features -> human-friendly label (used by the 402 error payload AND by the
// Billing page's full feature matrix). The order here is the order shown on
// the pricing page, so keep it user-facing-ordered.
const FEATURE_LABELS = {
  planner: 'AI Trip Planner',
  refine: 'AI Refinement Chat',
  community: 'Community Hubs',
  livemap: 'Live Map',
  worldcup: 'World Cup 2030 Companion',
  priority: 'Priority Generation'
};

// Stable, ordered list used by the admin checkbox grid and the FE feature
// matrix. Adding a new feature is a one-line change here + wiring it into
// the right `requireFeature(...)` call somewhere in the routes.
const ALL_FEATURES = Object.keys(FEATURE_LABELS);
const ALL_FEATURES_SET = new Set(ALL_FEATURES);

// ---------------------------------------------------------------------------
// Persisted overrides — applied on first require() of this module so every
// downstream consumer (gates, FE pricing, admin) sees the admin's last edits
// immediately, regardless of which route file is required first.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const PLAN_OVERRIDES_PATH = path.join(__dirname, '..', 'data', 'plan-overrides.json');

const loadOverridesFromDisk = () => {
  try {
    if (!fs.existsSync(PLAN_OVERRIDES_PATH)) return {};
    return JSON.parse(fs.readFileSync(PLAN_OVERRIDES_PATH, 'utf8') || '{}');
  } catch (_) { return {}; }
};

const applyOverride = (id, patch) => {
  if (!PLAN_DEFS[id] || !patch) return;
  // Whitelist what an override may set. Everything else is ignored so a
  // stale or hand-edited file can't corrupt the in-memory defs.
  const safe = {};
  if (typeof patch.priceMonthly === 'number' && patch.priceMonthly >= 0) safe.priceMonthly = patch.priceMonthly;
  if (typeof patch.currency === 'string') safe.currency = patch.currency.toUpperCase().slice(0, 4);
  if (typeof patch.name === 'string') safe.name = patch.name.slice(0, 80);
  if (typeof patch.description === 'string') safe.description = patch.description.slice(0, 500);
  if (typeof patch.highlight === 'boolean') safe.highlight = patch.highlight;
  if (Array.isArray(patch.features)) {
    safe.features = patch.features
      .filter((f) => typeof f === 'string' && ALL_FEATURES_SET.has(f));
  }
  Object.assign(PLAN_DEFS[id], safe);
};

const reloadFromDisk = () => {
  const o = loadOverridesFromDisk();
  for (const id of Object.keys(o)) applyOverride(id, o[id]);
};

// Apply on module load so the very first request — even if it hits a route
// file that was required before admin.js — already sees the admin's edits.
reloadFromDisk();

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

const listPlans = () => Object.values(PLAN_DEFS);

const getPlan = (id) => PLAN_DEFS[id] || null;

// Active plan for a user, taking expiry into account. If the paid plan has
// expired we treat the user as if they're back on `free`.
const effectivePlan = (user) => {
  if (!user) return 'free';
  if (user.isAdmin) return 'premium'; // superadmin always has everything
  const plan = user.plan || 'free';
  if (plan === 'free') return 'free';
  if (!user.planExpiresAt || new Date(user.planExpiresAt) < new Date()) return 'free';
  return plan;
};

// True when a given feature is unlocked for this user right now.
const userHasFeature = (user, feature) => {
  if (!user) return false;
  if (user.isAdmin) return true;
  const plan = effectivePlan(user);
  return !!PLAN_DEFS[plan]?.features?.includes(feature);
};

// ---------------------------------------------------------------------------
// FREEMIUM model
//
// Every user starts with `trialLimit` (default 3) free uses spread across
// ALL premium features (planner / refine / livemap / community / worldcup).
// Paid plans bypass this counter entirely. Once `freeTripsUsed >= trialLimit`
// the user is "freemium-locked": all premium pages still render but the FE
// blurs them and the backend rejects mutating actions with a 402.
//
// We deliberately reuse the existing `freeTripsUsed` / `trialLimit` fields
// instead of adding new ones — semantically they were already a per-user
// usage counter, and reusing them avoids a Mongo migration.
// ---------------------------------------------------------------------------

const isPaidPlan = (planId) => planId && planId !== 'free';

// Returns true when the user is on the free plan AND has burned all uses.
// Admins and paid users are NEVER locked. Used by both the middleware (to
// reject actions) and the FE (to blur pages + show the upgrade modal).
const isFreemiumLocked = (user) => {
  if (!user) return true;
  if (user.isAdmin) return false;
  if (isPaidPlan(effectivePlan(user))) return false;
  const used = user.freeTripsUsed || 0;
  const limit = user.trialLimit || 0;
  return used >= limit;
};

// Atomic-ish increment of the freemium counter. We re-fetch the user and
// save inside the middleware to keep things simple (Mongo single-doc
// updates are atomic enough for our scale). Returns the new used count.
const consumeFreemium = async (user) => {
  user.freeTripsUsed = (user.freeTripsUsed || 0) + 1;
  await user.save();
  return user.freeTripsUsed;
};

// Paying tiers only (used by /api/payments/plans for the pricing page).
const paidPlans = () => listPlans().filter((p) => p.id !== 'free');

// Helper used by /payments/capture-order — compute the new period window
// based on a monthly charge. Extends an existing active plan of the same
// tier instead of clobbering it.
const computePeriod = (user, plan) => {
  const now = new Date();
  const currentEnd = user?.planExpiresAt && new Date(user.planExpiresAt) > now && user.plan === plan
    ? new Date(user.planExpiresAt)
    : now;
  const periodStart = now;
  const periodEnd = new Date(currentEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
  return { periodStart, periodEnd };
};

// Shape safe for the FE: plan state + freemium counters + history dates.
const publicSubscription = (user) => {
  const used = user.freeTripsUsed || 0;
  const limit = user.trialLimit || 0;
  const remaining = Math.max(0, limit - used);
  const locked = isFreemiumLocked(user);
  return {
    plan: user.plan || 'free',
    effectivePlan: effectivePlan(user),
    planExpiresAt: user.planExpiresAt || null,
    // Legacy field names kept for backwards compat with any code still
    // reading `freeTripsRemaining`. The new freemium block below is the
    // canonical source of truth for the FE.
    freeTripsUsed: used,
    trialLimit: limit,
    freeTripsRemaining: remaining,
    // The FE only needs to read `freemium.locked` to decide whether to
    // blur a premium page + show the upgrade modal.
    freemium: {
      used,
      limit,
      remaining,
      locked,
      // Admins and active paid plans never decrement the counter, so
      // the FE can show "Unlimited" for them instead of "0 left".
      unlimited: !!user.isAdmin || isPaidPlan(effectivePlan(user))
    },
    features: PLAN_DEFS[effectivePlan(user)]?.features || [],
    history: (user.subscriptionHistory || []).map((h) => ({
      id: h._id,
      plan: h.plan,
      amount: h.amount,
      currency: h.currency,
      provider: h.provider,
      periodStart: h.periodStart,
      periodEnd: h.periodEnd,
      status: h.status,
      note: h.note,
      createdAt: h.createdAt
    }))
  };
};

// Mutates PLAN_DEFS[id] with the given patch (validated) and persists every
// override to disk so it survives restarts. Returns the updated plan def.
const updatePlan = (id, patch) => {
  if (!PLAN_DEFS[id]) throw new Error('Unknown plan');
  applyOverride(id, patch);
  const all = loadOverridesFromDisk();
  all[id] = { ...(all[id] || {}), ...patch };
  // Same whitelist on disk so the file can never store junk.
  if (Array.isArray(patch.features)) {
    all[id].features = patch.features.filter((f) => ALL_FEATURES_SET.has(f));
  }
  try {
    if (!fs.existsSync(path.dirname(PLAN_OVERRIDES_PATH))) {
      fs.mkdirSync(path.dirname(PLAN_OVERRIDES_PATH), { recursive: true });
    }
    fs.writeFileSync(PLAN_OVERRIDES_PATH, JSON.stringify(all, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist plan override:', err.message);
  }
  return PLAN_DEFS[id];
};

const getOverrides = () => loadOverridesFromDisk();

module.exports = {
  PLAN_DEFS,
  FEATURE_LABELS,
  ALL_FEATURES,
  listPlans,
  paidPlans,
  getPlan,
  effectivePlan,
  userHasFeature,
  isPaidPlan,
  isFreemiumLocked,
  consumeFreemium,
  computePeriod,
  publicSubscription,
  updatePlan,
  getOverrides,
  reloadFromDisk
};
