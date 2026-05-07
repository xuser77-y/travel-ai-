import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import useTripStore from '../../stores/tripStore';
import './PlanGate.css';

/**
 * Returns the user's current plan info plus feature checks.
 * Falls back to a `free` plan with 0/0 trial usage when not logged in
 * (caller decides whether to redirect to /login).
 */
export const usePlan = () => {
  const user = useTripStore((s) => s.user);
  const sub = user?.subscription || null;
  const isAdmin = !!user?.isAdmin;
  const features = isAdmin
    ? ['planner', 'refine', 'community', 'livemap', 'worldcup', 'priority']
    : (sub?.features || []);
  return {
    user,
    isAdmin,
    plan: sub?.plan || 'free',
    effectivePlan: isAdmin ? 'premium' : (sub?.effectivePlan || 'free'),
    features,
    hasFeature: (f) => isAdmin || features.includes(f),
    freeTripsRemaining: sub?.freeTripsRemaining ?? 0,
    freeTripsUsed: sub?.freeTripsUsed ?? 0,
    trialLimit: sub?.trialLimit ?? 0,
    planExpiresAt: sub?.planExpiresAt || null,
    history: sub?.history || []
  };
};

/**
 * Wraps content that requires a paid feature. If the user lacks the feature,
 * shows a "locked" card with a CTA to /billing instead of the children.
 */
const PlanGate = ({ feature, featureLabel, children, fallback }) => {
  const { hasFeature, plan } = usePlan();
  if (hasFeature(feature)) return children;
  if (fallback) return fallback;
  return (
    <div className="plan-gate">
      <div className="plan-gate-icon"><Lock size={28} /></div>
      <h3>{featureLabel || 'This feature is locked'}</h3>
      <p>
        Your current plan (<strong>{plan}</strong>) doesn't include this.
        Upgrade to unlock it.
      </p>
      <Link to="/billing" className="plan-gate-cta">
        <Sparkles size={16} /> View plans
      </Link>
    </div>
  );
};

export default PlanGate;
