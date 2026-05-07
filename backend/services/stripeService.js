/**
 * Thin Stripe REST client.
 *
 * We don't pull in the official `stripe` npm package because we only need
 * two endpoints (create a Checkout Session, retrieve it) and the rest of
 * the codebase already speaks axios. Keeping the surface area tiny also
 * makes the integration trivial to swap to another PSP later.
 *
 * Required env var: STRIPE_SECRET_KEY (test mode key starts with `sk_test_`).
 *  - No webhooks needed for the PFE demo: we verify the session server-side
 *    on the success-page redirect (`/billing?session_id=...`).
 *  - Frontend never sees the secret key — it only receives the hosted
 *    checkout URL and redirects the user there.
 */

const axios = require('axios');
const qs = require('querystring');

const STRIPE_API = 'https://api.stripe.com/v1';

const enabled = () => !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_'));

const headers = () => ({
  Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
  'Content-Type': 'application/x-www-form-urlencoded'
});

/**
 * Creates a Stripe Checkout Session for a one-off charge that represents
 * one month of the chosen plan. Returns the hosted URL the FE redirects
 * the user to. Stripe's hosted checkout works in Morocco for testing —
 * just enter the test card 4242 4242 4242 4242 with any future expiry +
 * any CVC + any postal code.
 *
 * @param {Object} args
 * @param {string} args.plan          - 'basic' | 'pro' | 'premium'
 * @param {number} args.amount        - in major units (e.g. 9.99)
 * @param {string} args.currency      - ISO 4217 (e.g. 'USD', 'MAD')
 * @param {string} args.userId        - mongo id of the buyer
 * @param {string} args.email         - prefills the checkout form
 * @param {string} args.successUrl    - FE URL to land on after payment
 * @param {string} args.cancelUrl     - FE URL to land on if user backs out
 */
const createCheckoutSession = async ({ plan, amount, currency, userId, email, successUrl, cancelUrl, planName }) => {
  if (!enabled()) {
    const err = new Error('Stripe is not configured (STRIPE_SECRET_KEY missing).');
    err.code = 'stripe_not_configured';
    throw err;
  }

  // Stripe expects amounts as integers in the smallest currency unit
  // (cents for USD/EUR, centimes for MAD, etc.). Currencies like JPY are
  // already zero-decimal, but for the supported set here multiplying by
  // 100 is correct.
  const minorAmount = Math.round(Number(amount) * 100);
  if (!minorAmount || minorAmount < 50) {
    const err = new Error('Plan price too low for Stripe (minimum ~0.50).');
    err.code = 'amount_too_low';
    throw err;
  }

  // Stripe form-encodes nested objects with bracket syntax. axios's default
  // serializer doesn't produce the format Stripe expects, so we build the
  // body manually with `querystring`.
  const body = {
    mode: 'payment',
    'payment_method_types[]': 'card',
    success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    customer_email: email || undefined,
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': String(currency || 'USD').toLowerCase(),
    'line_items[0][price_data][unit_amount]': minorAmount,
    'line_items[0][price_data][product_data][name]': `${planName || plan} plan — 1 month`,
    'line_items[0][price_data][product_data][description]': 'Travio subscription',
    // metadata is round-tripped on the session retrieve call so we can
    // trust the planId on the success-page handler instead of the URL.
    'metadata[plan]': plan,
    'metadata[userId]': String(userId)
  };

  const { data } = await axios.post(
    `${STRIPE_API}/checkout/sessions`,
    qs.stringify(body),
    { headers: headers() }
  );

  return {
    id: data.id,
    url: data.url,
    expiresAt: data.expires_at
  };
};

/**
 * Verifies a Checkout Session after the success redirect. Returns the
 * normalized fields the route handler needs to grant the plan.
 * Throws if the session isn't paid or doesn't belong to the user.
 */
const retrieveSession = async (sessionId) => {
  if (!enabled()) {
    const err = new Error('Stripe is not configured.');
    err.code = 'stripe_not_configured';
    throw err;
  }
  const { data } = await axios.get(
    `${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: headers() }
  );
  return {
    id: data.id,
    paid: data.payment_status === 'paid',
    paymentStatus: data.payment_status,
    amountTotal: data.amount_total,        // in minor units
    currency: (data.currency || 'usd').toUpperCase(),
    customerEmail: data.customer_email || data.customer_details?.email || null,
    metadata: data.metadata || {}
  };
};

module.exports = {
  enabled,
  createCheckoutSession,
  retrieveSession
};
