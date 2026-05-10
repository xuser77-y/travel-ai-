import React, { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, CheckCircle, Shield, Zap, Globe as GlobeIcon, Users
} from 'lucide-react';
import './Landing.css';
import useTripStore from '../stores/tripStore';
import { useTranslation } from '../hooks/useTranslation';

import ErrorBoundary from '../components/Cinematic/ErrorBoundary';
import PremiumHero from '../components/Cinematic/PremiumHero';
// Lazy-load below-the-fold sections
const IntroExperience = lazy(() => import('../components/Cinematic/IntroExperience'));
const DestinationGallery = lazy(() => import('../components/Cinematic/DestinationGallery'));
const MapReveal = lazy(() => import('../components/Cinematic/MapReveal'));

/**
 * Module-level flag — survives client-side navigation (SPA route changes)
 * but resets on full page reload (because the JS bundle re-evaluates).
 * Result: intro plays on first visit + on F5/refresh, but NOT when the
 * user navigates Home -> Planner -> Home again.
 */
let HAS_PLAYED_INTRO = false;

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
};

const Landing = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // Only show the intro the first time the user arrives at "/" in this page session.
  const [showIntro] = useState(() => !HAS_PLAYED_INTRO);
  const [introDone, setIntroDone] = useState(HAS_PLAYED_INTRO);

  const markIntroDone = () => {
    HAS_PLAYED_INTRO = true;
    setIntroDone(true);
  };

  return (
    <div className="landing-page">
      {showIntro && !introDone && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <IntroExperience onComplete={markIntroDone} />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Premium Hero with Globe */}
      <PremiumHero t={(key) => t(`landing.${key}`)} />

      {/* Destination Postcard Gallery (horizontal scroll) */}
      <ErrorBoundary fallback={null}>
        <Suspense fallback={<div className="dg-fallback" aria-hidden />}>
          <DestinationGallery />
        </Suspense>
      </ErrorBoundary>

      {/* Map Reveal */}
      <ErrorBoundary fallback={null}>
        <Suspense fallback={<div className="mr-fallback" aria-hidden />}>
          <MapReveal />
        </Suspense>
      </ErrorBoundary>

      {/* Features */}
      <section className="features-v2">
        <motion.h2 className="section-title" {...fadeUp}>
          {t('landing.featuresTitle')} <span className="gradient-text">{t('landing.featuresTitleHighlight')}</span>
        </motion.h2>
        <motion.p className="section-subtitle" {...fadeUp}>
          {t('landing.featuresSub')}
        </motion.p>
        <div className="features-grid">
          {[
            { icon: <Zap size={24} />, title: t('landing.f1Title'), desc: t('landing.f1Desc') },
            { icon: <Shield size={24} />, title: t('landing.f2Title'), desc: t('landing.f2Desc') },
            { icon: <CheckCircle size={24} />, title: t('landing.f3Title'), desc: t('landing.f3Desc') }
          ].map((f, i) => (
            <motion.div
              key={f.title}
              className="feature-card-v2 glass-card"
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.1 }}
            >
              <div className="f-icon-box">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Morocco 2030 */}
      <section className="wc-showcase">
        <motion.div className="wc-showcase-card" {...fadeUp}>
          <div className="wc-showcase-content">
            <h2 className="section-title">{t('landing.wcTitle')}</h2>
            <p>{t('landing.wcDesc')}</p>
            <button className="btn-primary" onClick={() => navigate('/worldcup')}>
              {t('landing.wcBtn')} <ArrowRight size={18} />
            </button>
          </div>
          <div className="wc-showcase-visual">
            <div className="stacked-cards">
              <div className="s-card card-1"><img src="/assets/stadiums/2030.png" alt="Stadium" loading="lazy" /></div>
              <div className="s-card card-2"><img src="https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg" alt="Football" loading="lazy" /></div>
              <div className="s-card card-3"><img src="/assets/stadiums/morrocco.jpg" alt="Morocco" loading="lazy" /></div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* How it Works */}
      <section className="how-it-works">
        <motion.h2 className="section-title" {...fadeUp}>{t('landing.hiwTitle')}</motion.h2>
        <div className="steps-container">
          {[
            { n: '01', icon: <GlobeIcon />, title: t('landing.hiw1Title'), desc: t('landing.hiw1Desc') },
            { n: '02', icon: <Zap />, title: t('landing.hiw2Title'), desc: t('landing.hiw2Desc') },
            { n: '03', icon: <Users />, title: t('landing.hiw3Title'), desc: t('landing.hiw3Desc') }
          ].map((s, i) => (
            <React.Fragment key={s.n}>
              <motion.div
                className="step-item"
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.12 }}
              >
                <div className="step-number">{s.n}</div>
                <div className="step-icon-box">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </motion.div>
              {i < 2 && <div className="step-connector"><ArrowRight /></div>}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <motion.h2 className="section-title" {...fadeUp}>{t('landing.testiTitle')}</motion.h2>
        <div className="testimonials-grid">
          {(Array.isArray(t('landing.testimonials')) ? t('landing.testimonials') : []).map((s, i) => (
            <motion.div
              key={s.name}
              className="testimonial-card glass-card"
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.1 }}
            >
              <div className="stars">
                {[...Array(5)].map((_, k) => <span key={k}>★</span>)}
              </div>
              <p>"{s.text}"</p>
              <div className="testi-user">
                <img src={`https://i.pravatar.cc/150?u=${i + 10}`} alt={s.name} loading="lazy" />
                <div>
                  <h4>{s.name}</h4>
                  <span>{s.loc}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
};

export default Landing;
