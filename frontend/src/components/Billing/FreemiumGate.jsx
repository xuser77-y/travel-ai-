import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Sparkles, Crown, ArrowRight } from 'lucide-react';
import useTripStore from '../../stores/tripStore';
import './FreemiumGate.css';

/**
 * FreemiumGate — wraps any premium page so that:
 *
 *   1. While the user is allowed to use the feature, it transparently
 *      renders its children.
 *   2. When the user is NOT allowed (either out of freemium uses on the
 *      free plan, OR on a paid plan that doesn't include this feature),
 *      the page is heavily blurred and an upgrade modal is pinned on top.
 *
 * Two reasons can trigger the lock — the modal copy adapts:
 *   - `freemium_exhausted` (free user, 3/3 used)
 *   - `feature_not_in_plan` (Basic user trying to view Community)
 *
 * Usage:
 *   <FreemiumGate feature="livemap" featureLabel="Live Map">
 *     <LiveMapContent />
 *   </FreemiumGate>
 *
 * The `feature` prop is the canonical key from planService.FEATURE_LABELS
 * and is matched against `subscription.features` (the user's plan's
 * unlocked features). The backend stays the ultimate source of truth —
 * the blur is UX only, every mutating action is also gated server-side.
 */
const FreemiumGate = ({ feature, featureLabel = 'this feature', icon, children }) => {
  const navigate = useNavigate();
  const user = useTripStore((s) => s.user);

  const sub = user?.subscription || null;
  const freemium = sub?.freemium || null;

  // Compute lock + reason. Order matters: a paid user without the
  // feature is shown the "upgrade your plan" copy, never the
  // "free trial used up" copy.
  let lockReason = null;
  if (!user) {
    // Logged-out users see content; if the page actually needs auth the
    // backend will 401 and the page can redirect. We don't blur here
    // because the freemium counter only applies to authenticated users.
    lockReason = null;
  } else if (sub?.effectivePlan && sub.effectivePlan !== 'free') {
    // Paid plan: check the feature whitelist.
    if (feature && Array.isArray(sub.features) && !sub.features.includes(feature)) {
      lockReason = 'feature_not_in_plan';
    }
  } else if (freemium?.locked) {
    lockReason = 'freemium_exhausted';
  }

  if (!lockReason) return <>{children}</>;

  const used = freemium?.used ?? 0;
  const limit = freemium?.limit ?? 3;
  const isPlanLock = lockReason === 'feature_not_in_plan';

  return (
    <div className="freemium-gate">
      {/* Blurred layer: pointer-events disabled so users can't click
          through the lock. aria-hidden so screen readers skip the
          decorative copy of the page. */}
      <div className="freemium-gate__blur" aria-hidden="true">
        {children}
      </div>

      {/* Upgrade modal — fixed inside the gate, not the document, so
          stacked layouts (sidebars etc.) keep working. */}
      <div className="freemium-gate__modal" role="dialog" aria-modal="true" aria-labelledby="freemium-title">
        <div className="freemium-gate__icon-row">
          <div className="freemium-gate__icon">
            {icon || <Lock size={28} />}
          </div>
        </div>
        <span className="freemium-gate__badge">
          <Sparkles size={12} /> {isPlanLock ? `Not in your ${sub?.plan} plan` : 'Premium feature'}
        </span>
        <h2 id="freemium-title">
          {isPlanLock
            ? `Upgrade to unlock ${featureLabel}`
            : "You've reached your free limit"}
        </h2>
        <p className="freemium-gate__sub">
          {isPlanLock ? (
            <>
              Your <strong>{sub?.plan}</strong> plan does not include <strong>{featureLabel}</strong>.
              Upgrade to a higher tier to unlock it along with every other premium feature.
            </>
          ) : (
            <>
              You've used <strong>{used}</strong> of your <strong>{limit}</strong> free
              explorations. Upgrade your plan to unlock <strong>{featureLabel}</strong> and
              every other premium feature in Travio.
            </>
          )}
        </p>

        {/* Usage bar only makes sense for the free-trial lock. Paid users
            seeing this modal don't have a counter to display. */}
        {!isPlanLock && (
          <div className="freemium-gate__usage">
            <div className="freemium-gate__bar">
              <div
                className="freemium-gate__bar-fill"
                style={{ width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%` }}
              />
            </div>
            <div className="freemium-gate__usage-label">
              <span>{used} used</span>
              <span>{Math.max(0, limit - used)} left</span>
            </div>
          </div>
        )}

        <div className="freemium-gate__actions">
          <button
            type="button"
            className="freemium-gate__cta"
            onClick={() => navigate('/billing')}
          >
            <Crown size={16} /> View plans <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className="freemium-gate__ghost"
            onClick={() => navigate('/')}
          >
            Back to home
          </button>
        </div>

        <p className="freemium-gate__fine-print">
          Already paid? Try refreshing — your subscription may not be loaded yet.
        </p>
      </div>
    </div>
  );
};

export default FreemiumGate;
