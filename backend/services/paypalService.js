// DEPRECATED — the PayPal sandbox flow forced users through PayPal account
// creation, which made the developer/PFE demo painful. The project now uses
// a simulated checkout in `routes/payments.js` (provider: 'mock') and a
// printable HTML receipt the user saves as PDF from the browser.
//
// This file is kept as a stub so old `require('./paypalService')` calls (if
// any get re-introduced from git history) fail loudly instead of silently
// hitting PayPal. Delete it freely the next time you tidy services/.

module.exports = {
  isConfigured: () => false,
  env: 'disabled',
  clientId: null,
  createOrder: () => { throw new Error('PayPal flow has been removed. Use POST /api/payments/checkout.'); },
  captureOrder: () => { throw new Error('PayPal flow has been removed. Use POST /api/payments/checkout.'); }
};

// (Original PayPal Orders v2 client removed — see git history if you need it.)
