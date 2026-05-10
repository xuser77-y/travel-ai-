import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useTripStore from '../../stores/tripStore';
import { Coins, Wallet, CreditCard, Gem, DollarSign } from 'lucide-react';
import axios from 'axios';
import CurrencyDropdown from '../../components/UI/CurrencyDropdown';
import { useTranslation } from '../../hooks/useTranslation';
import './Planner.css';

const Step3Budget = () => {
  const navigate = useNavigate();
  const { formData, setFormData } = useTripStore();
  const { t } = useTranslation();
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
    { id: 'economy', label: t('planner.economy'), icon: <Coins size={30} />, desc: t('planner.economyDesc') },
    { id: 'balanced', label: t('planner.balanced'), icon: <Wallet size={30} />, desc: t('planner.balancedDesc') },
    { id: 'comfort', label: t('planner.comfort'), icon: <CreditCard size={30} />, desc: t('planner.comfortDesc') },
    { id: 'luxury', label: t('planner.luxury'), icon: <Gem size={30} />, desc: t('planner.luxuryDesc') }
  ];

  return (
    <div className="planner-step glass-card">
      <div className="step-header">
        <span className="step-indicator">{t('planner.step3Of4')}</span>
        <h2>{t('planner.budgetStyle')}</h2>
        <p>{t('planner.step3Sub')}</p>
      </div>

      <div className="planner-content">
        <div className="budget-input-group" style={{ marginBottom: '40px' }}>
          <label style={{ display: 'block', marginBottom: '15px', fontWeight: 700 }}>{t('planner.totalBudget')}</label>
          <div className="input-row" style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '15px', alignItems: 'stretch' }}>
            <div className="input-wrapper">
              <DollarSign className="input-icon" size={20} />
              <input
                type="number"
                placeholder={t('planner.enterAmount')}
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
          <label style={{ display: 'block', marginBottom: '20px', fontWeight: 700, fontSize: '1.1rem' }}>{t('planner.chooseStyle')}</label>
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
        <button className="btn-secondary" onClick={() => navigate('/planner/step2')}>{t('planner.back')}</button>
        <button className="btn-primary" onClick={() => navigate('/planner/step4')}>{t('planner.nextStep')}</button>
      </div>
    </div>
  );
};

export default Step3Budget;
