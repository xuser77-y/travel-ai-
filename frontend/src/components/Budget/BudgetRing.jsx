import React from 'react';
import './BudgetRing.css';

const BudgetRing = ({ breakdown }) => {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  
  return (
    <div className="budget-ring-container">
      <div className="ring-visual">
        <svg viewBox="0 0 36 36" className="circular-chart">
          <path className="circle-bg"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          {/* Simple representative paths for breakdown segments */}
          <path className="circle segment-1" strokeDasharray="30, 100"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path className="circle segment-2" strokeDasharray="20, 100" strokeDashoffset="-30"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div className="percentage">
          <span className="total-val">${total}</span>
          <span className="label">Total Spent</span>
        </div>
      </div>

      <div className="budget-legend">
        {Object.entries(breakdown).map(([key, val]) => (
          <div key={key} className="legend-item">
            <span className={`dot ${key}`}></span>
            <span className="name">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
            <span className="value">${val.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BudgetRing;
