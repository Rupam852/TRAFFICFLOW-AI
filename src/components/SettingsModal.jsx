import { useState, useEffect } from 'react';
import { X, ShieldAlert, Key, Globe, Eye, EyeOff, Check, Moon, Sun } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, settings, onSaveSettings }) {
  const [theme, setTheme] = useState(settings.theme || 'dark');
  const [googleMapsKey, setGoogleMapsKey] = useState(settings.googleMapsKey || '');
  const [mapboxKey, setMapboxKey] = useState(settings.mapboxKey || '');
  const [tomtomKey, setTomtomKey] = useState(settings.tomtomKey || '');
  const [openWeatherKey, setOpenWeatherKey] = useState(settings.openWeatherKey || '');
  const [aiProvider, setAiProvider] = useState(settings.aiProvider || 'gemini');
  const [aiKey, setAiKey] = useState(settings.aiKey || '');

  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showMapboxKey, setShowMapboxKey] = useState(false);
  const [showTomKey, setShowTomKey] = useState(false);
  const [showWeatherKey, setShowWeatherKey] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Sync state if settings prop changes
  useEffect(() => {
    setTimeout(() => {
      setTheme(settings.theme || 'dark');
      setGoogleMapsKey(settings.googleMapsKey || '');
      setMapboxKey(settings.mapboxKey || '');
      setTomtomKey(settings.tomtomKey || '');
      setOpenWeatherKey(settings.openWeatherKey || '');
      setAiProvider(settings.aiProvider || 'gemini');
      setAiKey(settings.aiKey || '');
    }, 0);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSaveSettings({
      theme,
      googleMapsKey,
      mapboxKey,
      tomtomKey,
      openWeatherKey,
      aiProvider,
      aiKey,
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div style={styles.backdrop}>
      <div className="glass-panel" style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.headerTitleGroup}>
            <Globe size={20} style={{ color: 'var(--primary)' }} />
            <h3>Application Settings</h3>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        {/* Developer Disclaimer Warning */}
        <div style={styles.warningBanner}>
          <ShieldAlert size={28} style={{ color: '#ef4444', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={styles.warningTitle}>API Keys Disclaimer & Security Warning</span>
            <span style={styles.warningText}>
              Your API keys are stored locally inside your browser cache (`localStorage`) and are used directly to query the provider endpoints. The developer takes no responsibility, does not host, and never stores these keys on any remote backend. Always set budgets/restrictions on your keys.
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} style={styles.form}>
          <div style={styles.scrollArea}>
            
            {/* Visual Style Settings */}
            <div style={styles.section}>
              <h4 style={styles.sectionTitle}>Visual Styling</h4>
              <div className="input-group">
                <label>Active Color Theme</label>
                <div style={styles.themeRow}>
                  <button
                    type="button"
                    style={{
                      ...styles.themeBtn,
                      backgroundColor: theme === 'light' ? 'var(--primary)' : 'var(--bg-tertiary)',
                      color: theme === 'light' ? '#ffffff' : 'var(--text-secondary)',
                      borderColor: theme === 'light' ? 'var(--primary)' : 'var(--border-color)',
                    }}
                    onClick={() => setTheme('light')}
                  >
                    <Sun size={16} />
                    <span>Light Mode</span>
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.themeBtn,
                      backgroundColor: theme === 'dark' ? 'var(--primary)' : 'var(--bg-tertiary)',
                      color: theme === 'dark' ? '#ffffff' : 'var(--text-secondary)',
                      borderColor: theme === 'dark' ? 'var(--primary)' : 'var(--border-color)',
                    }}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon size={16} />
                    <span>Dark Mode</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Map & Traffic Integration */}
            <div style={styles.section}>
              <h4 style={styles.sectionTitle}>Mapping Credentials</h4>
              
              <div className="input-group">
                <label>Google Maps API Key (Optional)</label>
                <div style={styles.inputWrapper}>
                  <Key size={16} style={styles.inputIcon} />
                  <input
                    type={showGoogleKey ? 'text' : 'password'}
                    className="input-field"
                    placeholder="Keyless / Local fallback by default..."
                    value={googleMapsKey}
                    onChange={(e) => setGoogleMapsKey(e.target.value)}
                    style={styles.fieldPadding}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGoogleKey(!showGoogleKey)}
                    style={styles.eyeBtn}
                  >
                    {showGoogleKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span style={styles.helperText}>Used for real-time maps, POI geocoding, and Google directions routing.</span>
              </div>

              <div className="input-group">
                <label>Mapbox GL Access Token</label>
                <div style={styles.inputWrapper}>
                  <Key size={16} style={styles.inputIcon} />
                  <input
                    type={showMapboxKey ? 'text' : 'password'}
                    className="input-field"
                    placeholder="pk.eyJ1Ijo..."
                    value={mapboxKey}
                    onChange={(e) => setMapboxKey(e.target.value)}
                    style={styles.fieldPadding}
                  />
                  <button
                    type="button"
                    onClick={() => setShowMapboxKey(!showMapboxKey)}
                    style={styles.eyeBtn}
                  >
                    {showMapboxKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span style={styles.helperText}>Used for high-fidelity 3D vector tile layouts.</span>
              </div>

              <div className="input-group">
                <label>TomTom Traffic API Key</label>
                <div style={styles.inputWrapper}>
                  <Key size={16} style={styles.inputIcon} />
                  <input
                    type={showTomKey ? 'text' : 'password'}
                    className="input-field"
                    placeholder="TomTom API key..."
                    value={tomtomKey}
                    onChange={(e) => setTomtomKey(e.target.value)}
                    style={styles.fieldPadding}
                  />
                  <button
                    type="button"
                    onClick={() => setShowTomKey(!showTomKey)}
                    style={styles.eyeBtn}
                  >
                    {showTomKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span style={styles.helperText}>Used for real-time delay, incident analysis, and congestion mapping.</span>
              </div>

              <div className="input-group">
                <label>OpenWeatherMap API Key (Optional)</label>
                <div style={styles.inputWrapper}>
                  <Key size={16} style={styles.inputIcon} />
                  <input
                    type={showWeatherKey ? 'text' : 'password'}
                    className="input-field"
                    placeholder="OpenWeatherMap appid..."
                    value={openWeatherKey}
                    onChange={(e) => setOpenWeatherKey(e.target.value)}
                    style={styles.fieldPadding}
                  />
                  <button
                    type="button"
                    onClick={() => setShowWeatherKey(!showWeatherKey)}
                    style={styles.eyeBtn}
                  >
                    {showWeatherKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span style={styles.helperText}>Enables automatic climate & day-night time cycles sync on the map based on live real-world weather.</span>
              </div>
            </div>

            {/* AI Providers */}
            <div style={styles.section}>
              <h4 style={styles.sectionTitle}>AI Cognitive Routing</h4>
              <div className="input-group">
                <label>Cognitive LLM Provider</label>
                <select
                  className="input-field"
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="gemini">Google Gemini AI</option>
                  <option value="openai">OpenAI (GPT-4o / GPT-3.5)</option>
                  <option value="claude">Anthropic Claude (Sonnet / Haiku)</option>
                </select>
              </div>

              <div className="input-group">
                <label>{aiProvider.toUpperCase()} Secret Key</label>
                <div style={styles.inputWrapper}>
                  <Key size={16} style={styles.inputIcon} />
                  <input
                    type={showAiKey ? 'text' : 'password'}
                    className="input-field"
                    placeholder={`Insert your ${aiProvider} API key...`}
                    value={aiKey}
                    onChange={(e) => setAiKey(e.target.value)}
                    style={styles.fieldPadding}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAiKey(!showAiKey)}
                    style={styles.eyeBtn}
                  >
                    {showAiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span style={styles.helperText}>Powers natural language route summaries and sudden traffic updates.</span>
              </div>
            </div>

          </div>

          <div style={styles.footer}>
            <button
              type="submit"
              className="glow-btn"
              style={{
                ...styles.saveBtn,
                backgroundColor: isSaved ? 'var(--traffic-smooth)' : 'var(--primary)',
                boxShadow: isSaved ? '0 4px 12px var(--traffic-smooth-glow)' : '0 4px 12px var(--primary-glow)',
              }}
            >
              {isSaved ? (
                <>
                  <Check size={18} />
                  <span>Settings Saved!</span>
                </>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 100000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modal: {
    width: '100%',
    maxWidth: '540px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'fadeIn 0.3s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border-color)',
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '50%',
    transition: 'var(--transition-smooth)',
    '&:hover': {
      backgroundColor: 'var(--bg-tertiary)',
    },
  },
  warningBanner: {
    display: 'flex',
    gap: '14px',
    padding: '16px 20px',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
    alignItems: 'flex-start',
  },
  warningTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#ef4444',
    textTransform: 'uppercase',
  },
  warningText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flex: 1,
  },
  scrollArea: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  section: {
    marginBottom: '28px',
  },
  sectionTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '16px',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '6px',
  },
  themeRow: {
    display: 'flex',
    gap: '12px',
  },
  themeBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'var(--transition-smooth)',
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
  fieldPadding: {
    paddingLeft: '40px',
    paddingRight: '40px',
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  helperText: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
  },
  footer: {
    padding: '20px 24px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'flex-end',
    backgroundColor: 'var(--bg-tertiary)',
  },
  saveBtn: {
    width: '100%',
    justifyContent: 'center',
  },
};
