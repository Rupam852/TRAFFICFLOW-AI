import { useState, useEffect } from 'react';
import { Navigation, ArrowRight, ShieldCheck, Cpu, CloudRain, Map, ChevronDown, ChevronUp, Zap, GitMerge, BarChart3, Clock, X } from 'lucide-react';

export default function LandingPage({ onNavigate }) {
  const [activeFaq, setActiveFaq] = useState(null);
  const [animateGrid, setAnimateGrid] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  useEffect(() => {
    setAnimateGrid(true);
  }, []);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const features = [
    {
      icon: <GitMerge size={24} style={{ color: 'var(--primary)' }} />,
      title: 'AI Route Optimizers',
      desc: 'Harness state-of-the-art LLMs like Gemini 2.5, GPT-4, and Claude to analyze traffic bottlenecks and recommend smart, context-aware alternative routes.',
      tag: 'AI Powered'
    },
    {
      icon: <Zap size={24} style={{ color: '#fbbf24' }} />,
      title: 'Live Telemetry & Heatmaps',
      desc: 'Integration with live TomTom telemetry maps and traffic density grids. Instantly identify jams, speeds, and blockages on a live heatmap layer.',
      tag: '15s Sync'
    },
    {
      icon: <CloudRain size={24} style={{ color: '#60a5fa' }} />,
      title: 'Climate & Time Simulation',
      desc: 'Animate and overlay weather elements including rain, thick fog, and day-night lighting cycles, mapping their specific impact on route times.',
      tag: 'Dynamic Canvas'
    },
    {
      icon: <Map size={24} style={{ color: '#34d399' }} />,
      title: 'Advanced Map Viewports',
      desc: 'Fully interactive 3D map tilting, camera rotation alignment, and dynamic vector tiles for a premium navigation interface.',
      tag: 'WebGL Render'
    }
  ];

  const stats = [
    { label: 'Update Latency', value: '15s', desc: 'Real-time telemetry' },
    { label: 'AI Models Integrated', value: '3+', desc: 'Gemini, OpenAI, Claude' },
    { label: 'Security & Privacy', value: '100%', desc: 'Client-side API storage' },
    { label: 'Routing Options', value: 'OSRM + Custom', desc: 'Alternative generation' }
  ];

  const faqs = [
    {
      q: 'Do I need my own API keys to use TrafficFlow AI?',
      a: 'Yes, to query maps and compute live routes, you must configure your own Google Maps and Mapbox keys in the app settings. Keyless simulation mode is disabled to ensure direct, unthrottled provider access.'
    },
    {
      q: 'How does the AI assistant optimize my routes?',
      a: 'The AI panel extracts live path statistics (coordinates, delays, mode of travel, weather conditions) and evaluates alternative routes to suggest adjustments, traffic patterns, and smart navigation strategies.'
    },
    {
      q: 'Are my API keys stored securely?',
      a: 'Absolutely. Your keys are stored strictly in your local browser cache (localStorage) or inside your private Supabase user_settings row. They are never sent to third-party endpoints other than directly to Mapbox, Google, or TomTom.'
    },
    {
      q: 'Can I simulate routes in real time?',
      a: 'Yes! Once a route is calculated, you can toggle Simulation Mode. The app will animate a navigation marker along the path, tilting the camera dynamically based on travel direction and speed.'
    }
  ];

  return (
    <div style={styles.landingContainer}>
      {/* Navigation Header */}
      <header style={styles.header}>
        <div style={styles.navContent}>
          <div style={styles.logoBadge} onClick={() => onNavigate('landing')}>
            <Navigation size={24} style={styles.logoIcon} />
            <span style={styles.logoText}>TRAFFICFLOW <span style={styles.logoHighlight}>AI</span></span>
          </div>
          
          <nav className="landing-desktop-nav">
            <a href="#features" style={styles.navLink}>Features</a>
            <a href="#how-it-works" style={styles.navLink}>How it Works</a>
            <a href="#faqs" style={styles.navLink}>FAQs</a>
          </nav>

          <div style={styles.navButtons}>
            <button 
              onClick={() => onNavigate('login')} 
              style={styles.btnSecondary}
              id="landing-signin-btn"
            >
              Sign In
            </button>
            <button 
              onClick={() => onNavigate('signup')} 
              style={styles.btnPrimaryGlow}
              id="landing-signup-btn"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section style={styles.heroSection}>
        <div style={styles.heroLayout}>
          <div style={styles.heroLeft}>
            <div style={styles.badge}>
              <span style={styles.badgeDot}>•</span>
              <span>Next-Gen Smart Navigation</span>
            </div>
            <h1 className="landing-hero-title">
              Navigate Smarter with <span style={styles.gradientText}>AI-Powered</span> Route Optimization
            </h1>
            <p className="landing-hero-desc">
              TrafficFlow AI combines real-time traffic telemetry, advanced weather canvas layers, and state-of-the-art artificial intelligence models to deliver the ultimate route optimization experience.
            </p>
            <div className="landing-cta-group">
              <button onClick={() => onNavigate('signup')} style={styles.ctaPrimaryGlow}>
                Get Started for Free
                <ArrowRight size={18} style={{ marginLeft: '6px' }} />
              </button>
              <a href="#features" style={styles.ctaSecondary}>
                Explore Features
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Banner */}
      <section style={styles.statsSection}>
        <div className="landing-stats-container">
          {stats.map((s, idx) => (
            <div key={idx} style={styles.statCard}>
              <div style={styles.statValue}>{s.value}</div>
              <div style={styles.statLabel}>{s.label}</div>
              <div style={styles.statDesc}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>High-Fidelity Navigation Ecosystem</h2>
          <p style={styles.sectionDesc}>Explore the state-of-the-art tools and components backing our traffic routing engine.</p>
        </div>

        <div className="landing-features-grid">
          {features.map((f, idx) => (
            <div 
              key={idx} 
              style={{
                ...styles.featureCard,
                transform: animateGrid ? 'translateY(0)' : 'translateY(20px)',
                opacity: animateGrid ? 1 : 0,
                transition: `all 0.6s ease ${idx * 0.1}s`
              }} 
              className="glass-panel"
            >
              <div style={styles.featureIconWrapper}>
                {f.icon}
              </div>
              <div style={styles.featureTag}>{f.tag}</div>
              <h3 style={styles.featureCardTitle}>{f.title}</h3>
              <p style={styles.featureCardDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" style={{ ...styles.section, backgroundColor: 'rgba(255,255,255,0.01)' }}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Getting Started in 3 Steps</h2>
          <p style={styles.sectionDesc}>Configuring your personal AI optimization environment is quick and secure.</p>
        </div>

        <div className="landing-steps-layout">
          <div className="landing-step-item">
            <div style={styles.stepNumber}>01</div>
            <h3 style={styles.stepTitle}>Create Your Secure Account</h3>
            <p style={styles.stepDesc}>Register with email or Google to enable persistent database storage for user settings.</p>
          </div>
          <div className="landing-step-divider" />
          <div className="landing-step-item">
            <div style={styles.stepNumber}>02</div>
            <h3 style={styles.stepTitle}>Configure API Keys</h3>
            <p style={styles.stepDesc}>Add Mapbox, Google Maps, or Weather keys. Your keys stay secure in local cache or private rows.</p>
          </div>
          <div className="landing-step-divider" />
          <div className="landing-step-item">
            <div style={styles.stepNumber}>03</div>
            <h3 style={styles.stepTitle}>Plan & Optimize</h3>
            <p style={styles.stepDesc}>Set routes, visualize weather simulations, and let the AI models find optimal paths.</p>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section id="faqs" style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Frequently Asked Questions</h2>
          <p style={styles.sectionDesc}>Got questions? We have compiled the essential answers below.</p>
        </div>

        <div className="landing-faq-container">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div key={idx} style={styles.faqItem} className="glass-panel">
                <button style={styles.faqQuestion} onClick={() => toggleFaq(idx)}>
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp size={18} style={{ color: 'var(--primary)' }} /> : <ChevronDown size={18} />}
                </button>
                <div style={{
                  ...styles.faqAnswerContainer,
                  maxHeight: isOpen ? '200px' : '0',
                  opacity: isOpen ? 1 : 0,
                }}>
                  <p style={styles.faqAnswer}>{faq.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Banner */}
      <section style={styles.ctaBannerSection}>
        <div style={styles.ctaBannerCard} className="glass-panel">
          <h2 style={styles.ctaBannerTitle}>Ready to beat the rush?</h2>
          <p style={styles.ctaBannerDesc}>Join now and set up your traffic intelligence dashboard in minutes.</p>
          <button onClick={() => onNavigate('signup')} style={styles.ctaPrimaryGlow}>
            Get Started Free
            <ArrowRight size={18} style={{ marginLeft: '6px' }} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div className="landing-footer-content">
          <div style={styles.footerBrand}>
            <div style={styles.logoBadge}>
              <Navigation size={20} style={styles.logoIcon} />
              <span style={styles.footerBrandText}>TRAFFICFLOW <span style={styles.logoHighlight}>AI</span></span>
            </div>
            <p style={styles.footerBrandDesc}>High-fidelity AI navigation, traffic telemetry analytics, and weather cycle integrations.</p>
          </div>
          <div className="landing-footer-links">
            <div style={styles.footerLinkCol}>
              <h4 style={styles.footerColTitle}>Navigation</h4>
              <a href="#features" style={styles.footerLink}>Features</a>
              <a href="#how-it-works" style={styles.footerLink}>How it Works</a>
              <a href="#faqs" style={styles.footerLink}>FAQs</a>
            </div>
            <div style={styles.footerLinkCol}>
              <h4 style={styles.footerColTitle}>Get Connected</h4>
              <span onClick={() => onNavigate('login')} style={{ ...styles.footerLink, cursor: 'pointer' }}>Sign In</span>
              <span onClick={() => onNavigate('signup')} style={{ ...styles.footerLink, cursor: 'pointer' }}>Sign Up</span>
            </div>
            <div style={styles.footerLinkCol}>
              <h4 style={styles.footerColTitle}>Legal</h4>
              <span onClick={() => setIsPrivacyOpen(true)} style={{ ...styles.footerLink, cursor: 'pointer' }}>Privacy Policy</span>
            </div>
          </div>
        </div>
        <div style={styles.footerBottom}>
          <span>&copy; {new Date().getFullYear()} TrafficFlow AI. All rights reserved.</span>
        </div>
      </footer>

      {/* Privacy Policy Modal */}
      {isPrivacyOpen && (
        <div className="privacy-modal-backdrop" onClick={() => setIsPrivacyOpen(false)}>
          <div className="privacy-modal-card" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setIsPrivacyOpen(false)} 
              className="privacy-modal-close"
              title="Close Privacy Policy"
            >
              <X size={18} />
            </button>
            <div className="privacy-modal-scroll">
              <h2 className="privacy-modal-title">Privacy Policy</h2>
              <p className="privacy-modal-date">Last Updated: June 17, 2026</p>
              
              <div className="privacy-modal-section">
                <h3 className="privacy-modal-sectitle">1. Information We Collect</h3>
                <p className="privacy-modal-text">
                  TrafficFlow AI collects minimal personal information. If you create an account, we store your email address and account credentials securely. Your API keys (Google Maps, Mapbox, OpenWeather) are stored strictly on your local browser cache (localStorage) or inside your private, encrypted database row in Supabase.
                </p>
              </div>

              <div className="privacy-modal-section">
                <h3 className="privacy-modal-sectitle">2. How We Use Information</h3>
                <p className="privacy-modal-text">
                  Your data is used solely to provide navigation, route optimizations, and telemetry simulation features. We do not sell, share, or rent your personal information or API usage data to third parties.
                </p>
              </div>

              <div className="privacy-modal-section">
                <h3 className="privacy-modal-sectitle">3. Third-Party Integrations</h3>
                <p className="privacy-modal-text">
                  Routing and maps are powered by third-party APIs (Google Maps, Mapbox, TomTom, OpenStreetMap, and OpenWeatherMap). Your usage is governed by their respective privacy policies.
                </p>
              </div>

              <div className="privacy-modal-section">
                <h3 className="privacy-modal-sectitle">4. Contact Us</h3>
                <p className="privacy-modal-text">
                  If you have any questions, concerns, or requests regarding this Privacy Policy, please reach out to our support team at:
                </p>
                <div className="privacy-modal-email-row">
                  📧 <a href="mailto:rupambairagya08@gmail.com" className="privacy-modal-email-link">rupambairagya08@gmail.com</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  landingContainer: {
    backgroundColor: '#080711',
    color: '#f8fafc',
    minHeight: '100vh',
    fontFamily: 'var(--font-sans)',
    overflowX: 'hidden',
    scrollBehavior: 'smooth',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(8, 7, 17, 0.75)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--border-color)',
    transition: 'var(--transition-smooth)',
  },
  navContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
  },
  logoIcon: {
    color: '#6366f1',
    transform: 'rotate(45deg)',
    filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.6))',
  },
  logoText: {
    fontSize: '1.25rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    color: '#ffffff',
  },
  logoHighlight: {
    color: '#6366f1',
  },
  navLink: {
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: '500',
    transition: 'color 0.2s',
    ':hover': {
      color: '#ffffff'
    }
  },
  navButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  btnSecondary: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#f8fafc',
    padding: '8px 18px',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    ':hover': {
      background: 'rgba(255,255,255,0.05)',
      borderColor: 'rgba(255,255,255,0.2)'
    }
  },
  btnPrimaryGlow: {
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    border: 'none',
    color: '#ffffff',
    padding: '8px 18px',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)',
    transition: 'var(--transition-smooth)',
    ':hover': {
      boxShadow: '0 0 25px rgba(99, 102, 241, 0.65)',
      transform: 'translateY(-1px)'
    }
  },
  heroSection: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '80px 24px 60px 24px',
  },
  heroLayout: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '48px',
    textAlign: 'center',
  },
  heroLeft: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    maxWidth: '800px',
    margin: '0 auto',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    padding: '6px 14px',
    borderRadius: '100px',
    fontSize: '0.78rem',
    fontWeight: '600',
    color: '#818cf8',
    marginBottom: '24px',
  },
  badgeDot: {
    color: '#6366f1',
    animation: 'pulse 2s infinite',
  },
  gradientText: {
    background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  ctaPrimaryGlow: {
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    border: 'none',
    color: '#ffffff',
    padding: '14px 28px',
    borderRadius: '12px',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px rgba(99, 102, 241, 0.45)',
    transition: 'var(--transition-smooth)',
    ':hover': {
      boxShadow: '0 0 30px rgba(99, 102, 241, 0.7)',
      transform: 'translateY(-1px)'
    }
  },
  ctaSecondary: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#f8fafc',
    padding: '14px 28px',
    borderRadius: '12px',
    fontSize: '0.95rem',
    fontWeight: '600',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    ':hover': {
      background: 'rgba(255,255,255,0.07)',
      borderColor: 'rgba(255,255,255,0.25)'
    }
  },
  statsSection: {
    borderTop: '1px solid var(--border-color)',
    borderBottom: '1px solid var(--border-color)',
    background: 'rgba(255,255,255,0.005)',
    padding: '40px 24px',
  },
  statCard: {
    textAlign: 'center',
    padding: '12px',
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '4px',
    letterSpacing: '-0.02em',
  },
  statLabel: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '2px',
  },
  statDesc: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.35)',
  },
  section: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '90px 24px',
  },
  sectionHeader: {
    textAlign: 'center',
    marginBottom: '54px',
    maxWidth: '640px',
    margin: '0 auto 54px auto',
  },
  sectionTitle: {
    fontSize: '2.25rem',
    fontWeight: '800',
    letterSpacing: '-0.03em',
    color: '#ffffff',
    marginBottom: '12px',
  },
  sectionDesc: {
    fontSize: '0.975rem',
    color: '#94a3b8',
    lineHeight: '1.5',
  },
  featureCard: {
    padding: '36px',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    border: '1px solid rgba(255,255,255,0.06)',
    transition: 'all 0.3s ease',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 10px 30px rgba(99, 102, 241, 0.15)',
      borderColor: 'rgba(99,102,241,0.25)'
    }
  },
  featureIconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  featureTag: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px',
  },
  featureCardTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '10px',
  },
  featureCardDesc: {
    fontSize: '0.9rem',
    color: '#94a3b8',
    lineHeight: '1.55',
  },
  stepNumber: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: 'rgba(99, 102, 241, 0.15)',
    marginBottom: '12px',
    letterSpacing: '-0.02em',
  },
  stepTitle: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '8px',
  },
  stepDesc: {
    fontSize: '0.875rem',
    color: '#94a3b8',
    lineHeight: '1.5',
  },
  faqItem: {
    borderRadius: '16px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  faqQuestion: {
    width: '100%',
    background: 'none',
    border: 'none',
    padding: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#ffffff',
    fontSize: '1rem',
    fontWeight: '600',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    outline: 'none',
    ':hover': {
      backgroundColor: 'rgba(255,255,255,0.02)',
    }
  },
  faqAnswerContainer: {
    transition: 'all 0.3s cubic-bezier(0, 1, 0, 1)',
    overflow: 'hidden',
  },
  faqAnswer: {
    padding: '0 24px 24px 24px',
    color: '#94a3b8',
    fontSize: '0.9rem',
    lineHeight: '1.55',
  },
  ctaBannerSection: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 24px 80px 24px',
  },
  ctaBannerCard: {
    padding: '60px 40px',
    borderRadius: '24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.05) 0%, transparent 60%)',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  ctaBannerTitle: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '12px',
    letterSpacing: '-0.02em',
  },
  ctaBannerDesc: {
    fontSize: '1rem',
    color: '#94a3b8',
    marginBottom: '32px',
    maxWidth: '480px',
  },
  footer: {
    borderTop: '1px solid var(--border-color)',
    backgroundColor: '#05040a',
    padding: '60px 24px 30px 24px',
  },
  footerBrand: {
    maxWidth: '320px',
  },
  footerBrandText: {
    fontSize: '1.1rem',
    fontWeight: '800',
    color: '#ffffff',
  },
  footerBrandDesc: {
    fontSize: '0.85rem',
    color: '#64748b',
    lineHeight: '1.5',
    marginTop: '16px',
  },
  footerLinkCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  footerColTitle: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '6px',
  },
  footerLink: {
    color: '#64748b',
    textDecoration: 'none',
    fontSize: '0.85rem',
    transition: 'color 0.2s',
    ':hover': {
      color: '#ffffff',
    }
  },
  footerBottom: {
    maxWidth: '1200px',
    margin: '0 auto',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    paddingTop: '24px',
    textAlign: 'center',
    fontSize: '0.78rem',
    color: '#475569',
  }
};
