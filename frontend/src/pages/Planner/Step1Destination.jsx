import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useTripStore from '../../stores/tripStore';
import { Search, MapPin, Sparkles, Loader2, Plane } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from '../../hooks/useTranslation';
import './Planner.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Convert ISO country code (e.g. "MA") to flag emoji
const codeToFlag = (cc) => {
  if (!cc || cc.length !== 2) return '';
  return String.fromCodePoint(...cc.toUpperCase().split('').map((c) => 127397 + c.charCodeAt()));
};

const Step1Destination = () => {
  const navigate = useNavigate();
  const { token, formData, setFormData } = useTripStore();
  const { t } = useTranslation();
  const [startQuery, setStartQuery] = useState(formData.startCity || '');
  const [destQuery, setDestQuery] = useState(formData.destination.name || '');
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [startLoading, setStartLoading] = useState(false);
  const [destLoading, setDestLoading] = useState(false);
  // The exact query string most recently fetched (per input). We only render
  // the dropdown / empty state when the current input value still matches
  // what we searched for. After selecting a suggestion the input gets the
  // full city name (e.g. "Casablanca, Morocco") which won't match the
  // partial fetch query ("casa"), so the dropdown stays closed.
  const [startFetched, setStartFetched] = useState('');
  const [destFetched, setDestFetched] = useState('');
  const [startFocused, setStartFocused] = useState(false);
  const [destFocused, setDestFocused] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const [activeIdx, setActiveIdx] = useState({ start: -1, dest: -1 });

  // AI-mode state: free-form description + the city the LLM picks for it.
  const [aiDescription, setAiDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState(null);

  const startCancelRef = useRef(null);
  const destCancelRef = useRef(null);
  const startTimerRef = useRef(null);
  const destTimerRef = useRef(null);

  // Debounced search with request cancellation
  const performSearch = useCallback(async (val, type) => {
    const setSugg = type === 'start' ? setStartSuggestions : setDestSuggestions;
    const setLoad = type === 'start' ? setStartLoading : setDestLoading;
    const setFetched = type === 'start' ? setStartFetched : setDestFetched;
    const cancelRef = type === 'start' ? startCancelRef : destCancelRef;

    if (val.length < 2) {
      setSugg([]);
      setLoad(false);
      setFetched('');
      return;
    }

    // Cancel previous request if still pending
    if (cancelRef.current) cancelRef.current.abort();
    const controller = new AbortController();
    cancelRef.current = controller;
    setLoad(true);

    try {
      const res = await axios.get(`${API}/api/search/proxy?q=${encodeURIComponent(val)}`, {
        signal: controller.signal
      });
      setSugg(res.data || []);
      setFetched(val);
      setActiveIdx((p) => ({ ...p, [type]: -1 }));
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error(err);
      setSugg([]);
    } finally {
      setLoad(false);
    }
  }, []);

  const handleSearch = (val, type) => {
    if (type === 'start') setStartQuery(val);
    else setDestQuery(val);

    const timerRef = type === 'start' ? startTimerRef : destTimerRef;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => performSearch(val, type), 250);
  };

  // Cleanup on unmount
  useEffect(() => () => {
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    if (destTimerRef.current) clearTimeout(destTimerRef.current);
    if (startCancelRef.current) startCancelRef.current.abort();
    if (destCancelRef.current) destCancelRef.current.abort();
  }, []);

  const selectStart = (item) => {
    setFormData({ startCity: item.display_name });
    setStartQuery(item.display_name);
    setStartSuggestions([]);
    setStartFetched('');
    setStartFocused(false);
    setActiveIdx((p) => ({ ...p, start: -1 }));
  };

  const selectDest = (item) => {
    setFormData({
      destination: {
        name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        country_code: item.country_code
      }
    });
    setDestQuery(item.display_name);
    setDestSuggestions([]);
    setDestFetched('');
    setDestFocused(false);
    setActiveIdx((p) => ({ ...p, dest: -1 }));
  };

  // Keyboard navigation
  const handleKeyDown = (e, type) => {
    const list = type === 'start' ? startSuggestions : destSuggestions;
    if (!list.length) return;
    const idx = activeIdx[type];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((p) => ({ ...p, [type]: Math.min(idx + 1, list.length - 1) }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((p) => ({ ...p, [type]: Math.max(idx - 1, 0) }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (idx >= 0 && list[idx]) {
        type === 'start' ? selectStart(list[idx]) : selectDest(list[idx]);
      }
    } else if (e.key === 'Escape') {
      type === 'start' ? setStartSuggestions([]) : setDestSuggestions([]);
    }
  };

  // Ask the backend to pick + geocode a destination from the free-form
  // description. On success we mirror the result into the same fields the
  // manual flow uses so the rest of the planner just works.
  const fetchAiSuggestion = async () => {
    const desc = aiDescription.trim();
    if (desc.length < 5) {
      setAiError('Please describe your dream trip in at least a few words.');
      return;
    }
    setAiLoading(true);
    setAiError('');
    setAiSuggestion(null);
    try {
      const res = await axios.post(`${API}/api/trips/suggest-destination`, {
        description: desc
      });
      const { destination, reason } = res.data;
      setFormData({ destination });
      setDestQuery(destination.name);
      setAiSuggestion({ ...destination, reason });
    } catch (err) {
      setAiError(err.response?.data?.error || err.message || 'AI suggestion failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const clearAiSuggestion = () => {
    setAiSuggestion(null);
    setDestQuery('');
    setFormData({ destination: { name: '', lat: null, lon: null, country_code: null } });
  };

  const handleNext = () => {
    if (!token) {
      navigate('/login');
      return;
    }
    // Block in AI mode until the user has actually accepted a suggestion.
    if (isAiMode && !formData.destination?.lat) {
      setAiError('Pick a destination first — click "Find my destination".');
      return;
    }
    if (formData.destination?.name || destQuery) {
      navigate('/planner/step2');
    }
  };

  return (
    <div className="planner-step glass-card">
      <div className="step-header">
        <span className="step-indicator">{t('planner.step1Of4')}</span>
        <h2>{t('planner.whereToGo')}</h2>
        <p>{t('planner.step1Sub')}</p>
      </div>

      <div className="planner-content">
        {!isAiMode ? (
          <div className="search-container">
            {/* Start City Input */}
            <div className="input-group-wrapper" style={{ position: 'relative', marginBottom: '30px' }}>
              <label className="step-label">{t('planner.startFrom')}</label>
              <div className="input-wrapper">
                <Plane className="input-icon" size={18} />
                <input
                  type="text"
                  placeholder={t('planner.originPlaceholder')}
                  value={startQuery}
                  onChange={(e) => handleSearch(e.target.value, 'start')}
                  onKeyDown={(e) => handleKeyDown(e, 'start')}
                  onFocus={() => setStartFocused(true)}
                  onBlur={() => setTimeout(() => setStartFocused(false), 150)}
                  autoComplete="off"
                />
                {startLoading && <Loader2 className="input-loader" size={18} />}
              </div>
              {startFocused && (startSuggestions.length > 0 || (!startLoading && startFetched && startFetched === startQuery)) && (
                <ul className="suggestions-list">
                  {startSuggestions.length > 0 ? (
                    startSuggestions.map((item, idx) => {
                      const subtitle = item.country || item.display_name?.split(',').slice(1).join(',').trim();
                      return (
                        <li
                          key={`${item.display_name}-${idx}`}
                          className={activeIdx.start === idx ? 'active' : ''}
                          onMouseEnter={() => setActiveIdx((p) => ({ ...p, start: idx }))}
                          onClick={() => selectStart(item)}
                        >
                          <span className="sugg-flag">{codeToFlag(item.country_code) || '📍'}</span>
                          <div className="sugg-text">
                            <strong>{item.city}</strong>
                            {subtitle && <small>{subtitle}</small>}
                          </div>
                          {item.type && <span className={`sugg-badge type-${item.type}`}>{item.type}</span>}
                        </li>
                      );
                    })
                  ) : (
                    <li className="sugg-empty">{t('planner.noMatches')} "{startFetched}"</li>
                  )}
                </ul>
              )}
            </div>

            {/* Destination City Input */}
            <div className="input-group-wrapper" style={{ position: 'relative' }}>
              <label className="step-label">{t('planner.whereToGo')}</label>
              <div className="input-wrapper">
                <Search className="input-icon" />
                <input
                  type="text"
                  placeholder={t('planner.destPlaceholder')}
                  value={destQuery}
                  onChange={(e) => handleSearch(e.target.value, 'dest')}
                  onKeyDown={(e) => handleKeyDown(e, 'dest')}
                  onFocus={() => setDestFocused(true)}
                  onBlur={() => setTimeout(() => setDestFocused(false), 150)}
                  autoComplete="off"
                />
                {destLoading && <Loader2 className="input-loader" size={18} />}
              </div>
              {destFocused && (destSuggestions.length > 0 || (!destLoading && destFetched && destFetched === destQuery)) && (
                <ul className="suggestions-list">
                  {destSuggestions.length > 0 ? (
                    destSuggestions.map((item, idx) => {
                      const subtitle = item.country || item.display_name?.split(',').slice(1).join(',').trim();
                      return (
                        <li
                          key={`${item.display_name}-${idx}`}
                          className={activeIdx.dest === idx ? 'active' : ''}
                          onMouseEnter={() => setActiveIdx((p) => ({ ...p, dest: idx }))}
                          onClick={() => selectDest(item)}
                        >
                          <span className="sugg-flag">{codeToFlag(item.country_code) || '📍'}</span>
                          <div className="sugg-text">
                            <strong>{item.city}</strong>
                            {subtitle && <small>{subtitle}</small>}
                          </div>
                          {item.type && <span className={`sugg-badge type-${item.type}`}>{item.type}</span>}
                        </li>
                      );
                    })
                  ) : (
                    <li className="sugg-empty">{t('planner.noMatches')} "{destFetched}"</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="ai-input-container">
            <textarea
              placeholder={t('planner.aiPlaceholder')}
              value={aiDescription}
              onChange={(e) => { setAiDescription(e.target.value); setAiError(''); }}
              disabled={aiLoading}
            />
            <button
              type="button"
              className="btn-primary ai-suggest-btn"
              onClick={fetchAiSuggestion}
              disabled={aiLoading || aiDescription.trim().length < 5}
            >
              {aiLoading ? (
                <><Loader2 size={16} className="spin" /> {t('planner.pickingCity')}</>
              ) : (
                <><Sparkles size={16} /> {aiSuggestion ? t('planner.tryDifferent') : t('planner.findMyDest')}</>
              )}
            </button>

            {aiError && <p className="ai-error">{aiError}</p>}

            {aiSuggestion && (
              <div className="ai-suggestion-card">
                <div className="ai-suggestion-flag">
                  {codeToFlag(aiSuggestion.country_code) || '✨'}
                </div>
                <div className="ai-suggestion-body">
                  <strong>{aiSuggestion.city || aiSuggestion.name}</strong>
                  {aiSuggestion.country && <span className="muted">{aiSuggestion.country}</span>}
                  {aiSuggestion.reason && <p className="ai-reason">"{aiSuggestion.reason}"</p>}
                </div>
                <button type="button" className="ai-suggestion-clear" onClick={clearAiSuggestion}>
                  {t('planner.change')}
                </button>
              </div>
            )}
          </div>
        )}

        <div
          className="mode-toggle"
          onClick={() => {
            setIsAiMode(!isAiMode);
            setAiError('');
          }}
        >
          <Sparkles size={18} className={isAiMode ? 'active' : ''} />
          <span>{isAiMode ? t('planner.backToManual') : t('planner.letAiChoose')}</span>
        </div>
      </div>

      <div className="step-footer">
        <button
          className="btn-primary"
          onClick={handleNext}
          disabled={isAiMode ? !aiSuggestion : !destQuery}
        >
          {t('planner.nextStep')}
        </button>
      </div>
    </div>
  );
};

export default Step1Destination;
