import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Mail, Lock, User, ArrowRight, AlertCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import useTripStore from '../stores/tripStore';
import { useToast } from '../components/UI/Toast';
import './Auth.css';

const API = 'http://localhost:5000';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useTripStore();
  const toast = useToast();

  const [isLogin, setIsLogin] = useState(true);
  const [showOtp, setShowOtp] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', otp: '' });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const switchMode = () => {
    setIsLogin((v) => !v);
    setShowOtp(false);
    setFormError('');
  };

  const update = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
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
      toast.success(`Verification successful! Welcome, ${res.data.user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/resend-otp`, { email: formData.email });
      toast.success('A new code has been sent to your email.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.email || !formData.password) {
      setFormError('Email and password are required.');
      return;
    }
    if (formData.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (!isLogin && !formData.name.trim()) {
      setFormError('Please enter your name.');
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
        toast.info('Please enter the verification code sent to your email.');
      } else {
        login(res.data.user, res.data.token);
        toast.success(`Welcome back, ${res.data.user.name}!`);
        navigate('/');
      }
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;

      if (data?.unverified) {
        setShowOtp(true);
        toast.warning('Please verify your email to continue.');
      } else if (status === 409 && !isLogin) {
        setIsLogin(true);
        toast.info('You already have an account. Please sign in.');
      } else if (status === 404 && isLogin) {
        setIsLogin(false);
        toast.info('No account found. Create one to continue.');
      } else {
        const msg = data?.error || 'Something went wrong.';
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
      toast.success(`Success! Welcome, ${res.data.user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error('Google authentication failed.');
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
            <h2>Verify Your Email</h2>
            <p>We've sent a 6-digit code to <strong>{formData.email}</strong></p>
          </div>

          <form className="auth-form" onSubmit={handleOtpVerify}>
            <div className="input-group">
              <input
                type="text"
                placeholder="6-digit code"
                maxLength={6}
                required
                className="otp-input"
                value={formData.otp}
                onChange={update('otp')}
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn-primary auth-submit" disabled={loading || formData.otp.length < 6}>
              {loading ? 'Verifying…' : 'Verify Code'}
            </button>
          </form>

          <div className="auth-footer">
            <button type="button" className="resend-btn" onClick={handleResendOtp} disabled={loading}>
              <RefreshCw size={14} /> Resend Code
            </button>
            <button type="button" className="text-btn" onClick={() => setShowOtp(false)}>
              Back to {isLogin ? 'Login' : 'Signup'}
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
          <h2>{isLogin ? 'Welcome Back' : 'Join Travio'}</h2>
          <p>
            {isLogin
              ? 'Enter your details to access your trips'
              : 'Start your journey with AI-powered planning'}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {!isLogin && (
            <div className="input-group">
              <User className="input-icon" size={18} />
              <input
                type="text"
                placeholder="Full Name"
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
              placeholder="Email Address"
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
              placeholder="Password"
              required
              value={formData.password}
              onChange={update('password')}
              disabled={loading}
            />
          </div>

          {formError && (
            <div className="auth-error">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? 'Processing…' : isLogin ? 'Sign In' : 'Create Account'}
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
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button type="button" onClick={switchMode}>
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
