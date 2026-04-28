import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, X, MapPin } from 'lucide-react';
import PostcardTilt from './PostcardTilt';
import { DESTINATIONS } from './destinations';
import './DestinationGallery.css';

/*
 * DestinationGallery — simplified horizontal scroll using CSS sticky + Framer Motion.
 * No GSAP, no ScrollTrigger, no pin-spacer issues.
 * Desktop: the track is sticky at top; scroll drives horizontal transform.
 * Mobile: native horizontal overflow scroll.
 */
const DestinationGallery = () => {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const [active, setActive] = useState(null);
  const [trackDistance, setTrackDistance] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Measure track width after mount and on resize
  useEffect(() => {
    const measure = () => {
      const mobile = window.innerWidth <= 900;
      setIsMobile(mobile);
      if (!trackRef.current || !sectionRef.current) return;
      const track = trackRef.current;
      const pin = sectionRef.current.querySelector('.dg-pin');
      if (!pin) return;
      const distance = Math.max(0, track.scrollWidth - pin.clientWidth + 80);
      setTrackDistance(distance);
    };
    measure();
    window.addEventListener('resize', measure);
    // Small delay after images likely loaded
    const t1 = setTimeout(measure, 400);
    const t2 = setTimeout(measure, 1200);
    return () => {
      window.removeEventListener('resize', measure);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Scroll-linked horizontal translation
  const { scrollY } = useScroll();
  const pinTopRef = useRef(0);

  // Track the section top to determine when to start the horizontal phase
  useEffect(() => {
    const update = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      pinTopRef.current = rect.top + window.scrollY;
    };
    update();
    window.addEventListener('resize', update);
    // Remeasure after potential layout shifts
    const t = setTimeout(update, 600);
    return () => {
      window.removeEventListener('resize', update);
      clearTimeout(t);
    };
  }, []);

  // Compute x based on scroll position relative to the pin area start
  const x = useTransform(scrollY, (value) => {
    const start = pinTopRef.current - window.innerHeight; // when pin area enters viewport
    const end = pinTopRef.current + trackDistance; // when track finishes
    const progress = Math.max(0, Math.min(1, (value - start) / (end - start)));
    return -progress * trackDistance;
  });

  // Escape to close modal
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setActive(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onCardClick = (d) => setActive(d);

  return (
    <section ref={sectionRef} className="dest-gallery" id="destinations">
      <div className="dg-header">
        <div className="dg-eyebrow">CURATED DESTINATIONS</div>
        <h2 className="dg-title">
          Explore the <span className="grad">World</span>
        </h2>
        <p className="dg-sub">
          Hand-picked journeys across continents. Each card unlocks a story waiting to be lived.
        </p>
      </div>

      <div className="dg-pin" style={{ height: isMobile ? 'auto' : `${100 + (trackDistance / window.innerHeight) * 100}vh` }}>
        <div className="dg-sticky">
          <div className="dg-track-viewport">
            <motion.div
              ref={trackRef}
              className="dg-track"
              style={isMobile ? undefined : { x }}
            >
              {DESTINATIONS.map((d) => (
                <div className="dg-card-wrap" key={d.id}>
                  <PostcardTilt intensity={10}>
                    <div
                      className="dg-postcard"
                      onClick={() => onCardClick(d)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && onCardClick(d)}
                      aria-label={`Open details for ${d.city}`}
                    >
                      <img src={d.image} alt={d.city} loading="lazy" decoding="async" />
                      <div className="dg-grad" />
                      <div className="dg-card-stamp">{d.country}</div>
                      <div className="dg-card-body">
                        <div className="dg-loc">
                          <MapPin size={12} />
                          <span>{d.city}</span>
                        </div>
                        <h3>{d.city}</h3>
                        <p>{d.tagline}</p>
                        <div className="dg-cta">
                          Explore <ArrowUpRight size={16} />
                        </div>
                      </div>
                    </div>
                  </PostcardTilt>
                </div>
              ))}

              <div className="dg-end-card">
                <h3>
                  Your next <em>adventure</em>
                </h3>
                <p>Choose a destination to begin your personalized itinerary.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            className="dg-expand"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
          >
            <div className="dg-expand-inner" onClick={(e) => e.stopPropagation()}>
              <button
                className="dg-close"
                onClick={() => setActive(null)}
                aria-label="Close"
              >
                <X size={22} />
              </button>
              <div className="dg-expand-img">
                <img src={active.image} alt={active.city} />
              </div>
              <div className="dg-expand-meta">
                <div className="dg-expand-loc">
                  <MapPin size={14} />
                  <span>{active.country}</span>
                </div>
                <h2>{active.city}</h2>
                <p className="dg-expand-tag">{active.tagline}</p>
                <p className="dg-expand-desc">{active.description}</p>
                <div className="dg-expand-coords">
                  <span>LAT {active.coords[0].toFixed(4)}</span>
                  <span>LON {active.coords[1].toFixed(4)}</span>
                </div>
                <button className="dg-expand-cta">
                  Start Planning <ArrowUpRight size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default DestinationGallery;
