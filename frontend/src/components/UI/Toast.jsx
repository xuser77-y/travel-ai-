import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import './Toast.css';

// ---------------------------------------------------------------------------
// Toast system: a tiny pub/sub-style provider that exposes `useToast()` so any
// component can fire success / error / info / warning toasts. Replaces every
// alert() call in the app.
// ---------------------------------------------------------------------------

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
};

let counter = 0;
const nextId = () => `t_${Date.now()}_${++counter}`;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant, message, opts = {}) => {
      const id = nextId();
      const ttl = opts.duration ?? (variant === 'error' ? 6000 : 3500);
      setToasts((prev) => [...prev, { id, variant, message, title: opts.title }]);
      const handle = setTimeout(() => dismiss(id), ttl);
      timers.current.set(id, handle);
      return id;
    },
    [dismiss]
  );

  // Stable API exposed to consumers — adding more variants is just adding a
  // method here, no re-renders for callers.
  const api = useMemo(
    () => ({
      success: (msg, opts) => push('success', msg, opts),
      error: (msg, opts) => push('error', msg, opts),
      warning: (msg, opts) => push('warning', msg, opts),
      info: (msg, opts) => push('info', msg, opts),
      dismiss
    }),
    [push, dismiss]
  );

  // Cleanup all pending timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((h) => clearTimeout(h));
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notifications">
        {toasts.map((t) => {
          const Icon = ICONS[t.variant] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.variant}`} role="status">
              <Icon size={18} className="toast-icon" />
              <div className="toast-body">
                {t.title && <strong className="toast-title">{t.title}</strong>}
                <span className="toast-message">{t.message}</span>
              </div>
              <button
                type="button"
                className="toast-close"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider');
  return ctx;
};

export default ToastProvider;
