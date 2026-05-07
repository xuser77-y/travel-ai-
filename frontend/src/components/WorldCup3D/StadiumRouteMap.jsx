import React, { useMemo } from 'react';
import './StadiumRouteMap.css';

/**
 * Animated curved route lines between Morocco's host cities, drawn as an
 * inline SVG with stroke-dasharray + glowing dots travelling along each path.
 *
 * Why SVG (not three.js):
 *   - This sits inside an already-busy itineraries section. The cost of
 *     spinning up another <Canvas> would be way out of proportion to the
 *     visual payoff.
 *   - SVG paths give crisp lines on every DPI for free.
 *   - The "moving glowing dot" effect is a single CSS animation per dot —
 *     scales to dozens of paths without breaking a sweat.
 *
 * Coords:
 *   - We project (lon, lat) into the SVG viewBox once on mount.
 *   - Routes are quadratic Bezier curves with a control point pushed
 *     perpendicular to the line so the path arcs nicely.
 *
 * Props:
 *   - cities: [{ name, lat, lon }] — same payload the page already has.
 *   - routes: optional [[fromName, toName]] pairs. Defaults to a sensible
 *             set of fan-pilgrimage routes connecting the 6 hosts.
 */

// ---------- Geographic projection ---------------------------------------
// We don't need a real Mercator here — Morocco is small enough that an
// affine fit on the city bounding box is indistinguishable from a proper
// projection at this scale, and it keeps the cities filling the viewBox.
const VB_W = 600;
const VB_H = 420;
const PAD = 60;

const projectCities = (cities) => {
  if (!cities.length) return new Map();
  const lats = cities.map((c) => c.lat);
  const lons = cities.map((c) => c.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  // Add a tiny padding so the markers never sit on the SVG edge.
  const dLat = (maxLat - minLat) || 1;
  const dLon = (maxLon - minLon) || 1;
  const map = new Map();
  cities.forEach((c) => {
    const x = PAD + ((c.lon - minLon) / dLon) * (VB_W - PAD * 2);
    // SVG y axis is inverted vs latitude (north is up).
    const y = PAD + (1 - (c.lat - minLat) / dLat) * (VB_H - PAD * 2);
    map.set(c.name, { x, y });
  });
  return map;
};

// Quadratic Bezier with the control point offset perpendicular to the
// chord. `bend` is the offset magnitude in viewBox units.
const buildPath = (a, b, bend = 60) => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  // Perpendicular unit vector (rotate -90°). Bend toward the top so all
  // curves arc consistently regardless of direction.
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * bend * (ny < 0 ? 1 : -1);
  const cy = my + ny * bend * (ny < 0 ? 1 : -1);
  return `M ${a.x},${a.y} Q ${cx},${cy} ${b.x},${b.y}`;
};

// Default routes connect the major fan corridors. Picked to read well
// visually (no overlapping crossings) rather than to be exhaustive.
const DEFAULT_ROUTES = [
  ['Tangier', 'Rabat'],
  ['Rabat', 'Casablanca'],
  ['Casablanca', 'Marrakech'],
  ['Marrakech', 'Agadir'],
  ['Rabat', 'Fez'],
  ['Fez', 'Marrakech']
];

const StadiumRouteMap = ({ cities = [], routes = DEFAULT_ROUTES }) => {
  const points = useMemo(() => projectCities(cities), [cities]);

  if (!cities.length) return null;

  // Filter out routes that reference cities we don't actually have.
  const validRoutes = routes.filter(
    ([from, to]) => points.has(from) && points.has(to)
  );

  return (
    <div className="srm-wrap" aria-hidden="true">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="srm-svg">
        <defs>
          {/* Two-stop gradient so each arc fades from a sunset orange to a
              softer gold; reads as light moving across the country. */}
          <linearGradient id="srmRouteGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#f97316" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id="srmDotGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%"  stopColor="#fef3c7" stopOpacity="1" />
            <stop offset="60%" stopColor="#f97316" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Routes ------------------------------------------------------ */}
        {validRoutes.map(([from, to], i) => {
          const a = points.get(from);
          const b = points.get(to);
          const d = buildPath(a, b, 70 + (i % 2) * 25);
          return (
            <g key={`${from}-${to}`}>
              {/* Faint static path so the route is visible even when the
                  travelling dot is at the far end. */}
              <path d={d} className="srm-path-bg" />
              {/* Animated dash that draws the path in a loop. */}
              <path d={d} className="srm-path-fg" style={{ animationDelay: `${i * 0.6}s` }} />
              {/* Travelling glow dot — animated via CSS using motion-path. */}
              <circle r="6" fill="url(#srmDotGlow)" className="srm-dot">
                <animateMotion dur={`${4.5 + i * 0.4}s`} repeatCount="indefinite" path={d} />
              </circle>
            </g>
          );
        })}

        {/* City markers ---------------------------------------------- */}
        {cities.map((c) => {
          const p = points.get(c.name);
          if (!p) return null;
          return (
            <g key={c.name} transform={`translate(${p.x},${p.y})`}>
              <circle r="14" className="srm-pin-outer" />
              <circle r="6"  className="srm-pin" />
              <text y="26" className="srm-pin-label">{c.name}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default StadiumRouteMap;
