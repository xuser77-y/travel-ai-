import React from 'react';
import { Globe as GlobeIcon, Share2, Users } from 'lucide-react';
import './Footer.css';
import useTripStore from '../../stores/tripStore';

const Footer = () => {
  const { language: lang } = useTripStore();
  
  const translations = {
    en: {
      desc: 'Your intelligent companion for large-scale adventures and the historic 2030 World Cup.',
      copyright: '© 2026 TRAVIO MOROCCO 2030 OFFICIAL PARTNER.',
      product: 'PRODUCT',
      wc: 'WORLD CUP 2030',
      support: 'SUPPORT'
    },
    fr: {
      desc: 'Votre compagnon intelligent pour les aventures à grande échelle et l\'historique Coupe du Monde 2030.',
      copyright: '© 2026 TRAVIO MAROC 2030 PARTENAIRE OFFICIEL.',
      product: 'PRODUIT',
      wc: 'COUPE DU MONDE 2030',
      support: 'SUPPORT'
    },
    ar: {
      desc: 'رفيقك الذكي للمغامرات الكبيرة وكأس العالم التاريخي 2030.',
      copyright: '© 2026 ترافيو المغرب 2030 الشريك الرسمي.',
      product: 'المنتج',
      wc: 'كأس العالم 2030',
      support: 'الدعم'
    }
  };

  const t = translations[lang] || translations.en;

  return (
    <footer className={`footer-v3 ${lang === 'ar' ? 'rtl' : ''}`}>
      <div className="footer-content">
        <div className="footer-main">
          <div className="logo">
            <img src="/logooo.png" alt="Travio" style={{ height: '48px', width: 'auto' }} />
          </div>
          <p>{t.desc}</p>
          <div className="footer-social">
            <GlobeIcon size={20} />
            <Share2 size={20} />
            <Users size={20} />
          </div>
        </div>
        <div className="footer-links">
          <div className="link-col">
            <h4>{t.product}</h4>
            <a href="#">Planner</a>
            <a href="#">Explore</a>
            <a href="#">Pricing</a>
          </div>
          <div className="link-col">
            <h4>{t.wc}</h4>
            <a href="#">Tickets</a>
            <a href="#">Stadium Guide</a>
            <a href="#">Host Cities</a>
          </div>
          <div className="link-col">
            <h4>{t.support}</h4>
            <a href="#">Help Center</a>
            <a href="#">Community</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom-v3">
        <p>{t.copyright}</p>
      </div>
    </footer>
  );
};

export default Footer;
