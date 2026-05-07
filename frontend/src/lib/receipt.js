/**
 * Printable receipt — fetches the receipt payload from the API and opens a
 * new browser tab containing a self-contained, print-styled HTML invoice.
 * The user clicks the browser's "Save as PDF" option (or Ctrl+P) to get a
 * real PDF without us having to ship a PDF library.
 *
 * Why a popup window instead of a route inside the SPA?
 *   1. Print stylesheets shouldn't fight the rest of the app's CSS.
 *   2. The browser auto-opens the print dialog on load.
 *   3. The user can close the tab afterwards without losing context.
 */

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return '—'; }
};

const fmtMoney = (amount, currency) => {
  if (amount == null) return '—';
  const num = Number(amount);
  if (!Number.isFinite(num)) return '—';
  return `${currency || 'USD'} ${num.toFixed(2)}`;
};

const buildReceiptHtml = ({ receipt, buyer, seller }) => {
  const features = (receipt.plan?.features || []).map(
    (f) => receipt.featureLabels?.[f] || f
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Receipt — ${escapeHtml(receipt.orderId)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #111;
    background: #f4f4f6;
    margin: 0;
    padding: 32px 16px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    max-width: 720px;
    margin: 0 auto;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 6px 30px rgba(0,0,0,0.08);
    padding: 40px 44px 36px;
  }
  header.top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #111;
    padding-bottom: 18px;
    margin-bottom: 24px;
  }
  .brand {
    font-size: 1.6rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .brand .accent { color: #a855f7; }
  .doc-meta {
    text-align: right;
    font-size: 0.82rem;
    line-height: 1.55;
    color: #444;
  }
  .doc-meta strong { color: #111; }
  .doc-title {
    font-size: 1.05rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #666;
  }
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    margin-bottom: 26px;
  }
  .parties section h4 {
    margin: 0 0 6px;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: #888;
  }
  .parties section p { margin: 2px 0; font-size: 0.92rem; line-height: 1.5; }
  .parties section .name { font-weight: 700; font-size: 1rem; }
  table.line-items {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 22px;
  }
  table.line-items th, table.line-items td {
    text-align: left;
    padding: 12px 10px;
    border-bottom: 1px solid #eee;
    font-size: 0.9rem;
    vertical-align: top;
  }
  table.line-items th {
    background: #fafafa;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.7rem;
    color: #666;
    font-weight: 700;
  }
  table.line-items td.amount, table.line-items th.amount { text-align: right; font-variant-numeric: tabular-nums; }
  .desc small { display: block; color: #666; margin-top: 4px; line-height: 1.45; }
  .features {
    margin: 6px 0 0;
    padding-left: 18px;
    color: #444;
  }
  .features li { font-size: 0.8rem; margin: 2px 0; }
  .totals {
    width: 100%;
    margin-left: auto;
    border-collapse: collapse;
    max-width: 320px;
  }
  .totals tr td { padding: 6px 10px; font-size: 0.95rem; }
  .totals tr td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  .totals tr.grand td {
    border-top: 2px solid #111;
    font-weight: 800;
    font-size: 1.05rem;
    padding-top: 10px;
  }
  .badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 999px;
    background: #e7f7ec;
    color: #137333;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .badge.mock { background: #f3edff; color: #6b21a8; }
  footer.bottom {
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px dashed #ddd;
    font-size: 0.78rem;
    color: #666;
    line-height: 1.55;
  }
  .actions {
    text-align: center;
    margin-top: 18px;
  }
  .actions button {
    background: #111;
    color: #fff;
    border: none;
    padding: 10px 22px;
    border-radius: 999px;
    font-weight: 700;
    cursor: pointer;
    font-size: 0.9rem;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; }
    .actions { display: none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <header class="top">
      <div>
        <div class="brand">Travel<span class="accent">AI</span></div>
        <div class="doc-title">Receipt</div>
      </div>
      <div class="doc-meta">
        <div><strong>Receipt #</strong> ${escapeHtml(receipt.orderId)}</div>
        <div><strong>Issued</strong> ${escapeHtml(fmtDate(receipt.issuedAt))}</div>
        <div><strong>Status</strong>
          <span class="badge ${receipt.provider === 'mock' ? 'mock' : ''}">
            ${escapeHtml(receipt.status)}${receipt.provider === 'mock' ? ' · Sandbox' : ''}
          </span>
        </div>
      </div>
    </header>

    <div class="parties">
      <section>
        <h4>From</h4>
        <p class="name">${escapeHtml(seller.name)}</p>
        <p>${escapeHtml(seller.legal)}</p>
        <p>${escapeHtml(seller.address)}</p>
        <p>${escapeHtml(seller.contact)}</p>
      </section>
      <section>
        <h4>Billed to</h4>
        <p class="name">${escapeHtml(buyer.name)}</p>
        <p>${escapeHtml(buyer.email)}</p>
        <p style="color:#888">User ID: ${escapeHtml(String(buyer.id))}</p>
      </section>
    </div>

    <table class="line-items">
      <thead>
        <tr>
          <th>Description</th>
          <th>Period</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="desc">
            <strong>${escapeHtml(receipt.plan.name)} plan</strong>
            <small>${escapeHtml(receipt.plan.description || 'Monthly subscription')}</small>
            ${features.length ? `<ul class="features">${features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
          </td>
          <td>
            ${escapeHtml(fmtDate(receipt.periodStart))}<br/>
            <small>to ${escapeHtml(fmtDate(receipt.periodEnd))}</small>
          </td>
          <td class="amount">${escapeHtml(fmtMoney(receipt.amount, receipt.currency))}</td>
        </tr>
      </tbody>
    </table>

    <table class="totals">
      <tr><td>Subtotal</td><td>${escapeHtml(fmtMoney(receipt.amount, receipt.currency))}</td></tr>
      <tr><td>Tax</td><td>${escapeHtml(fmtMoney(0, receipt.currency))}</td></tr>
      <tr class="grand"><td>Total paid</td><td>${escapeHtml(fmtMoney(receipt.amount, receipt.currency))}</td></tr>
    </table>

    <footer class="bottom">
      ${receipt.provider === 'mock'
        ? '<strong>This is a sandbox / developer receipt.</strong> No real payment was processed. Generated automatically for testing the TravelAI subscription flow.'
        : 'Thank you for subscribing to TravelAI.'}
      ${receipt.note ? `<br/>${escapeHtml(receipt.note)}` : ''}
    </footer>

    <div class="actions">
      <button onclick="window.print()">Save as PDF / Print</button>
    </div>
  </div>
  <script>
    // Auto-trigger the print dialog so the user can save as PDF in one click.
    window.addEventListener('load', () => {
      setTimeout(() => { try { window.print(); } catch (_) {} }, 350);
    });
  </script>
</body>
</html>`;
};

/**
 * Fetches the receipt from the backend, builds the printable HTML and opens
 * it in a new tab. Falls back to writing into the current tab if popup is
 * blocked, but most browsers allow user-initiated popups.
 */
export const openReceiptWindow = async (apiBase, token, historyId) => {
  if (!historyId) return;
  try {
    const res = await fetch(`${apiBase}/api/payments/receipt/${historyId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Receipt ${res.status}`);
    const data = await res.json();
    const html = buildReceiptHtml(data);

    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) {
      // Popup blocked — degrade gracefully by downloading the .html instead.
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${data.receipt.orderId}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch (err) {
    console.error('Receipt error:', err);
    alert('Could not load the receipt. Please try again.');
  }
};
