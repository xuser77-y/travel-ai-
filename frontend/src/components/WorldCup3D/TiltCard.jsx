import React, { useRef } from 'react';
import './TiltCard.css';

/**
 * Pointer-driven 3D tilt wrapper for the stadium / itinerary cards.
 *
 * Why not react-three-fiber here:
 *   - Each card needs to keep its existing DOM (image + text + buttons),
 *     and re-implementing them in 3D would break a11y, SSR, and theming.
 *   - A single CSS transform per card driven from `pointermove` gives us
 *     the Apple-style "tilt + lift" effect with zero WebGL overhead.
 *   - Cheap on mobile too — pointer events are touch-aware and the
 *     transform falls back to a normal hover on devices without hover.
 *
 * Effects:
 *   - Tilts up to ±10° around X/Y based on cursor position.
 *   - Adds a soft "lift" via translateZ.
 *   - Drives a CSS variable `--mx`/`--my` so children can render a
 *     light-sweep highlight from the cursor (see `.tilt-card::after`).
 *
 * On `pointerleave` we smoothly release the transform back to neutral.
 */

const MAX_TILT = 9;     // degrees — gentle, not gimmicky
const LIFT = 14;        // px — translateZ on hover

const TiltCard = ({ as: Tag = 'div', className = '', children, ...rest }) => {
  const ref = useRef(null);

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;   // 0..1 across card
    const y = (e.clientY - rect.top)  / rect.height;
    const ry = (x - 0.5) * 2 *  MAX_TILT;             // left = neg, right = pos
    const rx = (y - 0.5) * 2 * -MAX_TILT;             // top  = pos, bot   = neg
    el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    el.style.setProperty('--lift', `${LIFT}px`);
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--lift', '0px');
  };

  return (
    <Tag
      ref={ref}
      className={`tilt-card ${className}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      {...rest}
    >
      <div className="tilt-card-inner">{children}</div>
    </Tag>
  );
};

export default TiltCard;
