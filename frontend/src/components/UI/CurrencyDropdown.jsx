import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import './CurrencyDropdown.css';

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', label: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', label: 'British Pound', flag: '🇬🇧' },
  { code: 'MAD', symbol: 'DH', label: 'Moroccan Dirham', flag: '🇲🇦' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar', flag: '🇦🇺' }
];

const CurrencyDropdown = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = CURRENCIES.find((c) => c.code === value) || CURRENCIES[0];

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className={`cur-dd ${open ? 'open' : ''}`} ref={ref}>
      <button
        type="button"
        className="cur-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="cur-flag">{selected.flag}</span>
        <span className="cur-code">{selected.code}</span>
        <ChevronDown size={16} className="cur-chev" />
      </button>

      {open && (
        <ul className="cur-menu" role="listbox">
          {CURRENCIES.map((c) => (
            <li
              key={c.code}
              role="option"
              aria-selected={c.code === value}
              className={c.code === value ? 'active' : ''}
              onClick={() => {
                onChange(c.code);
                setOpen(false);
              }}
            >
              <span className="cur-flag">{c.flag}</span>
              <div className="cur-info">
                <strong>{c.code}</strong>
                <small>{c.label}</small>
              </div>
              <span className="cur-symbol">{c.symbol}</span>
              {c.code === value && <Check size={14} className="cur-check" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CurrencyDropdown;
