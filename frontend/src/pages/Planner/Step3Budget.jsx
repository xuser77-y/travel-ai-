import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useTripStore from '../../stores/tripStore';
import { Coins, Wallet, CreditCard, Gem, DollarSign } from 'lucide-react';
import axios from 'axios';
import CurrencyDropdown from '../../components/UI/CurrencyDropdown';
import './Planner.css';

const Step3Budget = () => {
  const navigate = useNavigate();
  const { formData, setFormData } = useTripStore();
  const [rates, setRates] = useState({});

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await axios.get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json');
        setRates(res.data.eur);
      } catch (err) {
        console.error('Rates fetch error:', err);
      }
    };
    fetchRates();
  }, []);

  const styles = [
    { id: 'economy', label: 'Economy', icon: <Coins size={30} />, desc: 'Budget-friendly, local vibes' },
    { id: 'balanced', label: 'Balanced', icon: <Wallet size={30} />, desc: 'Comfortable & authentic' },
    { id: 'comfort', label: 'Comfort', icon: <CreditCard size={30} />, desc: 'Premium stays & private tours' },
    { id: 'luxury', label: 'Luxury', icon: <Gem size={30} />, desc: 'Elite experiences, no compromise' }
  ];

  return (
    <div className="planner-step glass-card">
      <div className="step-header">
        <span className="step-indicator">Step 3 of 4</span>
        <h2>Budget & Style</h2>
        <p>How much are you planning to spend and what's your vibe?</p>
      </div>

      <div className="planner-content">
        <div className="budget-input-group" style={{ marginBottom: '40px' }}>
          <label style={{ display: 'block', marginBottom: '15px', fontWeight: 700 }}>Total Estimated Budget</label>
          <div className="input-row" style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '15px', alignItems: 'stretch' }}>
            <div className="input-wrapper">
              <DollarSign className="input-icon" size={20} />
              <input
                type="number"
                placeholder="Enter amount"
                value={formData.budget.total}
                onChange={(e) => setFormData({ budget: { ...formData.budget, total: e.target.value } })}
              />
            </div>
            <CurrencyDropdown
              value={formData.budget.currency}
              onChange={(code) => setFormData({ budget: { ...formData.budget, currency: code } })}
            />
          </div>
        </div>

        <div className="style-section">
          <label style={{ display: 'block', marginBottom: '20px', fontWeight: 700, fontSize: '1.1rem' }}>Choose your travel style</label>
          <div className="cards-grid">
            {styles.map((s) => (
              <div 
                key={s.id}
                className={`option-card glass-card ${formData.style === s.id ? 'active' : ''}`}
                onClick={() => setFormData({ style: s.id })}
              >
                <div className="icon">{s.icon}</div>
                <h4>{s.label}</h4>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="step-footer">
        <button className="btn-secondary" onClick={() => navigate('/planner/step2')}>Back</button>
        <button className="btn-primary" onClick={() => navigate('/planner/step4')}>Next Step</button>
      </div>
    </div>
  );
};

export default Step3Budget;
