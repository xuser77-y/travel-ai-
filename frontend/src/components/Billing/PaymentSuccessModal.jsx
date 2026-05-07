import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, X, Loader2 } from 'lucide-react';
import './PaymentSuccessModal.css';

/**
 * Modal shown after a successful subscription purchase. Replaces the old
 * behaviour of auto-opening a printable HTML window (which fired twice in
 * StrictMode and required users to "Save as PDF" from the print dialog).
 *
 * The modal offers two clear actions:
 *   - "Download PDF receipt" → calls the supplied `onDownload` (which uses
 *     jsPDF to produce a real .pdf) and closes.
 *   - "Skip" → closes without downloading.
 *
 * Esc / clicking the backdrop also closes. The download button shows a
 * spinner while the receipt payload is being fetched + rendered so the
 * user knows something is happening on slower connections.
 *
 * Props:
 *   - open      : boolean — controls visibility
 *   - planName  : string  — for the headline ("You're on the X plan!")
 *   - amount    : string  — pre-formatted price/currency to show inline
 *   - onDownload: () => Promise<void> — the actual PDF download
 *   - onClose   : () => void — invoked by Skip / backdrop / Esc
 */
const PaymentSuccessModal = ({ open, planName, amount, onDownload, onClose }) => {
  const [downloading, setDownloading] = useState(false);

  // Esc-to-close. We also lock body scroll while the modal is open so
  // long pages don't jump around behind the overlay.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await onDownload?.();
    } finally {
      setDownloading(false);
      onClose?.();
    }
  };

  return (
    <div className="psm-backdrop" onClick={onClose}>
      <div
        className="psm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="psm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="psm-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="psm-icon-wrap">
          <CheckCircle2 size={48} strokeWidth={1.6} />
        </div>

        <h2 id="psm-title" className="psm-title">Payment successful</h2>
        <p className="psm-sub">
          You're now on the <strong>{planName || 'paid'}</strong> plan
          {amount ? <> · <span className="psm-amount">{amount}</span></> : null}.
        </p>
        <p className="psm-hint">
          Want a copy of your receipt? Download it as a PDF now or skip — you
          can always grab it later from the billing history.
        </p>

        <div className="psm-actions">
          <button
            className="psm-btn psm-btn-secondary"
            onClick={onClose}
            disabled={downloading}
          >
            Skip
          </button>
          <button
            className="psm-btn psm-btn-primary"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? <Loader2 size={16} className="psm-spin" /> : <Download size={16} />}
            {downloading ? 'Preparing PDF…' : 'Download PDF receipt'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessModal;
