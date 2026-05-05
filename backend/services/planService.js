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
    features: ['planner'], // trip planner is allowed but capped by trialLimit
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

// Features -> human-friendly label (used by the 402 error payload).
const FEATURE_LABELS = {
  planner: 'AI Trip Planner',
  refine: 'AI Refinement Chat',
  community: 'Community Hubs',
  livemap: 'Live Map',
  worldcup: 'World Cup 2030 Companion',
  priority: 'Priority Generation'
};

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

// Shape safe for the FE: plan state + trial counters + history dates.
const publicSubscription = (user) => ({
  plan: user.plan || 'free',
  effectivePlan: effectivePlan(user),
  planExpiresAt: user.planExpiresAt || null,
  freeTripsUsed: user.freeTripsUsed || 0,
  trialLimit: user.trialLimit || 0,
  freeTripsRemaining: Math.max(0, (user.trialLimit || 0) - (user.freeTripsUsed || 0)),
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
});

module.exports = {
  PLAN_DEFS,
  FEATURE_LABELS,
  listPlans,
  paidPlans,
  getPlan,
  effectivePlan,
  userHasFeature,
  computePeriod,
  publicSubscription
};
