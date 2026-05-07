import React, { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, CheckCircle, Shield, Zap, Globe as GlobeIcon, Users, Share2
} from 'lucide-react';
import './Landing.css';
import useTripStore from '../stores/tripStore';

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
  const { language: lang } = useTripStore();
  // Only show the intro the first time the user arrives at "/" in this page session.
  const [showIntro] = useState(() => !HAS_PLAYED_INTRO);
  const [introDone, setIntroDone] = useState(HAS_PLAYED_INTRO);

  const markIntroDone = () => {
    HAS_PLAYED_INTRO = true;
    setIntroDone(true);
  };

  const content = {
    en: {
      eyebrow: 'TRAVEL · INTELLIGENCE',
      titleA: 'Your world,',
      titleB: 'perfectly planned.',
      subtitle:
        'AI-crafted itineraries, real-time intelligence, and a touch of luxury — built for the way you travel now.',
      start: 'Start Planning',
      demo: 'Watch Demo'
    },
    fr: {
      eyebrow: 'VOYAGE · INTELLIGENCE',
      titleA: 'Votre monde,',
      titleB: 'parfaitement planifié.',
      subtitle:
        "Itinéraires conçus par l'IA, intelligence en temps réel, et une touche de luxe — fait pour votre façon de voyager.",
      start: 'Commencer',
      demo: 'Voir Démo'
    },
    ar: {
      eyebrow: 'سفر · ذكاء',
      titleA: 'عالمك،',
      titleB: 'مخطط بمثالية.',
      subtitle: 'مسارات مدعومة بالذكاء الاصطناعي ومعلومات فورية مع لمسة من الفخامة.',
      start: 'ابدأ التخطيط',
      demo: 'شاهد العرض'
    }
  };

  const t = content[lang] || content.en;

  return (
    <div className={`landing-page ${lang === 'ar' ? 'rtl' : ''}`}>
      {showIntro && !introDone && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <IntroExperience onComplete={markIntroDone} />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Premium Hero with Globe */}
      <PremiumHero t={t} />

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
          Built for <span className="gradient-text">modern travelers</span>
        </motion.h2>
        <motion.p className="section-subtitle" {...fadeUp}>
          Three quiet superpowers behind every great trip.
        </motion.p>
        <div className="features-grid">
          {[
            { icon: <Zap size={24} />, title: 'AI Itinerary', desc: 'Personalized day-by-day plans that adapt to delays, weather, and your taste — in real time.' },
            { icon: <Shield size={24} />, title: 'Budget Optimizer', desc: 'Financial forecasting suggests the best booking windows and uncovers hidden deals automatically.' },
            { icon: <CheckCircle size={24} />, title: 'Real-Time Data', desc: 'Live integration with stadiums, flights, and local transport for a seamless on-the-ground experience.' }
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
            <h2 className="section-title">The World is Coming to Morocco 2030.</h2>
            <p>Official AI concierge for the 2030 FIFA World Cup. Secure your tickets, book your stay, and navigate across three host nations with precision.</p>
            <button className="btn-primary" onClick={() => navigate('/worldcup')}>
              Explore World Cup Hub <ArrowRight size={18} />
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
        <motion.h2 className="section-title" {...fadeUp}>How it works</motion.h2>
        <div className="steps-container">
          {[
            { n: '01', icon: <GlobeIcon />, title: 'Dream', desc: 'Tell the AI where, when, and how. Thousands of routes considered in seconds.' },
            { n: '02', icon: <Zap />, title: 'Book', desc: 'One-click flights, hotels, and shuttles with guaranteed lowest prices.' },
            { n: '03', icon: <Users />, title: 'Go', desc: 'Live navigation, match updates, and real-time travel intelligence on the ground.' }
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
        <motion.h2 className="section-title" {...fadeUp}>Traveler stories</motion.h2>
        <div className="testimonials-grid">
          {[
            { name: 'Mark Thompson', loc: 'London, UK', text: "Travio predicted the traffic surge in Casablanca and re-routed my shuttle 30 mins before the match. I didn't miss a second.", rating: 5 },
            { name: 'Elena Rodriguez', loc: 'Madrid, Spain', text: 'The budget optimizer saved me $400 on my flight from Madrid to Marrakech by finding a route I never knew existed.', rating: 5 },
            { name: 'Joao Silva', loc: 'Lisbon, Portugal', text: 'Navigating through Portugal was effortless. AI-integrated rail passes were always one step ahead of my schedule.', rating: 5 }
          ].map((s, i) => (
            <motion.div
              key={s.name}
              className="testimonial-card glass-card"
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.1 }}
            >
              <div className="stars">
                {[...Array(s.rating)].map((_, k) => <span key={k}>★</span>)}
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
