import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Globe from 'react-globe.gl';
import axios from 'axios';
import useTripStore from '../../stores/tripStore';
import { useTranslation } from '../../hooks/useTranslation';
import { Sparkles, MapPin, Calendar, Wallet, Heart, Check, AlertTriangle, RefreshCw, ArrowLeft, Lock } from 'lucide-react';
import './Loading.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STEPS = [
  { id: 1, icon: MapPin, labelKey: 'planner.loadStep1', detailKey: 'planner.loadStep1Desc' },
  { id: 2, icon: Sparkles, labelKey: 'planner.loadStep2', detailKey: 'planner.loadStep2Desc' },
  { id: 3, icon: Heart, labelKey: 'planner.loadStep3', detailKey: 'planner.loadStep3Desc' },
  { id: 4, icon: Wallet, labelKey: 'planner.loadStep4', detailKey: 'planner.loadStep4Desc' },
  { id: 5, icon: Calendar, labelKey: 'planner.loadStep5', detailKey: 'planner.loadStep5Desc' }
];

const Loading = () => {
  const navigate = useNavigate();
  const { formData, setTrip, setGenerating, token } = useTripStore();
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState(null);
  const [upgradeInfo, setUpgradeInfo] = useState(null);
  const [done, setDone] = useState(false);
  const globeRef = useRef();
  // React 18 StrictMode mounts effects twice in dev. Without this guard we
  // were firing POST /generate twice → 2 trips saved + 2 freemium uses
  // burned per click, which is why the user was hitting "0 free" after a
  // single create+refine and finding duplicate trips on the dashboard.
  // The ref persists across the unmount/remount cycle so the second call
  // is silently skipped without losing UX progress on the first.
  const generationStarted = useRef(false);
  const isDarkMode = !document.body.classList.contains('light-mode');

  // Progress timer (advances visually while API call is in flight)
  useEffect(() => {
    if (generationStarted.current) return;
    generationStarted.current = true;

    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 1.5;
    }

    const stepInterval = setInterval(() => {
      setActiveStep((s) => {
        if (s >= STEPS.length - 1) {
          clearInterval(stepInterval);
          return s;
        }
        return s + 1;
      });
    }, 1500);

    const generateTrip = async () => {
      try {
        const res = await axios.post(
          `${API}/api/trips/generate`,
          formData,
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
        );
        // Wait until at least the last step is shown for a smooth UX
        const finishUp = () => {
          setActiveStep(STEPS.length - 1);
          setDone(true);
          setTimeout(() => {
            setTrip(res.data);
            setGenerating(false);
            navigate(`/trip/${res.data._id}`);
          }, 800);
        };
        setTimeout(finishUp, 1500);
      } catch (err) {
        console.error('Generation failed:', err);
        const status = err.response?.status;
        if (status === 401) {
          setError('You need to sign in to generate a trip.');
          setGenerating(false);
          return;
        }
        if (status === 402) {
          setUpgradeInfo(err.response?.data || { error: 'Upgrade required' });
          setGenerating(false);
          return;
        }
        setError(err.response?.data?.error || 'AI generation failed. Please check your connection or try again.');
        setGenerating(false);
      }
    };

    generateTrip();
    return () => clearInterval(stepInterval);
  }, []);

  if (upgradeInfo) {
    const used = upgradeInfo.freeTripsUsed ?? 0;
    const limit = upgradeInfo.trialLimit ?? 0;
    return (
      <div className="loading-screen">
        <div className="loading-error">
          <div className="err-icon" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(234,179,8,0.15))' }}>
            <Lock size={28} />
          </div>
          <h2>{t('planner.trialUsedTitle')}</h2>
          <p>
            {limit > 0
              ? `${t('planner.trialUsedDesc1')} ${used} ${t('planner.trialUsedDesc2')} ${limit} ${t('planner.trialUsedDesc3')}`
              : t('planner.reqPaidPlan')}
            &nbsp;{t('planner.upgradeToKeep')}
          </p>
          <div className="err-actions">
            <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={16} /> {t('planner.myTrips')}
            </button>
            <button className="btn-primary" onClick={() => navigate('/billing')}>
              <Sparkles size={16} /> {t('planner.seePlans')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-screen">
        <div className="loading-error">
          <div className="err-icon"><AlertTriangle size={28} /></div>
          <h2>{t('planner.hitSnag')}</h2>
          <p>{error}</p>
          <div className="err-actions">
            <button className="btn-secondary" onClick={() => navigate('/planner/step4')}>
              <ArrowLeft size={16} /> {t('planner.goBack')}
            </button>
            <button className="btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw size={16} /> {t('planner.tryAgain')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const progressPct = Math.min(100, ((activeStep + 1) / STEPS.length) * 100);
  const destName = formData.destination?.name?.split(',')[0] || 'your destination';

  return (
    <div className="loading-screen">
      <div className="loading-grid">
        {/* Left: Globe visual */}
        <div className="loading-visual">
          <div className="globe-frame">
            <Globe
              ref={globeRef}
              width={420}
              height={420}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl={
                isDarkMode
                  ? '//unpkg.com/three-globe/example/img/earth-night.jpg'
                  : '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
              }
              atmosphereColor="#eab308"
              atmosphereAltitude={0.2}
              pointsData={
                formData.destination?.lat && formData.destination?.lon
                  ? [{ lat: formData.destination.lat, lng: formData.destination.lon, size: 1.5, color: '#eab308' }]
                  : []
              }
              pointAltitude={0.05}
              pointRadius={0.6}
              pointColor="color"
            />
          </div>
        </div>

        {/* Right: Content */}
        <div className="loading-content">
          <div className="loading-eyebrow">
            <Sparkles size={14} />
            <span>{t('planner.aiWorking')}</span>
          </div>

          <h1 className="loading-title">
            {t('planner.craftingTrip')} <span className="grad-text">{destName}</span>
          </h1>

          <p className="loading-sub">
            {t('planner.loadingSub')}
          </p>

          {/* Progress bar */}
          <div className="loading-progress">
            <div className="loading-progress-bar">
              <div className="loading-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="loading-progress-label">
              <span>{Math.round(progressPct)}%</span>
              <span>{t('planner.stepProgress')} {activeStep + 1} / {STEPS.length}</span>
            </div>
          </div>

          {/* Steps */}
          <ul className="loading-steps">
            {STEPS.map((step, idx) => {
              const status = idx < activeStep ? 'done' : idx === activeStep ? 'active' : 'pending';
              const Icon = step.icon;
              return (
                <li key={step.id} className={`step-item ${status}`}>
                  <div className="step-bullet">
                    {status === 'done' ? <Check size={14} /> : <Icon size={14} />}
                  </div>
                  <div className="step-text">
                    <strong>{t(step.labelKey)}</strong>
                    <small>{t(step.detailKey)}</small>
                  </div>
                  {status === 'active' && <div className="step-loader" />}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Loading;
