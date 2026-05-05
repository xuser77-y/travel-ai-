import React from 'react';
import './WeatherBadge.css';

/**
 * Compact, single-day weather chip used in the day-tab list.
 * Falls back gracefully if `summary` is missing.
 */
export const WeatherChip = ({ summary }) => {
  if (!summary) return null;
  const cls = `weather-chip rating-${summary.rating || 'fair'}`;
  return (
    <span className={cls} title={summary.label}>
      <span className="wc-icon">{summary.icon || '🌡️'}</span>
      <span className="wc-temp">{Math.round(summary.tmax)}°</span>
    </span>
  );
};

/**
 * Detailed banner shown above each day's timeline with a verdict + advice.
 */
const WeatherBadge = ({ summary }) => {
  if (!summary) return null;
  const rating = summary.rating || 'fair';
  return (
    <div className={`weather-badge rating-${rating}`}>
      <div className="wb-icon" aria-hidden>{summary.icon || '🌡️'}</div>
      <div className="wb-body">
        <div className="wb-top">
          <span className="wb-label">{summary.label}</span>
          <span className="wb-temps">
            {Math.round(summary.tmin)}° / {Math.round(summary.tmax)}°C
          </span>
          {summary.precipitation > 0 && (
            <span className="wb-precip">💧 {summary.precipitation}mm</span>
          )}
          <span className={`wb-rating rating-${rating}`}>
            {rating === 'excellent' && 'Excellent day'}
            {rating === 'good' && 'Good day'}
            {rating === 'fair' && 'Fair day'}
            {rating === 'poor' && 'Bad day'}
          </span>
        </div>
        {summary.advice && <p className="wb-advice">{summary.advice}</p>}
      </div>
    </div>
  );
};

export default WeatherBadge;
