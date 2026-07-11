import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { MapPin, Navigation, History, Map, MessageSquareText, Trash2, LogOut, Zap, Clock, Route, TrendingUp } from 'lucide-react';
import AiPanel from './AiPanel';
import { incrementApiUsage } from '../utils/usage';

const Sidebar = forwardRef(function Sidebar({
  settings,
  isSidebarOpen,
  onCollapse,
  startLocation,
  setStartLocation,
  destination,
  setDestination,
  routeOptions,
  selectedRouteIndex,
  onRouteSelected,
  searchHistory,
  onSelectHistory,
  onRemoveHistory,
  onAmenitiesSearch,
  onOpenSettings,
  onLogout,
  user,
  onShareEta,
  travelMode,
  onTravelModeChange,
  isSimulationMode,
  routingError,
  isRoutesLoading,
  isRouteSwitching,
  gmapsLoaded,
  isRouteSimulationActive,
  onStartSimulation,
  onStopSimulation,
  activeTab,
  setActiveTab
}, ref) {
  const [startInput, setStartInput] = useState(startLocation?.name || '');
  const [destInput, setDestInput] = useState(destination?.name || '');

  const [startSuggestions, setStartSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [focusedField, setFocusedField] = useState(null);

  useImperativeHandle(ref, () => ({
    closePopups() {
      let closedSomething = false;
      if (startSuggestions.length > 0 || destSuggestions.length > 0 || focusedField !== null) {
        setStartSuggestions([]);
        setDestSuggestions([]);
        setFocusedField(null);
        closedSomething = true;
      }
      return closedSomething;
    }
  }));

  const startInputRef = useRef(null);
  const destInputRef = useRef(null);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setTimeout(() => { setStartInput(startLocation?.name || ''); }, 0);
  }, [startLocation]);

  useEffect(() => {
    setTimeout(() => { setDestInput(destination?.name || ''); }, 0);
  }, [destination]);

  const queryAutocomplete = useCallback(async (query, field) => {
    if (!query || query.trim().length < 2) {
      if (field === 'start') setStartSuggestions([]);
      if (field === 'dest') setDestSuggestions([]);
      return;
    }

    const trimmed = query.trim();
    const biasCoords = startLocation?.coordinates || [77.2090, 28.6139];

    if (settings.mapboxKey) {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?access_token=${settings.mapboxKey}&proximity=${biasCoords[0]},${biasCoords[1]}&limit=5`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const results = (data.features || []).map(f => ({
            name: f.place_name,
            coordinates: f.geometry.coordinates
          }));

          if (field === 'start') setStartSuggestions(results);
          if (field === 'dest') setDestSuggestions(results);
          return;
        }
      } catch (err) {
        console.warn('Mapbox Autocomplete failed, falling back to Photon:', err);
      }
    }

    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&lat=${biasCoords[1]}&lon=${biasCoords[0]}&limit=5`;
      const res = await fetch(url);
      const data = await res.json();
      const results = (data.features || []).map(f => {
        const props = f.properties;
        const parts = [];
        if (props.name) parts.push(props.name);
        if (props.city && props.city !== props.name) parts.push(props.city);
        if (props.state && props.state !== props.name && props.state !== props.city) parts.push(props.state);
        if (props.country) parts.push(props.country);
        return { name: parts.join(', '), coordinates: f.geometry.coordinates };
      });
      if (field === 'start') setStartSuggestions(results);
      if (field === 'dest') setDestSuggestions(results);
    } catch (err) {
      // silent fail
    }
  }, [startLocation, settings.mapboxKey]);

  useEffect(() => {
    if (focusedField === 'start' && startInput.trim().length >= 2) {
      const t = setTimeout(() => queryAutocomplete(startInput, 'start'), 300);
      return () => clearTimeout(t);
    } else if (focusedField === 'start') {
      setStartSuggestions([]);
    }
  }, [startInput, focusedField, queryAutocomplete]);

  useEffect(() => {
    if (focusedField === 'dest' && destInput.trim().length >= 2) {
      const t = setTimeout(() => queryAutocomplete(destInput, 'dest'), 300);
      return () => clearTimeout(t);
    } else if (focusedField === 'dest') {
      setDestSuggestions([]);
    }
  }, [destInput, focusedField, queryAutocomplete]);

  const handleSelectSuggestion = useCallback((suggestion, field) => {
    if (field === 'start') {
      setStartInput(suggestion.name);
      setStartSuggestions([]);
      if (suggestion.coordinates) {
        setStartLocation({ name: suggestion.name, coordinates: suggestion.coordinates });
      }
    } else {
      setDestInput(suggestion.name);
      setDestSuggestions([]);
      if (suggestion.coordinates) {
        setDestination({ name: suggestion.name, coordinates: suggestion.coordinates });
      }
    }
  }, [setStartLocation, setDestination]);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    incrementApiUsage('routing');

    const geocodeQuery = async (query) => {
      if (settings.mapboxKey) {
        try {
          const biasCoords = startLocation?.coordinates || [77.2090, 28.6139];
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${settings.mapboxKey}&proximity=${biasCoords[0]},${biasCoords[1]}&limit=1`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            const f = data.features?.[0];
            if (f) {
              return { name: f.place_name, coordinates: f.geometry.coordinates };
            }
          }
        } catch (err) {
          console.warn('Mapbox Geocoder failed, falling back to Photon:', err);
        }
      }

      try {
        const biasCoords = startLocation?.coordinates || [77.2090, 28.6139];
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${biasCoords[1]}&lon=${biasCoords[0]}&limit=1`;
        const res = await fetch(url);
        const data = await res.json();
        const f = data.features?.[0];
        if (f) {
          const props = f.properties;
          const parts = [];
          if (props.name) parts.push(props.name);
          if (props.city && props.city !== props.name) parts.push(props.city);
          if (props.state && props.state !== props.name && props.state !== props.city) parts.push(props.state);
          if (props.country) parts.push(props.country);
          return { name: parts.join(', '), coordinates: f.geometry.coordinates };
        }
      } catch (err) {
        console.error('All geocoding options failed:', err);
      }
      return null;
    };

    if (startInput && (!startLocation || startInput.toLowerCase() !== startLocation.name.toLowerCase())) {
      const startResult = await geocodeQuery(startInput);
      if (startResult) setStartLocation(startResult);
    }

    if (destInput && (!destination || destInput.toLowerCase() !== destination.name.toLowerCase())) {
      const destResult = await geocodeQuery(destInput);
      if (destResult) setDestination(destResult);
    } else if (destination) {
      setDestination({ ...destination });
    }

    if (onCollapse) onCollapse();
  };

  const getTrafficConfig = (status) => {
    const configs = {
      smooth: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', label: 'SMOOTH', glow: 'rgba(16,185,129,0.3)' },
      moderate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', label: 'MODERATE', glow: 'rgba(245,158,11,0.3)' },
      heavy: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', label: 'HEAVY', glow: 'rgba(239,68,68,0.3)' },
      blocked: { color: '#7f1d1d', bg: 'rgba(127,29,29,0.15)', border: 'rgba(127,29,29,0.3)', label: 'BLOCKED', glow: 'rgba(127,29,29,0.4)' },
    };
    return configs[status] || configs.smooth;
  };

  const userDisplayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Guest';
  const userInitial = userDisplayName[0]?.toUpperCase() || 'U';

  return (
    <>
      {isMobile && isSidebarOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={onCollapse}
          style={{ display: 'block' }}
        />
      )}

      <div
        className={[
          'glass-panel',
          'sidebar-responsive',
          isMobile ? (isSidebarOpen ? 'sidebar-open-mobile' : 'sidebar-closed-mobile') : ''
        ].join(' ')}
        style={{
          ...styles.sidebar,
          marginLeft: !isMobile ? (isSidebarOpen ? '0px' : '-420px') : undefined,
          transition: isMobile
            ? 'transform 0.32s cubic-bezier(0.4,0,0.2,1)'
            : 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Premium Header */}
        <div style={styles.header}>
          <div style={styles.logoGroup}>
            <div style={styles.logoIconWrap}>
              <Navigation size={18} style={{ color: '#fff', transform: 'rotate(45deg)' }} />
            </div>
            <div>
              <h2 style={styles.logoText}>TrafficFlow <span style={styles.logoHighlight}>AI</span></h2>
              <div style={styles.logoSubtext}>Smart Navigation Platform</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={onOpenSettings} style={styles.iconBtn} title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            <button
              className="mobile-only"
              onClick={onCollapse}
              style={styles.mobileCloseBtn}
              title="Close Menu"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Premium User Profile Section */}
        <div style={styles.userSection}>
          <div style={styles.avatarWrap}>
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="avatar"
                style={styles.avatarImg}
              />
            ) : (
              <div style={styles.avatarInitial}>{userInitial}</div>
            )}
            <div style={styles.onlineDot} />
          </div>
          <div style={styles.userInfo}>
            <span style={styles.userName}>{userDisplayName}</span>
            <span style={styles.userEmail}>
              {user?.user_metadata?.full_name || user?.user_metadata?.name ? user.email : 'Premium Account'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={styles.premiumBadge}>
              <Zap size={10} style={{ color: '#f59e0b' }} />
              <span>PRO</span>
            </div>
            <button onClick={onLogout} className="logout-btn" title="Sign Out">
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* Premium Tabs */}
        <div style={styles.tabContainer}>
          <button
            style={{
              ...styles.tab,
              color: activeTab === 'nav' ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
            onClick={() => setActiveTab('nav')}
          >
            <div style={{
              ...styles.tabInner,
              background: activeTab === 'nav' ? 'rgba(99,102,241,0.12)' : 'transparent',
              border: activeTab === 'nav' ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
            }}>
              <Route size={14} style={{ color: activeTab === 'nav' ? 'var(--primary)' : 'inherit' }} />
              <span>Navigation</span>
            </div>
          </button>
          <button
            style={{
              ...styles.tab,
              color: activeTab === 'ai' ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
            onClick={() => setActiveTab('ai')}
          >
            <div style={{
              ...styles.tabInner,
              background: activeTab === 'ai' ? 'rgba(139,92,246,0.12)' : 'transparent',
              border: activeTab === 'ai' ? '1px solid rgba(139,92,246,0.25)' : '1px solid transparent',
            }}>
              <MessageSquareText size={14} style={{ color: activeTab === 'ai' ? '#a855f7' : 'inherit' }} />
              <span>AI Advisor</span>
            </div>
          </button>
        </div>

        {/* Tab Panel Contents */}
        <div style={styles.panelContent} className="panel-content-scroll">
          {activeTab === 'nav' ? (
            <div style={styles.navPanel}>

              {/* Routing Error / Simulation Banner */}
              {routingError && (
                <div style={{
                  background: isSimulationMode ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                  border: isSimulationMode ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(245,158,11,0.25)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  fontSize: '0.78rem',
                  color: isSimulationMode ? '#f87171' : '#fbbf24',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  lineHeight: '1.4',
                  backdropFilter: 'blur(8px)',
                }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}>⚠️</span>
                  <div>
                    <strong>{isSimulationMode ? 'Simulation Mode Active' : 'Routing API Status Warning'}</strong>
                    <div style={{ marginTop: '4px', fontSize: '0.73rem', opacity: 0.85 }}>{routingError}</div>
                    {(routingError.includes('Console') || routingError.includes('denied')) && (
                      <div style={{ marginTop: '8px', fontSize: '0.71rem', fontWeight: '700', textDecoration: 'underline' }}>
                        To fix: Wait 5 minutes for activation, check API key restrictions/billing in Google Console, and refresh the page.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Premium Search Form */}
              <div style={styles.searchCard}>
                <div style={styles.searchCardHeader}>
                  <TrendingUp size={14} style={{ color: 'var(--primary)' }} />
                  <span style={styles.searchCardTitle}>Route Planner</span>
                </div>
                <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
                  <div style={styles.searchWrapper}>
                    <div style={styles.searchConnector}>
                      <div style={styles.connectorDotTop} />
                      <div style={styles.connectorLine} />
                      <div style={styles.connectorDotBottom} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      {/* Start Field */}
                      <div style={{ position: 'relative', zIndex: 10 }}>
                        <div style={{
                          ...styles.searchFieldGroup,
                          borderColor: focusedField === 'start' ? 'var(--primary)' : 'var(--border-color)',
                          boxShadow: focusedField === 'start' ? '0 0 0 3px var(--primary-glow)' : 'none',
                        }}>
                          <MapPin size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <input
                            ref={startInputRef}
                            type="text"
                            placeholder="Starting point..."
                            value={startInput}
                            onChange={(e) => { setStartInput(e.target.value); setFocusedField('start'); }}
                            onFocus={() => setFocusedField('start')}
                            onBlur={() => setTimeout(() => setFocusedField(null), 200)}
                            style={styles.searchInput}
                          />
                          {startInput && (
                            <button
                              type="button"
                              onClick={() => { setStartInput(''); setStartSuggestions([]); }}
                              style={styles.clearBtn}
                            >×</button>
                          )}
                        </div>
                        {focusedField === 'start' && startSuggestions.length > 0 && (
                          <div className="suggestions-dropdown">
                            {startSuggestions.map((s, idx) => (
                              <div key={idx} onMouseDown={() => handleSelectSuggestion(s, 'start')} className="suggestion-item">
                                <MapPin size={12} className="suggestion-icon" style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                <span className="suggestion-text">{s.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Destination Field */}
                      <div style={{ position: 'relative', zIndex: 9 }}>
                        <div style={{
                          ...styles.searchFieldGroup,
                          borderColor: focusedField === 'dest' ? '#a855f7' : 'var(--border-color)',
                          boxShadow: focusedField === 'dest' ? '0 0 0 3px rgba(168,85,247,0.2)' : 'none',
                        }}>
                          <Navigation size={15} style={{ color: '#a855f7', flexShrink: 0, transform: 'rotate(45deg)' }} />
                          <input
                            ref={destInputRef}
                            type="text"
                            placeholder="Where to?"
                            value={destInput}
                            onChange={(e) => { setDestInput(e.target.value); setFocusedField('dest'); }}
                            onFocus={() => setFocusedField('dest')}
                            onBlur={() => setTimeout(() => setFocusedField(null), 200)}
                            style={styles.searchInput}
                            required
                          />
                          {destInput && (
                            <button
                              type="button"
                              onClick={() => { setDestInput(''); setDestSuggestions([]); }}
                              style={styles.clearBtn}
                            >×</button>
                          )}
                        </div>
                        {focusedField === 'dest' && destSuggestions.length > 0 && (
                          <div className="suggestions-dropdown">
                            {destSuggestions.map((s, idx) => (
                              <div key={idx} onMouseDown={() => handleSelectSuggestion(s, 'dest')} className="suggestion-item">
                                <Navigation size={12} className="suggestion-icon" style={{ color: '#a855f7', transform: 'rotate(45deg)', flexShrink: 0 }} />
                                <span className="suggestion-text">{s.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="glow-btn" style={styles.findRouteBtn}>
                    <Zap size={15} />
                    Find Fastest Route
                  </button>
                </form>
              </div>

              {/* Search History */}
              {searchHistory.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                      <span style={styles.sectionTitle}>Recent</span>
                    </div>
                  </div>
                  <div style={styles.historyList}>
                    {searchHistory.map((item, index) => (
                      <div
                        key={index}
                        onClick={() => { setDestInput(item.name); onSelectHistory(item); }}
                        style={styles.historyItem}
                      >
                        <div style={styles.historyIconWrap}>
                          <History size={12} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <span style={{ ...styles.historyName, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {item.name}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveHistory(index); }}
                          className="delete-bookmark-btn"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Routes Section */}
              {((routeOptions && routeOptions.length > 0) || isRoutesLoading) && (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Route size={13} style={{ color: 'var(--text-muted)' }} />
                      <span style={styles.sectionTitle}>
                        {isRoutesLoading ? 'Calculating...' : 'Routes Found'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <select
                        value={travelMode}
                        onChange={(e) => onTravelModeChange(e.target.value)}
                        style={styles.modeSelect}
                      >
                        <option value="car">🚗 Car</option>
                        <option value="motorbike">🏍️ Bike</option>
                        <option value="bicycle">🚲 Cycle</option>
                        <option value="walk">🚶 Walk</option>
                      </select>
                      <button onClick={onShareEta} className="glow-btn" style={styles.shareBtn}>
                        Share ETA
                      </button>
                    </div>
                  </div>

                  <div style={{ ...styles.routesList, position: 'relative' }}>
                    {isRoutesLoading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[1, 2, 3].map((n) => (
                          <div key={n} className="skeleton-card skeleton-pulse" style={{ marginBottom: '4px' }}>
                            <div className="skeleton-header">
                              <div className="skeleton-title" />
                              <div className="skeleton-badge" />
                            </div>
                            <div className="skeleton-stats" style={{ marginTop: '8px' }} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {routeOptions.map((route, idx) => {
                          const isSelected = idx === selectedRouteIndex;
                          const tc = getTrafficConfig(route.trafficStatus);

                          return (
                            <div
                              key={idx}
                              onClick={() => onRouteSelected(idx)}
                              style={{
                                ...styles.routeCard,
                                borderColor: isSelected ? 'rgba(99,102,241,0.5)' : 'var(--border-color)',
                                background: isSelected
                                  ? 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.06) 100%)'
                                  : 'var(--bg-secondary)',
                                boxShadow: isSelected ? '0 4px 20px rgba(99,102,241,0.15), inset 0 0 0 1px rgba(99,102,241,0.1)' : 'var(--shadow-sm)',
                              }}
                            >
                              {/* Route Card Header */}
                              <div style={styles.routeHeader}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: tc.color,
                                    boxShadow: `0 0 6px ${tc.glow}`,
                                    flexShrink: 0,
                                  }} />
                                  <span style={styles.routeName}>{route.name}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                  {route.isRecommended && (
                                    <span style={styles.recommendedBadge}>⭐ BEST</span>
                                  )}
                                  {isSelected && (
                                    <span style={styles.liveBadge}>
                                      <span className="pulse-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                                      LIVE
                                    </span>
                                  )}
                                  <span style={{
                                    ...styles.trafficBadge,
                                    color: tc.color,
                                    backgroundColor: tc.bg,
                                    border: `1px solid ${tc.border}`,
                                  }}>
                                    {tc.label}
                                  </span>
                                </div>
                              </div>

                              {/* Route Stats */}
                              <div style={styles.routeStats}>
                                <div style={styles.routeStatItem}>
                                  <Clock size={11} style={{ color: 'var(--text-muted)' }} />
                                  <span style={styles.routeStatVal}>{route.duration}</span>
                                </div>
                                <div style={styles.routeStatDivider} />
                                <div style={styles.routeStatItem}>
                                  <Route size={11} style={{ color: 'var(--text-muted)' }} />
                                  <span>{route.distance}</span>
                                </div>
                              </div>

                              {/* Traffic Progress Bar */}
                              <div style={styles.trafficBar}>
                                <div style={{
                                  ...styles.trafficBarFill,
                                  width: route.trafficStatus === 'smooth' ? '30%'
                                    : route.trafficStatus === 'moderate' ? '60%'
                                    : route.trafficStatus === 'heavy' ? '85%' : '100%',
                                  backgroundColor: tc.color,
                                  boxShadow: `0 0 6px ${tc.glow}`,
                                }} />
                              </div>

                              {route.delayInfo && (
                                <span style={styles.delayInfo}>⚠️ {route.delayInfo}</span>
                              )}
                              {route.aiReason && (
                                <div style={styles.aiReason}>
                                  🧠 <strong>AI:</strong> {route.aiReason}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {routeOptions.length === 1 && (
                          <div style={styles.noAlternativesText}>ℹ️ No alternative routes available.</div>
                        )}
                        {routeOptions.length === 0 && (
                          <div style={styles.noAlternativesText}>⚠️ No routes found for this trip.</div>
                        )}
                      </>
                    )}

                    {isRouteSwitching && (
                      <div className="route-switch-overlay">
                        <div className="route-switch-spinner" />
                        <span className="route-switch-text">Analyzing path & traffic...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <AiPanel
              settings={settings}
              startLocation={startLocation}
              destination={destination}
              routeOptions={routeOptions}
              selectedRouteIndex={selectedRouteIndex}
            />
          )}
        </div>
      </div>
    </>
  );
});

const styles = {
  sidebar: {
    width: '400px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderTopLeftRadius: '0px',
    borderBottomLeftRadius: '0px',
    borderTopRightRadius: '16px',
    borderBottomRightRadius: '16px',
    borderLeft: 'none',
    borderRight: 'none',
    zIndex: 200,
    flexShrink: 0,
  },

  // ── Header ──
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 20px',
    borderBottom: '1px solid var(--border-color)',
    background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.04) 100%)',
  },
  logoGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoIconWrap: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
    flexShrink: 0,
  },
  logoText: {
    fontSize: '1.1rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    color: 'var(--text-primary)',
    lineHeight: 1.1,
  },
  logoHighlight: {
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  logoSubtext: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
    letterSpacing: '0.02em',
    marginTop: '1px',
  },
  iconBtn: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition-smooth)',
  },

  // ── User Section ──
  userSection: {
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '1px solid var(--border-color)',
    background: 'rgba(255,255,255,0.015)',
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatarImg: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: '2px solid rgba(99,102,241,0.4)',
    objectFit: 'cover',
    boxShadow: '0 0 12px rgba(99,102,241,0.3)',
  },
  avatarInitial: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '1rem',
    boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
    letterSpacing: '-0.02em',
  },
  onlineDot: {
    position: 'absolute',
    bottom: '-2px',
    right: '-2px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    border: '2px solid var(--bg-glass)',
    boxShadow: '0 0 6px rgba(16,185,129,0.6)',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  userName: {
    fontSize: '0.88rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.01em',
  },
  userEmail: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  premiumBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    padding: '3px 8px',
    borderRadius: '20px',
    background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(251,191,36,0.1) 100%)',
    border: '1px solid rgba(245,158,11,0.3)',
    fontSize: '0.62rem',
    fontWeight: '800',
    color: '#f59e0b',
    letterSpacing: '0.06em',
    flexShrink: 0,
  },

  // ── Tabs ──
  tabContainer: {
    display: 'flex',
    gap: '6px',
    padding: '10px 14px',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-tertiary)',
  },
  tab: {
    flex: 1,
    background: 'none',
    border: 'none',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    padding: 0,
  },
  tabInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '8px',
    transition: 'var(--transition-smooth)',
  },

  // ── Panel & Nav Panel ──
  panelContent: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  navPanel: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  // ── Search Card ──
  searchCard: {
    borderRadius: '14px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: 'var(--shadow-sm)',
  },
  searchCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  searchCardTitle: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  searchForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  searchWrapper: {
    display: 'flex',
    gap: '12px',
    alignItems: 'stretch',
  },
  searchConnector: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '17px',
    paddingBottom: '17px',
    gap: 0,
    flexShrink: 0,
  },
  connectorDotTop: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary)',
    boxShadow: '0 0 6px var(--primary-glow)',
    flexShrink: 0,
  },
  connectorLine: {
    flex: 1,
    width: '2px',
    background: 'linear-gradient(to bottom, var(--primary), #a855f7)',
    minHeight: '20px',
    borderRadius: '1px',
    opacity: 0.4,
  },
  connectorDotBottom: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#a855f7',
    boxShadow: '0 0 6px rgba(168,85,247,0.4)',
    flexShrink: 0,
  },
  searchFieldGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    transition: 'var(--transition-smooth)',
  },
  searchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.85rem',
    minWidth: 0,
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '1.1rem',
    lineHeight: 1,
    padding: '0 2px',
    flexShrink: 0,
  },
  findRouteBtn: {
    width: '100%',
    padding: '11px',
    justifyContent: 'center',
    fontSize: '0.88rem',
    fontWeight: '700',
    borderRadius: '10px',
    letterSpacing: '0.02em',
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
  },

  // ── Sections ──
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },

  // ── History ──
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    border: '1px solid transparent',
  },
  historyIconWrap: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyName: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },

  // ── Routes ──
  routesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  routeCard: {
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
  },
  routeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  routeName: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  trafficBadge: {
    fontSize: '0.62rem',
    fontWeight: '800',
    padding: '2px 7px',
    borderRadius: '20px',
    letterSpacing: '0.05em',
  },
  recommendedBadge: {
    fontSize: '0.6rem',
    fontWeight: '800',
    color: '#f59e0b',
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.3)',
    padding: '2px 6px',
    borderRadius: '20px',
    letterSpacing: '0.04em',
  },
  liveBadge: {
    fontSize: '0.6rem',
    fontWeight: '800',
    color: '#10b981',
    border: '1px solid rgba(16,185,129,0.3)',
    backgroundColor: 'rgba(16,185,129,0.1)',
    padding: '2px 6px',
    borderRadius: '20px',
    letterSpacing: '0.04em',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  routeStats: {
    display: 'flex',
    gap: '10px',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    alignItems: 'center',
    marginBottom: '8px',
  },
  routeStatItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  routeStatVal: {
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  routeStatDivider: {
    width: '3px',
    height: '3px',
    borderRadius: '50%',
    backgroundColor: 'var(--text-muted)',
  },
  trafficBar: {
    height: '3px',
    borderRadius: '99px',
    backgroundColor: 'var(--border-color)',
    overflow: 'hidden',
    marginBottom: '6px',
  },
  trafficBarFill: {
    height: '100%',
    borderRadius: '99px',
    transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
  },
  delayInfo: {
    display: 'block',
    fontSize: '0.73rem',
    color: 'var(--traffic-heavy)',
    marginTop: '4px',
    fontWeight: '500',
  },
  aiReason: {
    marginTop: '8px',
    fontSize: '0.73rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'rgba(139,92,246,0.07)',
    borderLeft: '3px solid rgba(139,92,246,0.5)',
    padding: '7px 10px',
    borderRadius: '0 6px 6px 0',
    fontWeight: '500',
    lineHeight: '1.45',
  },

  // ── Misc ──
  modeSelect: {
    padding: '5px 8px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: '0.73rem',
    fontWeight: '600',
    outline: 'none',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
  },
  shareBtn: {
    padding: '5px 10px',
    fontSize: '0.73rem',
    borderRadius: '8px',
  },
  noAlternativesText: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    padding: '14px',
    border: '1px dashed rgba(255,255,255,0.08)',
    borderRadius: '10px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginTop: '4px',
    lineHeight: '1.4',
  },
  mobileCloseBtn: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    color: '#f87171',
    borderRadius: '8px',
    padding: '5px 10px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '700',
    lineHeight: 1,
    transition: 'var(--transition-fast)',
  },
};

export default Sidebar;
