import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Globe, Mail, Lock, User, ArrowRight, AlertCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import useTripStore from '../stores/tripStore';
import { useToast } from '../components/UI/Toast';
import { useTranslation } from '../hooks/useTranslation';
import './Auth.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login } = useTripStore();
  const { t } = useTranslation();
  const toast = useToast();

  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [showOtp, setShowOtp] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', otp: '' });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Sync state with URL
  useEffect(() => {
    const mode = searchParams.get('mode');
    setIsLogin(mode !== 'signup');
  }, [searchParams]);

  const switchMode = () => {
    const newMode = isLogin ? 'signup' : 'login';
    setSearchParams({ mode: newMode });
    setShowOtp(false);
    setTermsAccepted(false);
    setFormError('');
  };

  const update = (field) => (e) => {
    const val = field === 'terms' ? e.target.checked : e.target.value;
    if (field === 'terms') {
      setTermsAccepted(val);
    } else {
      setFormData((prev) => ({ ...prev, [field]: val }));
    }
    if (formError) setFormError('');
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    if (loading || !formData.otp) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/auth/verify-otp`, {
        email: formData.email,
        otp: formData.otp
      });
      login(res.data.user, res.data.token);
      toast.success(`${t('auth.verifySuccess')} ${res.data.user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || t('auth.invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/resend-otp`, { email: formData.email });
      toast.success(t('auth.codeSent'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('auth.resendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.email || !formData.password) {
      setFormError(t('auth.reqEmailPass'));
      return;
    }
    if (formData.password.length < 6) {
      setFormError(t('auth.reqPassLen'));
      return;
    }
    if (!isLogin && !formData.name.trim()) {
      setFormError(t('auth.reqName'));
      return;
    }
    if (!isLogin && !termsAccepted) {
      setFormError(t('auth.reqTerms'));
      return;
    }

    setFormError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    const payload = isLogin
      ? { email: formData.email, password: formData.password }
      : { email: formData.email, password: formData.password, name: formData.name };

    try {
      const res = await axios.post(`${API}${endpoint}`, payload);
      
      if (!isLogin) {
        setShowOtp(true);
        toast.info(t('auth.enterCode'));
      } else {
        login(res.data.user, res.data.token);
        toast.success(`${t('auth.welcomeBack')} ${res.data.user.name}!`);
        navigate('/');
      }
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;

      if (data?.unverified) {
        setShowOtp(true);
        toast.warning(t('auth.verifyToContinue'));
      } else if (status === 409 && !isLogin) {
        setSearchParams({ mode: 'login' });
        toast.info(t('auth.alreadyHaveAccount'));
      } else if (status === 404 && isLogin) {
        setSearchParams({ mode: 'signup' });
        toast.info(t('auth.noAccountFound'));
      } else {
        const msg = data?.error || t('auth.somethingWentWrong');
        setFormError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSuccess = async (response) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/auth/google`, {
        credential: response.credential
      });
      login(res.data.user, res.data.token);
      toast.success(`${t('auth.googleSuccess')} ${res.data.user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(t('auth.googleFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (showOtp) {
    return (
      <div className="auth-page">
        <div className="auth-container glass-card">
          <div className="auth-header">
            <ShieldCheck className="auth-logo accent" size={48} />
            <h2>{t('auth.verifyEmail')}</h2>
            <p>{t('auth.verifyDesc')} <strong>{formData.email}</strong></p>
          </div>

          <form className="auth-form" onSubmit={handleOtpVerify}>
            <div className="input-group">
              <input
                type="text"
                placeholder={t('auth.otpLabel')}
                maxLength={6}
                required
                className="otp-input"
                value={formData.otp}
                onChange={update('otp')}
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn-primary auth-submit" disabled={loading || formData.otp.length < 6}>
              {loading ? '...' : t('auth.verifyBtn')}
            </button>
          </form>

          <div className="auth-footer">
            <button type="button" className="resend-btn" onClick={handleResendOtp} disabled={loading}>
              <RefreshCw size={14} /> {t('auth.resendCode')}
            </button>
            <button type="button" className="text-btn" onClick={() => setShowOtp(false)}>
              {t('auth.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container glass-card">
        <div className="auth-header">
          <Globe className="auth-logo" size={40} />
          <h2>{isLogin ? t('auth.loginTitle') : t('auth.signupTitle')}</h2>
          <p>
            {isLogin ? t('auth.loginSub') : t('auth.signupSub')}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {!isLogin && (
            <div className="input-group">
              <User className="input-icon" size={18} />
              <input
                type="text"
                placeholder={t('auth.nameLabel')}
                required
                value={formData.name}
                onChange={update('name')}
                disabled={loading}
              />
            </div>
          )}
          <div className="input-group">
            <Mail className="input-icon" size={18} />
            <input
              type="email"
              placeholder={t('auth.emailLabel')}
              required
              value={formData.email}
              onChange={update('email')}
              disabled={loading}
            />
          </div>
          <div className="input-group">
            <Lock className="input-icon" size={18} />
            <input
              type="password"
              placeholder={t('auth.passwordLabel')}
              required
              value={formData.password}
              onChange={update('password')}
              disabled={loading}
            />
          </div>

          {!isLogin && (
            <div className="terms-checkbox">
              <input 
                type="checkbox" 
                id="terms" 
                checked={termsAccepted}
                onChange={update('terms')}
              />
              <label htmlFor="terms">
                {t('auth.acceptTerms')} <button type="button" className="link-btn" onClick={() => navigate('/terms')}>{t('auth.termsLink')}</button> {t('auth.and')} <button type="button" className="link-btn" onClick={() => navigate('/privacy')}>{t('auth.privacyLink')}</button>
              </label>
            </div>
          )}

          {formError && (
            <div className="auth-error">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? '...' : isLogin ? t('auth.loginBtn') : t('auth.signupBtn')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="auth-divider">
          <span>or continue with</span>
        </div>

        <div className="google-auth-wrapper">
          <GoogleLogin
            onSuccess={onGoogleSuccess}
            onError={() => toast.error('Google Sign-In failed')}
            useOneTap
            theme="filled_blue"
            shape="pill"
            width="100%"
          />
        </div>

        <div className="auth-footer">
          <p>
            {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
            <button type="button" onClick={switchMode}>
              {isLogin ? t('auth.signupBtn') : t('auth.loginBtn')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
