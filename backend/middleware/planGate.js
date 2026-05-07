const jwt = require('jsonwebtoken');
const User = require('../models/User');
const planService = require('../services/planService');

/**
 * Plan-gating middleware factory.
 *
 * Usage:
 *   router.post('/something', requireAuth, requireFeature('community'), handler);
 *
 * `requireAuth` attaches `req.user` (the DB document) so downstream handlers
 * can read plan state without re-querying. `requireFeature(feature)` returns a
 * 402 Payment Required when the user's effective plan doesn't include the
 * requested feature, with a payload the FE can render an upgrade CTA from.
 *
 * Admins (a.k.a. superadmins) always pass every gate.
 */

const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.disabled) return res.status(403).json({ error: 'Account disabled' });
    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Combined freemium + per-plan feature gate.
 *
 * The rules are:
 *   - Admin                      → always pass.
 *   - Free user, uses left       → pass (route handler increments counter).
 *   - Free user, no uses left    → 402 `freemium_exhausted`.
 *   - Paid user, plan unlocks F  → pass (no counter).
 *   - Paid user, plan locks F    → 402 `feature_not_in_plan`
 *                                  (e.g. Basic trying to use Live Map).
 *
 * The `feature` argument is the canonical key (see planService.FEATURE_LABELS).
 * It's used both for the per-plan whitelist check AND for the 402 payload
 * so the FE shows a feature-aware "Upgrade to Pro for Live Map" message.
 */
const requireFeature = (feature) => (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (user.isAdmin) return next();

  const plan = planService.effectivePlan(user);

  // Paid plans bypass the freemium counter but are still constrained by
  // the per-plan feature whitelist that the admin controls in
  // /admin → Plans & Billing. So a Basic user trying to use Community
  // gets the same upgrade modal as a Free user — just with a different
  // reason code.
  if (planService.isPaidPlan(plan)) {
    if (planService.userHasFeature(user, feature)) return next();
    return res.status(402).json({
      error: 'Feature not in your plan',
      code: 'feature_not_in_plan',
      feature,
      featureLabel: planService.FEATURE_LABELS[feature] || feature,
      currentPlan: user.plan,
      effectivePlan: plan,
      upgradeUrl: '/billing',
      message:
        `Your ${user.plan} plan does not include ${planService.FEATURE_LABELS[feature] || feature}. ` +
        `Upgrade to unlock it.`
    });
  }

  // Free plan — counter-based.
  if (planService.isFreemiumLocked(user)) {
    return res.status(402).json({
      error: 'Free trial exhausted',
      code: 'freemium_exhausted',
      feature,
      featureLabel: planService.FEATURE_LABELS[feature] || feature,
      freeTripsUsed: user.freeTripsUsed || 0,
      trialLimit: user.trialLimit || 0,
      currentPlan: 'free',
      effectivePlan: 'free',
      upgradeUrl: '/billing',
      message:
        `You've used all ${user.trialLimit || 3} of your free explorations. ` +
        `Upgrade to a paid plan to continue using ${planService.FEATURE_LABELS[feature] || feature}.`
    });
  }
  next();
};

/**
 * Trip-generation gate. Same shape as requireFeature('planner') but kept
 * as a dedicated name so the trips route reads naturally and so the FE's
 * Loading.jsx upgrade screen can identify it via `feature: 'planner'`.
 */
const requireTripQuota = (req, res, next) => requireFeature('planner')(req, res, next);

module.exports = { requireAuth, requireFeature, requireTripQuota };
