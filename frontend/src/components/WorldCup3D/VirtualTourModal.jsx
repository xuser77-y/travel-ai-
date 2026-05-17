import React, { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import './VirtualTourModal.css';

/**
 * In-app 360° virtual-tour viewer.
 *
 * Renders the third-party SONARGES tour inside an `<iframe>` so the user
 * never leaves Travio. Visually we keep our own chrome around the tour
 * (header, close button, branded title) — only the photo content itself
 * is theirs.
 *
 * Defence in depth:
 *  - `onLoad` clears the loading spinner once the iframe paints.
 *  - A 6 s safety timer flips the UI into the "blocked" state if the
 *    iframe never fires `load` (typical when the host returns
 *    `X-Frame-Options: DENY` or a strict `frame-ancestors` CSP), so the
 *    user sees an actionable fallback instead of a blank black box.
 *  - Esc + backdrop click + close button all dismiss the modal.
 *  - Body scroll is locked while open.
 */
const LOAD_TIMEOUT_MS = 6000;

const VirtualTourModal = ({ url, title, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const timerRef = useRef(null);

  // Body-scroll lock + Esc-to-close + iframe-blocked watchdog.
  useEffect(() => {
    if (!url) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    timerRef.current = setTimeout(() => {
      // If we never received a `load` event within the budget the host is
      // very likely refusing to be framed. Surface a clear fallback.
      setBlocked(true);
      setLoading(false);
    }, LOAD_TIMEOUT_MS);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [url, onClose]);

  if (!url) return null;

  const handleIframeLoad = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setLoading(false);
  };

  return (
    <div className="vr-tour-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="vr-tour-shell" onClick={(e) => e.stopPropagation()}>
        {/* Floating chrome — lives over the iframe so we get a fully
            edge-to-edge tour with just two minimal controls. */}
        <div className="vr-tour-floating-actions">
          <a
            className="vr-tour-action"
            href={url}
            target="_blank"
            rel="noreferrer"
            title={t('worldCup.openInNewTab')}
            aria-label={t('worldCup.openInNewTab')}
          >
            <ExternalLink size={16} />
          </a>
          <button
            type="button"
            className="vr-tour-action"
            onClick={onClose}
            aria-label={t('worldCup.closeDetails')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="vr-tour-frame-wrap">
          {loading && !blocked && (
            <div className="vr-tour-loading">
              <div className="vr-tour-spinner" />
              <p>{t('worldCup.tourLoading')}</p>
            </div>
          )}

          {blocked ? (
            <div className="vr-tour-blocked">
              <AlertTriangle size={28} />
              <h3>{t('worldCup.tourBlockedTitle')}</h3>
              <p>{t('worldCup.tourBlockedMsg')}</p>
              <a
                className="vr-tour-cta"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={14} /> {t('worldCup.openInNewTab')}
              </a>
            </div>
          ) : (
            <iframe
              src={url}
              title={title || '360 virtual tour'}
              className="vr-tour-frame"
              allow="accelerometer; gyroscope; fullscreen; xr-spatial-tracking"
              allowFullScreen
              onLoad={handleIframeLoad}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default VirtualTourModal;
