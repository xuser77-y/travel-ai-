import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './ConfirmDialog.css';

// ---------------------------------------------------------------------------
// Replacement for window.confirm(): exposes useConfirm() that returns a
// promise resolving to true (confirmed) or false (cancelled). Renders an
// accessible modal so we never block the main thread or look browser-y.
// ---------------------------------------------------------------------------

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        title: opts.title || 'Are you sure?',
        message: opts.message || '',
        confirmLabel: opts.confirmLabel || 'Confirm',
        cancelLabel: opts.cancelLabel || 'Cancel',
        variant: opts.variant || 'default' // 'default' | 'danger'
      });
    });
  }, []);

  const close = useCallback(
    (result) => {
      const resolver = resolverRef.current;
      resolverRef.current = null;
      setState(null);
      if (resolver) resolver(result);
    },
    []
  );

  // Esc closes the dialog as cancel.
  useEffect(() => {
    if (!state) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="confirm-overlay" onClick={() => close(false)}>
          <div
            className={`confirm-dialog ${state.variant === 'danger' ? 'is-danger' : ''}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="confirm-header">
              <div className="confirm-icon">
                <AlertTriangle size={20} />
              </div>
              <div className="confirm-text">
                <h3 id="confirm-title">{state.title}</h3>
                {state.message && <p>{state.message}</p>}
              </div>
              <button
                type="button"
                className="confirm-close"
                onClick={() => close(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </header>
            <footer className="confirm-footer">
              <button
                type="button"
                className="confirm-btn confirm-btn-cancel"
                onClick={() => close(false)}
                autoFocus
              >
                {state.cancelLabel}
              </button>
              <button
                type="button"
                className={`confirm-btn confirm-btn-action ${state.variant === 'danger' ? 'is-danger' : ''}`}
                onClick={() => close(true)}
              >
                {state.confirmLabel}
              </button>
            </footer>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside a ConfirmProvider');
  return ctx;
};

export default ConfirmProvider;
