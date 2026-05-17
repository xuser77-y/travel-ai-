import React from 'react';
import { X, MapPin, Users, Zap, Shield, Globe, Star, Info, Camera } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import './StadiumModal.css';

const StadiumModal = ({ stadium, vrTourUrl = null, onOpenTour, onClose }) => {
  const { t } = useTranslation();
  if (!stadium) return null;

  return (
    <div className="stadium-modal-overlay" onClick={onClose}>
      <div className="stadium-modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={24} />
        </button>

        <div className="modal-hero" style={{ backgroundImage: `url(${stadium.photoUrl})` }}>
          <div className="modal-hero-overlay">
            <div className="modal-title-block">
              <span className="modal-status">{stadium.status}</span>
              <h2>{stadium.stadium}</h2>
              <div className="modal-location">
                <MapPin size={16} />
                <span>{stadium.name}, Morocco</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-grid">
            <div className="modal-info-col">
              <section className="modal-section">
                <h3><Info size={18} /> Overview</h3>
                <p>
                  {stadium.description || `The ${stadium.stadium} is a premier venue for the 2030 World Cup. 
                  Designed by ${stadium.architect}, it represents the pinnacle of 
                  modern sports architecture in North Africa.`}
                </p>
              </section>

              <section className="modal-section">
                <h3><Zap size={18} /> Key Features</h3>
                <ul className="modal-features-list">
                  {stadium.features.map((f, i) => (
                    <li key={i}><Star size={14} /> {f}</li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="modal-stats-col">
              <div className="stat-card">
                <Users className="stat-icon" />
                <div className="stat-value">{stadium.capacity}</div>
                <div className="stat-label">Capacity</div>
              </div>
              
              <div className="stat-card">
                <Shield className="stat-icon" />
                <div className="stat-value">Elite</div>
                <div className="stat-label">Safety Rating</div>
              </div>

              <div className="stat-card">
                <Globe className="stat-icon" />
                <div className="stat-value">Eco-Friendly</div>
                <div className="stat-label">Sustainability</div>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            {vrTourUrl ? (
              <button
                type="button"
                className="modal-btn primary"
                onClick={onOpenTour}
              >
                <Camera size={16} /> {t('worldCup.view360')}
              </button>
            ) : (
              <button
                type="button"
                className="modal-btn primary is-disabled"
                disabled
                title={t('worldCup.view360Soon')}
              >
                <Camera size={16} /> {t('worldCup.view360Soon')}
              </button>
            )}
            <button className="modal-btn secondary" onClick={onClose}>
              {t('worldCup.closeDetails')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StadiumModal;
