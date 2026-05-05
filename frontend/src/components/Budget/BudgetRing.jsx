import React from 'react';
import './BudgetRing.css';

/**
 * Proportional donut chart for the trip budget breakdown.
 *
 * The SVG arc path has a circumference of 100 (because the radius is 15.9155),
 * so `stroke-dasharray: "pct, 100"` renders a segment covering `pct` percent
 * of the circle. We chain segments by pushing `stroke-dashoffset` backwards.
 */

// Keep the ordering and colours in sync with the legend (.dot.<key>).
const SEGMENT_ORDER = ['flights', 'hotels', 'food', 'activities', 'other'];
const SEGMENT_COLORS = {
  flights: 'var(--primary)',
  hotels: 'var(--accent)',
  food: '#10b981',
  activities: '#f59e0b',
  other: '#6366f1'
};

const BudgetRing = ({ breakdown = {}, currency = 'USD' }) => {
  const entries = SEGMENT_ORDER
    .map((key) => [key, Number(breakdown[key]) || 0])
    .filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0);

  // Build cumulative offsets so each segment starts where the previous ended.
  let offset = 0;
  const segments = entries.map(([key, val]) => {
    const pct = total > 0 ? (val / total) * 100 : 0;
    const seg = {
      key,
      val,
      pct,
      // The SVG arc is drawn counter-clockwise from 3 o'clock, so negate the
      // offset to make each segment start after the previous one.
      dashArray: `${pct} ${100 - pct}`,
      dashOffset: -offset,
      color: SEGMENT_COLORS[key]
    };
    offset += pct;
    return seg;
  });

  return (
    <div className="budget-ring-container">
      <div className="ring-visual">
        <svg viewBox="0 0 36 36" className="circular-chart">
          <path
            className="circle-bg"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          {segments.map((s) => (
            <path
              key={s.key}
              className="circle"
              style={{ stroke: s.color }}
              strokeDasharray={s.dashArray}
              strokeDashoffset={s.dashOffset}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          ))}
        </svg>
        <div className="percentage">
          <span className="total-val">{currency} {Math.round(total)}</span>
          <span className="label">Total Budget</span>
        </div>
      </div>

      <div className="budget-legend">
        {SEGMENT_ORDER.filter((k) => breakdown[k] != null).map((key) => {
          const val = Number(breakdown[key]) || 0;
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          return (
            <div key={key} className="legend-item">
              <span className={`dot ${key}`}></span>
              <span className="name">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
              <span className="pct">{pct}%</span>
              <span className="value">{currency} {val.toFixed(0)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BudgetRing;
