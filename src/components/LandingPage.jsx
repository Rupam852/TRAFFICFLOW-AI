import { useState, useEffect } from 'react';
import { Navigation, ArrowRight, ShieldCheck, Cpu, CloudRain, Map, ChevronDown, ChevronUp, Zap, GitMerge, BarChart3, Clock } from 'lucide-react';

export default function LandingPage({ onNavigate }) {
  const [activeFaq, setActiveFaq] = useState(null);
  const [animateGrid, setAnimateGrid] = useState(false);

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
          
          <nav style={styles.desktopNav}>
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
            <h1 style={styles.heroTitle}>
              Navigate Smarter with <span style={styles.gradientText}>AI-Powered</span> Route Optimization
            </h1>
            <p style={styles.heroDesc}>
              TrafficFlow AI combines real-time traffic telemetry, advanced weather canvas layers, and state-of-the-art artificial intelligence models to deliver the ultimate route optimization experience.
            </p>
            <div style={styles.ctaGroup}>
              <button onClick={() => onNavigate('signup')} style={styles.ctaPrimaryGlow}>
                Get Started for Free
                <ArrowRight size={18} style={{ marginLeft: '6px' }} />
              </button>
              <a href="#features" style={styles.ctaSecondary}>
                Explore Features
              </a>
            </div>
          </div>

          <div style={styles.heroRight}>
            {/* Interactive Mock Map Dashboard */}
            <div style={styles.dashboardMockup} className="glass-panel">
              <div style={styles.mockHeader}>
                <div style={styles.mockDots}>
                  <span style={{ ...styles.mockDot, backgroundColor: '#ef4444' }} />
                  <span style={{ ...styles.mockDot, backgroundColor: '#f59e0b' }} />
                  <span style={{ ...styles.mockDot, backgroundColor: '#10b981' }} />
                </div>
                <div style={styles.mockAddressBar}>
                  <span>https://trafficflowai.vercel.app/map</span>
                </div>
              </div>
              <div style={styles.mockContent}>
                {/* SVG/CSS Map Layout */}
                <div style={styles.mockMapContainer}>
                  {/* Grid Lines */}
                  <div style={styles.mapGrid} />
                  
                  {/* Glowing Traffic Route Lines */}
                  <svg style={styles.mapSvg} viewBox="0 0 400 300">
                    {/* Background paths */}
                    <path d="M 50 150 Q 150 100 200 150 T 350 150" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 100 50 L 300 250" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round" />

                    {/* Calculated Routes */}
                    <path d="M 50 150 Q 150 100 200 150 T 350 150" fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" className="pulse" style={{ opacity: 0.6 }} />
                    <path d="M 50 150 L 150 150 Q 220 220 280 150 L 350 150" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 4" />
                    
                    {/* Animated nodes */}
                    <circle cx="50" cy="150" r="6" fill="var(--primary)" />
                    <circle cx="350" cy="150" r="6" fill="#34d399" />
                    
                    {/* Pulsing locator */}
                    <circle cx="200" cy="150" r="10" fill="rgba(99, 102, 241, 0.2)" stroke="var(--primary)" strokeWidth="2" />
                    <circle cx="200" cy="150" r="3" fill="var(--primary)" />
                  </svg>

                  {/* UI Panel overlay */}
                  <div style={styles.mockOverlayPanel} className="glass-panel">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>FASTEST</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '600' }}>Route Optimized</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ETA: 12 mins</div>
                    <div style={{ fontSize: '10px', color: '#6366f1', marginTop: '4px' }}>AI Suggestion: Alternate path chosen due to jam.</div>
                  </div>

                  {/* Interactive Weather Effect Preview */}
                  <div style={styles.mockWeatherLayer}>
                    <div className="rain-drop" style={{ left: '20%', animationDelay: '0s' }} />
                    <div className="rain-drop" style={{ left: '40%', animationDelay: '0.4s' }} />
                    <div className="rain-drop" style={{ left: '60%', animationDelay: '0.2s' }} />
                    <div className="rain-drop" style={{ left: '80%', animationDelay: '0.6s' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Banner */}
      <section style={styles.statsSection}>
        <div style={styles.statsContainer}>
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

        <div style={styles.featuresGrid}>
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

        <div style={styles.stepsLayout}>
          <div style={styles.stepItem}>
            <div style={styles.stepNumber}>01</div>
            <h3 style={styles.stepTitle}>Create Your Secure Account</h3>
            <p style={styles.stepDesc}>Register with email or Google to enable persistent database storage for user settings.</p>
          </div>
          <div style={styles.stepDivider} />
          <div style={styles.stepItem}>
            <div style={styles.stepNumber}>02</div>
            <h3 style={styles.stepTitle}>Configure API Keys</h3>
            <p style={styles.stepDesc}>Add Mapbox, Google Maps, or Weather keys. Your keys stay secure in local cache or private rows.</p>
          </div>
          <div style={styles.stepDivider} />
          <div style={styles.stepItem}>
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

        <div style={styles.faqContainer}>
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
        <div style={styles.footerContent}>
          <div style={styles.footerBrand}>
            <div style={styles.logoBadge}>
              <Navigation size={20} style={styles.logoIcon} />
              <span style={styles.footerBrandText}>TRAFFICFLOW <span style={styles.logoHighlight}>AI</span></span>
            </div>
            <p style={styles.footerBrandDesc}>High-fidelity AI navigation, traffic telemetry analytics, and weather cycle integrations.</p>
          </div>
          <div style={styles.footerLinks}>
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
          </div>
        </div>
        <div style={styles.footerBottom}>
          <span>&copy; {new Date().getFullYear()} TrafficFlow AI. All rights reserved.</span>
        </div>
      </footer>
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
  desktopNav: {
    display: 'flex',
    gap: '32px',
    '@media (max-width: 768px)': {
      display: 'none',
    }
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
    justifyContent: 'space-between',
    gap: '48px',
    '@media (max-width: 960px)': {
      flexDirection: 'column',
      textAlign: 'center',
    }
  },
  heroLeft: {
    flex: 1.1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    '@media (max-width: 960px)': {
      alignItems: 'center',
    }
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
  heroTitle: {
    fontSize: '3rem',
    fontWeight: '800',
    lineHeight: '1.15',
    letterSpacing: '-0.04em',
    marginBottom: '20px',
    color: '#ffffff',
    '@media (max-width: 640px)': {
      fontSize: '2.25rem',
    }
  },
  gradientText: {
    background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroDesc: {
    fontSize: '1.1rem',
    color: '#94a3b8',
    lineHeight: '1.6',
    marginBottom: '36px',
    maxWidth: '540px',
  },
  ctaGroup: {
    display: 'flex',
    gap: '16px',
    '@media (max-width: 480px)': {
      flexDirection: 'column',
      width: '100%',
    }
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
  heroRight: {
    flex: 0.9,
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  dashboardMockup: {
    width: '100%',
    maxWidth: '480px',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
  },
  mockHeader: {
    backgroundColor: '#0c0a1a',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    borderBottom: '1px solid var(--border-color)',
  },
  mockDots: {
    display: 'flex',
    gap: '6px',
  },
  mockDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  mockAddressBar: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '6px',
    padding: '4px 12px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
  },
  mockContent: {
    backgroundColor: '#0a0915',
    padding: '16px',
    height: '320px',
    position: 'relative',
  },
  mockMapContainer: {
    width: '100%',
    height: '100%',
    background: 'radial-gradient(circle at center, #131126 0%, #080711 100%)',
    borderRadius: '12px',
    overflow: 'hidden',
    position: 'relative',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  mapGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
    backgroundSize: '20px 20px',
  },
  mapSvg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  mockOverlayPanel: {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    right: '12px',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  mockWeatherLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    pointerEvents: 'none',
  },
  statsSection: {
    borderTop: '1px solid var(--border-color)',
    borderBottom: '1px solid var(--border-color)',
    background: 'rgba(255,255,255,0.005)',
    padding: '40px 24px',
  },
  statsContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '24px',
    '@media (max-width: 768px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '@media (max-width: 480px)': {
      gridTemplateColumns: '1fr',
    }
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
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '24px',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    }
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
  stepsLayout: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '24px',
    '@media (max-width: 840px)': {
      flexDirection: 'column',
      textAlign: 'center',
      gap: '48px',
    }
  },
  stepItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    '@media (max-width: 840px)': {
      alignItems: 'center',
    }
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
  stepDivider: {
    width: '48px',
    height: '1px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    '@media (max-width: 840px)': {
      display: 'none',
    }
  },
  faqContainer: {
    maxWidth: '720px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
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
  footerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '48px',
    marginBottom: '48px',
    '@media (max-width: 768px)': {
      flexDirection: 'column',
      gap: '36px',
    }
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
  footerLinks: {
    display: 'flex',
    gap: '64px',
    '@media (max-width: 480px)': {
      gap: '32px',
      flexWrap: 'wrap',
    }
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
