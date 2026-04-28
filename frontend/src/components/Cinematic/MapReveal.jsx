import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass } from 'lucide-react';
import { DESTINATIONS } from './destinations';
import './MapReveal.css';

// Custom map markers
const makeIcon = (color) =>
  L.divIcon({
    className: 'mr-pin',
    html: `<span class="mr-pin-core" style="--c:${color}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

// Animated map fly-through controller
const MapAutoFly = ({ destinations, active }) => {
  const map = useMap();
  useEffect(() => {
    if (!destinations[active]) return;
    map.flyTo(destinations[active].coords, 5, {
      duration: 2.4,
      easeLinearity: 0.25
    });
  }, [active, destinations, map]);
  return null;
};

const MapReveal = () => {
  const sectionRef = useRef(null);
  const [active, setActive] = useState(0);
  // useScroll without `target` falls back to the document scroll, which is
  // always non-static and avoids the "static container" warning when the
  // target ref isn't attached yet on first render.
  const { scrollYProgress: docProgress } = useScroll();
  const [bounds, setBounds] = useState({ top: 0, height: 1 });

  // Measure section position once it's mounted (and on resize) so we can
  // map document scroll to a 0-1 progress for this section.
  useEffect(() => {
    const measure = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      setBounds({ top, height: rect.height });
    };
    measure();
    window.addEventListener('resize', measure);
    const t = setTimeout(measure, 600);
    return () => {
      window.removeEventListener('resize', measure);
      clearTimeout(t);
    };
  }, []);

  // Synthesize a per-section progress value (0 when section enters viewport,
  // 1 when section leaves), without needing useScroll's target option.
  const scrollYProgress = useTransform(docProgress, (v) => {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const y = v * docHeight;
    const start = bounds.top - window.innerHeight;
    const end = bounds.top + bounds.height;
    return Math.max(0, Math.min(1, (y - start) / (end - start)));
  });

  // Pre-map "frame" zoom: scales from a small image into the map
  const frameScale = useTransform(scrollYProgress, [0, 0.4], [0.6, 1]);
  const frameOpacity = useTransform(scrollYProgress, [0, 0.15, 0.4], [0, 1, 1]);
  const overlayOpacity = useTransform(scrollYProgress, [0.25, 0.45], [1, 0]);
  const titleY = useTransform(scrollYProgress, [0.05, 0.3], [40, 0]);

  // Auto-cycle through destinations once map is in view
  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % DESTINATIONS.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <section ref={sectionRef} className="map-reveal">
      <motion.div
        className="mr-title-wrap"
        style={{ y: titleY }}
      >
        <motion.div
          className="mr-eyebrow"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Compass size={14} /> NAVIGATION · LIVE MAP
        </motion.div>
        <motion.h2
          className="mr-title"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          From a postcard <span className="grad">to a place</span>.
        </motion.h2>
        <motion.p
          className="mr-sub"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          Zoom from the dream into the streets. Real maps, real time.
        </motion.p>
      </motion.div>

      <motion.div
        className="mr-frame"
        style={{ scale: frameScale, opacity: frameOpacity }}
      >
        <div className="mr-glow" aria-hidden />
        <div className="mr-map-shell">
          <MapContainer
            center={DESTINATIONS[0].coords}
            zoom={4}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            dragging={false}
            zoomControl={false}
            attributionControl={false}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MapAutoFly destinations={DESTINATIONS} active={active} />
            {DESTINATIONS.map((d) => (
              <Marker key={d.id} position={d.coords} icon={makeIcon(d.color)}>
                <Popup>
                  <div className="mr-popup">
                    <strong>{d.city}</strong>
                    <span>{d.country}</span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <motion.div
            className="mr-cover"
            style={{ opacity: overlayOpacity }}
            aria-hidden
          >
            <div className="mr-cover-grid" />
            <div className="mr-cover-text">
              <span className="mr-cover-eyebrow">PREPARING ROUTE</span>
              <span className="mr-cover-coords">
                {DESTINATIONS[active].coords[0].toFixed(2)}° N · {DESTINATIONS[active].coords[1].toFixed(2)}° E
              </span>
            </div>
          </motion.div>
        </div>

        {/* Active destination badge */}
        <div className="mr-active-card">
          <div className="mr-active-pulse" style={{ background: DESTINATIONS[active].color }} />
          <div>
            <span className="mr-active-label">NOW ZOOMING TO</span>
            <strong>{DESTINATIONS[active].city}</strong>
            <small>{DESTINATIONS[active].tagline}</small>
          </div>
        </div>

        {/* Bottom dots */}
        <div className="mr-dots">
          {DESTINATIONS.map((d, i) => (
            <button
              key={d.id}
              className={`mr-dot ${i === active ? 'on' : ''}`}
              style={i === active ? { background: d.color } : undefined}
              onClick={() => setActive(i)}
              aria-label={`Go to ${d.city}`}
            />
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default MapReveal;
