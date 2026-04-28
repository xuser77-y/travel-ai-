import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Globe from 'react-globe.gl';
import { ArrowRight, Play, Sparkles, Globe as GlobeIcon, Zap, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './PremiumHero.css';

const PremiumHero = ({ t }) => {
  const navigate = useNavigate();
  const globeRef = useRef(null);
  const [size, setSize] = useState(window.innerWidth > 768 ? 520 : 320);

  useEffect(() => {
    const onResize = () => setSize(window.innerWidth > 768 ? 520 : 320);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;
    try {
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.6;
      controls.enableZoom = false;
    } catch (_) { /* noop */ }
  }, []);

  // sample arcs to make the globe feel alive
  const arcs = [
    { startLat: 33.5731, startLng: -7.5898, endLat: 48.8566, endLng: 2.3522, color: '#eab308' },
    { startLat: 48.8566, startLng: 2.3522, endLat: 35.6762, endLng: 139.6503, color: '#a855f7' },
    { startLat: 35.6762, startLng: 139.6503, endLat: 25.2048, endLng: 55.2708, color: '#f97316' },
    { startLat: 25.2048, startLng: 55.2708, endLat: 31.6295, endLng: -7.9811, color: '#3b82f6' }
  ];

  const points = [
    { lat: 33.5731, lng: -7.5898, color: '#eab308', size: 0.4 },
    { lat: 48.8566, lng: 2.3522, color: '#a855f7', size: 0.4 },
    { lat: 35.6762, lng: 139.6503, color: '#f97316', size: 0.4 },
    { lat: 25.2048, lng: 55.2708, color: '#3b82f6', size: 0.4 },
    { lat: 31.6295, lng: -7.9811, color: '#10b981', size: 0.4 }
  ];

  return (
    <section className="ph-hero">
      <div className="ph-bg-grad" aria-hidden />
      <div className="ph-bg-stars" aria-hidden />

      <div className="ph-content-row">
        {/* Left: copy */}
        <div className="ph-text-col">
          <motion.div
            className="ph-eyebrow"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <Sparkles size={14} />
            <span>{t.eyebrow}</span>
          </motion.div>

          <motion.h1
            className="ph-title"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {t.titleA}
            <br />
            <span className="ph-title-grad">{t.titleB}</span>
          </motion.h1>

          <motion.p
            className="ph-sub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            {t.subtitle}
          </motion.p>

          <motion.div
            className="ph-ctas"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <button className="ph-btn primary" onClick={() => navigate('/planner')}>
              {t.start} <ArrowRight size={18} />
            </button>
            <button className="ph-btn ghost">
              <Play size={16} fill="currentColor" /> {t.demo}
            </button>
          </motion.div>

          <motion.div
            className="ph-proof"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.9 }}
          >
            <div className="ph-avatars">
              {[1, 2, 3].map((i) => (
                <img key={i} src={`https://i.pravatar.cc/80?u=traveler-${i}`} alt="" loading="lazy" />
              ))}
              <div className="ph-avatar-more">+12</div>
            </div>
            <p>
              <strong>12 travelers</strong> heading to Marrakech
            </p>
          </motion.div>
        </div>

        {/* Right: globe + floating badges */}
        <div className="ph-globe-col">
          <motion.div
            className="ph-globe-wrap"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="ph-globe-glow" />

            <motion.div
              className="ph-badge ph-badge-tl"
              initial={{ opacity: 0, x: -30, y: -10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.7, delay: 1 }}
            >
              <div className="ph-badge-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                <GlobeIcon size={16} />
              </div>
              <div className="ph-badge-text">
                <span>GLOBAL TRIPS</span>
                <strong>3.2M+</strong>
                <small>Active Travelers</small>
              </div>
            </motion.div>

            <motion.div
              className="ph-badge ph-badge-br"
              initial={{ opacity: 0, x: 30, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.7, delay: 1.2 }}
            >
              <div className="ph-badge-icon" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
                <Zap size={16} />
              </div>
              <div className="ph-badge-text">
                <span>AI OPTIMIZED</span>
                <strong>2.4ms</strong>
                <small>Processing Speed</small>
              </div>
            </motion.div>

            <motion.div
              className="ph-badge ph-badge-bl"
              initial={{ opacity: 0, x: -30, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.7, delay: 1.4 }}
            >
              <div className="ph-badge-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                <Users size={16} />
              </div>
              <div className="ph-badge-text">
                <span>COMMUNITY</span>
                <strong>240K+</strong>
                <small>Daily Posts</small>
              </div>
            </motion.div>

            <Globe
              ref={globeRef}
              width={size}
              height={size}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              atmosphereColor="#3b82f6"
              atmosphereAltitude={0.18}
              arcsData={arcs}
              arcColor="color"
              arcDashLength={0.5}
              arcDashGap={1.5}
              arcDashAnimateTime={2500}
              arcStroke={0.4}
              arcAltitudeAutoScale={0.4}
              pointsData={points}
              pointColor="color"
              pointAltitude={0.02}
              pointRadius="size"
            />
          </motion.div>
        </div>
      </div>

      <motion.div
        className="ph-scroll-hint"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.6 }}
      >
        <span>SCROLL</span>
        <div className="ph-scroll-line" />
      </motion.div>
    </section>
  );
};

export default PremiumHero;
