import React from 'react';
import { Shield, FileText, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import './Legal.css';

const Legal = ({ mode }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isPrivacy = mode === 'privacy';

  return (
    <div className="legal-page">
      <div className="legal-container glass-card">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> {t('legal.back')}
        </button>
        
        <header className="legal-header">
          {isPrivacy ? <Shield size={48} className="legal-icon" /> : <FileText size={48} className="legal-icon" />}
          <h1>{isPrivacy ? t('legal.privacyTitle') : t('legal.termsTitle')}</h1>
          <p>{t('legal.lastUpdated')}: May 2026</p>
        </header>

        <section className="legal-content">
          {isPrivacy ? (
            <>
              <h2>{t('legal.p1Title')}</h2>
              <p>{t('legal.p1Desc')}</p>
              
              <h2>{t('legal.p2Title')}</h2>
              <p>{t('legal.p2Desc')}</p>
              
              <h2>{t('legal.p3Title')}</h2>
              <p>{t('legal.p3Desc')}</p>
            </>
          ) : (
            <>
              <h2>{t('legal.t1Title')}</h2>
              <p>{t('legal.t1Desc')}</p>
              
              <h2>{t('legal.t2Title')}</h2>
              <p>{t('legal.t2Desc')}</p>
              
              <h2>{t('legal.t3Title')}</h2>
              <p>{t('legal.t3Desc')}</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default Legal;
