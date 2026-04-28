import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, MapPin } from 'lucide-react';
import { DESTINATIONS } from './destinations';
import './IntroExperience.css';

const IntroExperience = ({ onComplete }) => {
  const [phase, setPhase] = useState('loading'); // loading | cards | finale | done
  const [activeIdx, setActiveIdx] = useState(-1);

  // Stabilize onComplete via ref so the effect deps don't change between renders.
  // This is what previously caused the intro to replay (parent's inline arrow
  // gave a new reference on every render, retriggering the effect).
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    // Sequence: loading -> cards (staggered) -> finale -> done.
    // StrictMode double-mounts in dev: cleanup clears the first batch, second
    // mount runs the only batch the user sees. Production runs exactly once.
    const timers = [];
    timers.push(setTimeout(() => setPhase('cards'), 600));
    DESTINATIONS.forEach((_, i) => {
      timers.push(setTimeout(() => setActiveIdx(i), 700 + i * 380));
    });
    timers.push(setTimeout(() => setPhase('finale'), 700 + DESTINATIONS.length * 380 + 300));
    timers.push(setTimeout(() => {
      setPhase('done');
      onCompleteRef.current?.();
    }, 700 + DESTINATIONS.length * 380 + 1800));
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleSkip = () => {
    setPhase('done');
    onCompleteRef.current?.();
  };

  if (phase === 'done') return null;

  return (
    <AnimatePresence>
      <motion.div
        className="intro-experience"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* Ambient gradient bg with shifting hue */}
        <div className="intro-bg" />
        <div className="intro-grain" />

        {/* Header label */}
        <motion.div
          className="intro-brand"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="brand-dot" />
          <span>TRAVEL · AI</span>
        </motion.div>

        {/* Postcard Stage */}
        <div className="intro-stage" style={{ perspective: 1800 }}>
          {DESTINATIONS.map((d, i) => {
            const isActive = i === activeIdx;
            const wasShown = i < activeIdx;
            const offsetX = (i - activeIdx) * 30;
            const offsetZ = wasShown ? -200 - (activeIdx - i) * 40 : isActive ? 0 : 220;
            const rotZ = (i - activeIdx) * 4;
            const opacity = i > activeIdx ? 0 : wasShown ? 0.35 : 1;
            const scale = isActive ? 1 : wasShown ? 0.78 : 0.92;
            return (
              <motion.div
                key={d.id}
                className="postcard-3d"
                style={{ '--accent': d.color }}
                initial={{ opacity: 0, scale: 0.7, rotateY: 30, z: 400 }}
                animate={{
                  opacity,
                  x: offsetX,
                  z: offsetZ,
                  scale,
                  rotateY: isActive ? 0 : wasShown ? -12 : 18,
                  rotateZ: rotZ
                }}
                transition={{
                  type: 'spring',
                  damping: 22,
                  stiffness: 110,
                  mass: 0.9
                }}
              >
                <div className="postcard-shine" />
                <img src={d.image} alt={d.city} loading={i < 2 ? 'eager' : 'lazy'} draggable={false} />
                <div className="postcard-overlay">
                  <div className="postcard-meta">
                    <MapPin size={14} />
                    <span>{d.country}</span>
                  </div>
                  <h2 className="postcard-city">{d.city}</h2>
                  <p className="postcard-tagline">{d.tagline}</p>
                </div>
                <div className="postcard-stamp">N° 0{i + 1}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom progress + skip */}
        <div className="intro-foot">
          <div className="intro-progress">
            {DESTINATIONS.map((d, i) => (
              <span
                key={d.id}
                className={`pdot ${i <= activeIdx ? 'on' : ''}`}
                style={{ background: i <= activeIdx ? d.color : undefined }}
              />
            ))}
          </div>
          <button className="intro-skip" onClick={handleSkip} aria-label="Skip intro">
            Skip <ChevronRight size={16} />
          </button>
        </div>

        {/* Finale */}
        <AnimatePresence>
          {phase === 'finale' && (
            <motion.div
              className="intro-finale"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1>The world,<br /><span className="grad">in your pocket.</span></h1>
              <p>Curated by AI. Crafted for you.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default IntroExperience;
