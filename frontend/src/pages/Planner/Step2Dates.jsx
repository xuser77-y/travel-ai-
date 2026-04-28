import React from 'react';
import { useNavigate } from 'react-router-dom';
import useTripStore from '../../stores/tripStore';
import { Users, User, Heart, Home, Calendar as CalendarIcon } from 'lucide-react';
import './Planner.css';

const Step2Dates = () => {
  const navigate = useNavigate();
  const { formData, setFormData } = useTripStore();
  const today = new Date().toISOString().split('T')[0];

  const travelerTypes = [
    { id: 'solo', label: 'Solo', icon: <User size={30} />, desc: 'Single adventurer' },
    { id: 'couple', label: 'Couple', icon: <Heart size={30} />, desc: 'Perfect for two' },
    { id: 'family', label: 'Family', icon: <Home size={30} />, desc: 'Fun for all ages' },
    { id: 'group', label: 'Group', icon: <Users size={30} />, desc: 'The more, the merrier' }
  ];

  const handleNext = () => {
    if (formData.dates.start && formData.dates.end) {
      navigate('/planner/step3');
    }
  };

  return (
    <div className="planner-step glass-card">
      <div className="step-header">
        <span className="step-indicator">Step 2 of 4</span>
        <h2>When and with whom?</h2>
        <p>Set your travel dates and choose your traveler type.</p>
      </div>

      <div className="planner-content">
        <div className="date-inputs-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
          <div className="input-group">
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', opacity: 0.7 }}>Check-in</label>
            <div className="input-wrapper">
              <CalendarIcon className="input-icon" size={20} />
              <input 
                type="date" 
                min={today}
                value={formData.dates.start}
                onChange={(e) => setFormData({ dates: { ...formData.dates, start: e.target.value } })}
              />
            </div>
          </div>
          <div className="input-group">
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', opacity: 0.7 }}>Check-out</label>
            <div className="input-wrapper">
              <CalendarIcon className="input-icon" size={20} />
              <input 
                type="date" 
                min={formData.dates.start || today}
                value={formData.dates.end}
                onChange={(e) => setFormData({ dates: { ...formData.dates, end: e.target.value } })}
              />
            </div>
          </div>
        </div>

        <div className="traveler-section">
          <label style={{ display: 'block', marginBottom: '20px', fontWeight: 700, fontSize: '1.1rem' }}>Who is traveling?</label>
          <div className="cards-grid">
            {travelerTypes.map((type) => (
              <div 
                key={type.id}
                className={`option-card glass-card ${formData.travelers === type.id ? 'active' : ''}`}
                onClick={() => setFormData({ travelers: type.id })}
              >
                <div className="icon">{type.icon}</div>
                <h4>{type.label}</h4>
                <p>{type.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="step-footer">
        <button className="btn-secondary" onClick={() => navigate('/planner/step1')}>Back</button>
        <button className="btn-primary" onClick={handleNext} disabled={!formData.dates.start || !formData.dates.end}>
          Next Step
        </button>
      </div>
    </div>
  );
};

export default Step2Dates;
