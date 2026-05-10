import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTripStore from '../../stores/tripStore';
import { Sparkles, Plus, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import './Planner.css';

const Step4Interests = () => {
  const navigate = useNavigate();
  const { formData, setFormData, setGenerating } = useTripStore();
  const { t } = useTranslation();

  // Predefined interests
  const PREDEFINED_INTERESTS = [
    'Nature 🌲', 'Culture 🏛️', 'Gastronomy 🍲', 'Nightlife 💃',
    'Shopping 🛍️', 'Beach 🏖️', 'Architecture 🏗️', 'Adventure 🧗', 'Wellness 🧘'
  ];
  const PREDEFINED_DIETARIES = ['Halal ☪️', 'Vegetarian 🥗', 'Kosher ✡️', 'Gluten-free 🌾'];

  // "Others" input state
  const [showInterestInput, setShowInterestInput] = useState(false);
  const [interestInput, setInterestInput] = useState('');
  const [showDietInput, setShowDietInput] = useState(false);
  const [dietInput, setDietInput] = useState('');

  // Custom (non-predefined) selected items
  const customInterests = formData.interests.filter((i) => !PREDEFINED_INTERESTS.includes(i));
  const customDietaries = formData.dietary.filter((d) => !PREDEFINED_DIETARIES.includes(d));

  const toggleInterest = (interest) => {
    const current = formData.interests;
    if (current.includes(interest)) {
      setFormData({ interests: current.filter((i) => i !== interest) });
    } else {
      setFormData({ interests: [...current, interest] });
    }
  };

  const toggleDietary = (diet) => {
    const current = formData.dietary;
    if (current.includes(diet)) {
      setFormData({ dietary: current.filter((d) => d !== diet) });
    } else {
      setFormData({ dietary: [...current, diet] });
    }
  };

  const addCustomInterest = () => {
    const trimmed = interestInput.trim();
    if (!trimmed || formData.interests.includes(trimmed)) {
      setInterestInput('');
      return;
    }
    setFormData({ interests: [...formData.interests, trimmed] });
    setInterestInput('');
  };

  const addCustomDietary = () => {
    const trimmed = dietInput.trim();
    if (!trimmed || formData.dietary.includes(trimmed)) {
      setDietInput('');
      return;
    }
    setFormData({ dietary: [...formData.dietary, trimmed] });
    setDietInput('');
  };

  const removeCustomInterest = (item) => {
    setFormData({ interests: formData.interests.filter((i) => i !== item) });
  };

  const removeCustomDietary = (item) => {
    setFormData({ dietary: formData.dietary.filter((d) => d !== item) });
  };

  const handleGenerate = () => {
    setGenerating(true);
    navigate('/planner/loading');
  };

  return (
    <div className="planner-step glass-card">
      <div className="step-header">
        <span className="step-indicator">{t('planner.step4Of4')}</span>
        <h2>{t('planner.almostThere')}</h2>
        <p>{t('planner.step4Sub')}</p>
      </div>

      <div className="planner-content">
        <div className="interest-section" style={{ marginBottom: '40px' }}>
          <label className="step-label-lg">{t('planner.whatYouLove')}</label>
          <div className="pill-container">
            {PREDEFINED_INTERESTS.map((item) => (
              <div
                key={item}
                className={`pill ${formData.interests.includes(item) ? 'active' : ''}`}
                onClick={() => toggleInterest(item)}
              >
                {item}
              </div>
            ))}
            {/* Custom-added interests appear as removable pills */}
            {customInterests.map((item) => (
              <div key={item} className="pill active custom-pill">
                <span>{item}</span>
                <button
                  type="button"
                  className="pill-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCustomInterest(item);
                  }}
                  aria-label={`Remove ${item}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {/* "Others" toggle pill */}
            <div
              className={`pill pill-others ${showInterestInput ? 'active' : ''}`}
              onClick={() => setShowInterestInput((s) => !s)}
            >
              <Plus size={14} /> {t('planner.others')}
            </div>
          </div>

          {showInterestInput && (
            <div className="custom-input-row">
              <input
                type="text"
                placeholder={t('planner.typeInterest')}
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomInterest();
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                className="btn-add"
                onClick={addCustomInterest}
                disabled={!interestInput.trim()}
              >
                {t('planner.add')}
              </button>
            </div>
          )}
        </div>

        <div className="dietary-section">
          <label className="step-label-lg">{t('planner.dietaryPrefs')}</label>
          <div className="pill-container">
            {PREDEFINED_DIETARIES.map((item) => (
              <div
                key={item}
                className={`pill ${formData.dietary.includes(item) ? 'active' : ''}`}
                onClick={() => toggleDietary(item)}
              >
                {item}
              </div>
            ))}
            {customDietaries.map((item) => (
              <div key={item} className="pill active custom-pill">
                <span>{item}</span>
                <button
                  type="button"
                  className="pill-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCustomDietary(item);
                  }}
                  aria-label={`Remove ${item}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <div
              className={`pill pill-others ${showDietInput ? 'active' : ''}`}
              onClick={() => setShowDietInput((s) => !s)}
            >
              <Plus size={14} /> {t('planner.others')}
            </div>
          </div>

          {showDietInput && (
            <div className="custom-input-row">
              <input
                type="text"
                placeholder={t('planner.typeDiet')}
                value={dietInput}
                onChange={(e) => setDietInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomDietary();
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                className="btn-add"
                onClick={addCustomDietary}
                disabled={!dietInput.trim()}
              >
                {t('planner.add')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="step-footer">
        <button className="btn-secondary" onClick={() => navigate('/planner/step3')}>{t('planner.back')}</button>
        <button className="btn-primary" onClick={handleGenerate} style={{ display: 'flex', gap: '10px' }}>
          <Sparkles size={18} />
          {t('planner.generate')}
        </button>
      </div>
    </div>
  );
};

export default Step4Interests;
