import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion';
import './PostcardTilt.css';

/**
 * Hover-tilt postcard wrapper. Wraps any element with
 * a smooth 3D rotation tracking the mouse, plus a parallax
 * shine. Pure framer-motion (no re-renders on mousemove).
 */
const PostcardTilt = ({ children, intensity = 14, className = '', glare = true }) => {
  const ref = useRef(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const smX = useSpring(mx, { stiffness: 220, damping: 22 });
  const smY = useSpring(my, { stiffness: 220, damping: 22 });

  const rotateY = useTransform(smX, [0, 1], [-intensity, intensity]);
  const rotateX = useTransform(smY, [0, 1], [intensity, -intensity]);
  const glareX = useTransform(smX, [0, 1], ['0%', '100%']);
  const glareY = useTransform(smY, [0, 1], ['0%', '100%']);
  const background = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.28), transparent 55%)`;

  const handleMouseMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width);
    my.set((e.clientY - rect.top) / rect.height);
  };

  const handleLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      className={`tilt-card ${className}`}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleLeave}
      whileHover={{ scale: 1.03 }}
      transition={{ scale: { type: 'spring', damping: 18, stiffness: 200 } }}
    >
      <div className="tilt-inner" style={{ transform: 'translateZ(40px)' }}>
        {children}
      </div>
      {glare && <motion.div className="tilt-glare" style={{ background }} />}
    </motion.div>
  );
};

export default PostcardTilt;
