import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Globe, Moon, Sun, User, LogOut, Menu, X, Trophy,
  LayoutDashboard, Settings as SettingsIcon, Shield, CreditCard, Sparkles
} from 'lucide-react';
import useTripStore from '../../stores/tripStore';
import { useTranslation } from '../../hooks/useTranslation';
import NotificationDropdown from './NotificationDropdown';
import './Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleDarkMode, language, setLanguage, user, logout } = useTripStore();
  const { t } = useTranslation();
  // Note: nav links are intentionally always visible (freemium UX).
  // Restriction happens INSIDE each premium page via <FreemiumGate>:
  // free users still see the page but it's blurred + an upgrade modal
  // is shown on top. This matches the spec — "All premium features
  // remain visible in the navbar but become restricted".

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);

  const langRef = useRef(null);
  const userRef = useRef(null);
  const menuRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) setIsLangOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setIsUserOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setIsLangOpen(false);
    setIsUserOpen(false);
  }, [location.pathname]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setIsLangOpen(false);
        setIsUserOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);



  const handleLangSelect = (code) => {
    setLanguage(code);
    setIsLangOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsUserOpen(false);
    navigate('/');
  };

  return (
    <nav className={`navbar ${language === 'ar' ? 'rtl' : ''}`} aria-label="Primary">
      <div className="nav-container">
        <Link to="/" className="nav-logo" aria-label="Travio Home">
          <img src="/logooo.png" alt="Travio" className="logo-img" style={{ height: '48px', width: 'auto' }} />
        </Link>

        <div ref={menuRef} className={`nav-links ${isMenuOpen ? 'active' : ''}`}>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>{t('nav.home')}</NavLink>
          <NavLink to="/planner" className={({ isActive }) => isActive ? 'active' : ''}>{t('nav.explore')}</NavLink>
          <NavLink to="/worldcup" className={({ isActive }) => isActive ? 'active' : ''}>{t('nav.worldcup')}</NavLink>
          <NavLink to="/livemap" className={({ isActive }) => isActive ? 'active' : ''}>{t('nav.livemap')}</NavLink>
          <NavLink to="/community" className={({ isActive }) => isActive ? 'active' : ''}>{t('nav.community')}</NavLink>
        </div>

        <div className="nav-actions">
          <div className="lang-selector-wrapper" ref={langRef}>
            <button
              className="lang-btn"
              onClick={() => { setIsLangOpen(v => !v); setIsUserOpen(false); }}
              aria-haspopup="menu"
              aria-expanded={isLangOpen}
              aria-label="Language"
            >
              <Globe size={18} />
              <span className="lang-code">{language.toUpperCase()}</span>
            </button>
            {isLangOpen && (
              <div className="lang-dropdown" role="menu">
                <button onClick={() => handleLangSelect('en')} className={language === 'en' ? 'active' : ''}>English</button>
                <button onClick={() => handleLangSelect('fr')} className={language === 'fr' ? 'active' : ''}>Français</button>
                <button onClick={() => handleLangSelect('ar')} className={language === 'ar' ? 'active' : ''}>العربية</button>
              </div>
            )}
          </div>

          <button
            className="theme-toggle"
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user && <NotificationDropdown />}

          {/* Freemium counter pill — shows the user how many free uses
              they have left across all premium features. Hidden for
              admins and paid plans (they're unlimited). Clicking it
              jumps to /billing for an easy upgrade path. */}
          {user?.subscription?.freemium && !user.subscription.freemium.unlimited && (
            <Link
              to="/billing"
              className={`freemium-pill ${user.subscription.freemium.locked ? 'locked' : ''}`}
              title={user.subscription.freemium.locked
                ? 'You\'ve used all your free explorations. Upgrade to continue.'
                : `${user.subscription.freemium.remaining} free explorations left`
              }
            >
              <Sparkles size={13} />
              {user.subscription.freemium.locked
                ? 'Upgrade'
                : `${user.subscription.freemium.remaining}/${user.subscription.freemium.limit} free`}
            </Link>
          )}

          {user ? (
            <div className="user-menu-wrapper" ref={userRef}>
              <button
                className="user-profile-btn"
                onClick={() => { setIsUserOpen(v => !v); setIsLangOpen(false); }}
                aria-haspopup="menu"
                aria-expanded={isUserOpen}
              >
                <div className="avatar-circle">{user.name?.[0]?.toUpperCase() || 'U'}</div>
                <span className="user-name-small">{user.name?.split(' ')[0]}</span>
              </button>
              {isUserOpen && (
                <div className="profile-dropdown" role="menu">
                  <div className="dropdown-header">
                    <span className="welcome-text">{t('nav.welcome')},</span>
                    <h4>{user.name}</h4>
                  </div>
                  <div className="dropdown-links">
                    <Link to="/dashboard"><LayoutDashboard size={16} /> {t('nav.dashboard')}</Link>
                    <Link to="/billing"><CreditCard size={16} /> Billing &amp; Plan</Link>
                    <Link to="/settings"><SettingsIcon size={16} /> {t('nav.settings')}</Link>
                    {user.isAdmin && (
                      <Link to="/admin" className="admin-link">
                        <Shield size={16} /> Admin
                      </Link>
                    )}
                    <hr />
                    <button className="logout-link" onClick={handleLogout}>
                      <LogOut size={16} /> {t('nav.logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-login">
              <User size={16} />
              <span>{t('nav.login')}</span>
            </Link>
          )}

          <button
            className="mobile-menu-btn"
            onClick={() => setIsMenuOpen(v => !v)}
            aria-label="Toggle navigation"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
