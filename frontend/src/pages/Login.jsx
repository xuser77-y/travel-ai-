import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Mail, Lock, User, ArrowRight, Code, Search, AlertCircle } from 'lucide-react';
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
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const switchMode = () => {
    setIsLogin((v) => !v);
    setFormError('');
  };

  const update = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (formError) setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    // Client-side validation surfaces inline errors instead of round-tripping.
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
      login(res.data.user, res.data.token);
      toast.success(
        isLogin ? `Welcome back, ${res.data.user.name}!` : `Account created — welcome, ${res.data.user.name}!`
      );
      navigate('/planner');
    } catch (err) {
      const status = err.response?.status;
      const serverMsg = err.response?.data?.error;

      // Friendly default messages per status to avoid "Network Error"
      // surprises if the backend goes down.
      let msg = serverMsg;
      if (!msg) {
        if (err.code === 'ERR_NETWORK') msg = 'Cannot reach the server. Please try again.';
        else msg = err.message || 'Something went wrong. Please try again.';
      }

      // Auto-bounce common cases to the right tab so the user does not have
      // to figure out which mode they should be in.
      if (status === 409 && !isLogin) {
        // Email already registered while signing up → switch to login mode
        // and pre-fill the email.
        setIsLogin(true);
        toast.info('You already have an account. Please sign in.');
      } else if (status === 404 && isLogin) {
        // No account during login → switch to signup with the email kept.
        setIsLogin(false);
        toast.info('No account found. Create one to continue.');
      } else if (status === 401) {
        toast.error('Incorrect password.');
      } else {
        toast.error(msg);
      }

      setFormError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container glass-card">
        <div className="auth-header">
          <Globe className="auth-logo" size={40} />
          <h2>{isLogin ? 'Welcome Back' : 'Join TravelAI'}</h2>
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
                autoComplete="name"
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
              autoComplete="email"
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
              minLength={6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={formData.password}
              onChange={update('password')}
              disabled={loading}
            />
          </div>

          {formError && (
            <div className="auth-error" role="alert">
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

        <div className="social-auth">
          <button type="button" className="social-btn"><Search size={20} /> Google</button>
          <button type="button" className="social-btn"><Code size={20} /> Github</button>
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
