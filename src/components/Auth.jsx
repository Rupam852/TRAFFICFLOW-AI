import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ShieldAlert, ArrowRight, Navigation, Loader2, ArrowLeft } from 'lucide-react';

export default function Auth({ onAuthSuccess, isInitialSignUp = false, onBackToLanding }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(isInitialSignUp);
  const [backHovered, setBackHovered] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    setIsSignUp(isInitialSignUp);
  }, [isInitialSignUp]);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage({ type: 'error', text: 'Please fill in all fields.' });
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        // Supabase has email confirmation on by default.
        if (data?.user && data?.session === null) {
          setMessage({
            type: 'success',
            text: 'Sign up successful! Please check your email inbox to verify your account.',
          });
        } else if (data?.session) {
          onAuthSuccess(data.session.user);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data?.session) {
          onAuthSuccess(data.session.user);
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-art-section">
        <div style={styles.artContent}>
          <div style={styles.logoBadge}>
            <Navigation size={32} style={styles.logoIcon} />
            <h1 style={styles.logoText}>TRAFFICFLOW <span style={styles.logoHighlight}>AI</span></h1>
          </div>
          <p style={styles.tagline}>Navigate smarter, beat the rush, and experience the future of real-time route optimization.</p>
          <div style={styles.featuresList}>
            <div style={styles.featureItem}>
              <div style={styles.featureDot}>🚦</div>
              <div>
                <h4 style={styles.featureTitle}>Dynamic Traffic Analysis</h4>
                <p style={styles.featureDesc}>Color-coded traffic updates with TomTom live telemetry integration.</p>
              </div>
            </div>
            <div style={styles.featureItem}>
              <div style={styles.featureDot}>🤖</div>
              <div>
                <h4 style={styles.featureTitle}>AI Route Optimizers</h4>
                <p style={styles.featureDesc}>Harness Google, OpenAI, or Claude models for smart route recommendations.</p>
              </div>
            </div>
            <div style={styles.featureItem}>
              <div style={styles.featureDot}>🌧️</div>
              <div>
                <h4 style={styles.featureTitle}>Animated Weather Engine</h4>
                <p style={styles.featureDesc}>Live simulation of rain, fog, and day-night cycle overlays.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-form-section">
        <div className="glass-panel auth-card">
          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              onMouseEnter={() => setBackHovered(true)}
              onMouseLeave={() => setBackHovered(false)}
              style={{
                ...styles.backBtn,
                color: backHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
              title="Back to Landing Page"
            >
              <ArrowLeft size={14} />
              <span>Back to Home</span>
            </button>
          )}
          <h2 style={styles.title}>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
          <p style={styles.subtitle}>
            {isSignUp ? 'Get started with TrafficFlow AI today' : 'Sign in to access your saved bookmarks and maps'}
          </p>

          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '0.78rem',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            lineHeight: '1.4'
          }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '-2px' }}>⚠️</span>
            <div>
              <strong>API Keys Required:</strong> Keyless simulation is disabled. You must configure your own Google Maps and Mapbox keys in the app settings to render maps and compute routes.
            </div>
          </div>

          {message.text && (
            <div style={{
              ...styles.messageBanner,
              backgroundColor: message.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              borderColor: message.type === 'error' ? '#ef4444' : '#10b981',
              color: message.type === 'error' ? '#ef4444' : '#10b981',
            }}>
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.875rem' }}>{message.text}</span>
            </div>
          )}

          <button onClick={handleGoogleSignIn} disabled={loading} style={styles.googleBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>Continue with Google</span>
            {loading && <Loader2 size={16} className="spin" style={styles.spinner} />}
          </button>

          <div style={styles.divider}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>or continue with email</span>
            <div style={styles.dividerLine} />
          </div>

          <form onSubmit={handleEmailAuth} style={styles.form}>
            <div className="input-group">
              <label>Email Address</label>
              <div style={styles.inputWrapper}>
                <Mail size={18} style={styles.inputIcon} />
                <input
                  type="email"
                  className="input-field"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  style={styles.inputPadding}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div style={styles.inputWrapper}>
                <Lock size={18} style={styles.inputIcon} />
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  style={styles.inputPadding}
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="glow-btn" style={styles.submitBtn}>
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div style={styles.toggleFooter}>
            <span>{isSignUp ? 'Already have an account?' : "Don't have an account?"}</span>
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage({ type: '', text: '' });
              }}
              style={styles.toggleBtn}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  artContent: {
    maxWidth: '520px',
  },
  logoBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  logoIcon: {
    color: '#6366f1',
    transform: 'rotate(45deg)',
    filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.6))',
  },
  logoText: {
    fontSize: '2rem',
    fontWeight: '800',
    letterSpacing: '-0.03em',
    color: '#ffffff',
  },
  logoHighlight: {
    color: '#6366f1',
  },
  tagline: {
    fontSize: '1.15rem',
    color: '#94a3b8',
    marginBottom: '48px',
    lineHeight: '1.6',
  },
  featuresList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },
  featureItem: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
  },
  featureDot: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
  },
  featureTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: '4px',
  },
  featureDesc: {
    fontSize: '0.875rem',
    color: '#64748b',
    lineHeight: '1.4',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginBottom: '28px',
  },
  messageBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid',
    marginBottom: '20px',
    lineHeight: '1.4',
  },
  googleBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontWeight: '600',
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    marginBottom: '20px',
  },
  spinner: {
    marginLeft: '8px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: 'var(--border-color)',
  },
  dividerText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    fontWeight: '500',
    letterSpacing: '0.05em',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)',
  },
  inputPadding: {
    paddingLeft: '40px',
  },
  submitBtn: {
    width: '100%',
    justifyContent: 'center',
    padding: '12px',
    fontSize: '1rem',
    marginTop: '8px',
  },
  toggleFooter: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '24px',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    fontWeight: '600',
    cursor: 'pointer',
    outline: 'none',
    fontSize: '0.85rem',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: 'none',
    fontSize: '0.85rem',
    fontWeight: '500',
    cursor: 'pointer',
    marginBottom: '20px',
    padding: 0,
    transition: 'color 0.2s',
    outline: 'none',
  },
};
