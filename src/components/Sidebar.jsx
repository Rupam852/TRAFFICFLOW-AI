import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { MapPin, Navigation, History, Map, MessageSquareText, Trash2, LogOut } from 'lucide-react';
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

  // Detect mobile viewport
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync inputs with props
  useEffect(() => {
    setTimeout(() => {
      setStartInput(startLocation?.name || '');
    }, 0);
  }, [startLocation]);

  useEffect(() => {
    setTimeout(() => {
      setDestInput(destination?.name || '');
    }, 0);
  }, [destination]);

  // Query Autocomplete Suggestions from Mapbox, TomTom, or free OSM Photon
  const queryAutocomplete = useCallback(async (query, field) => {
    if (!query || query.trim().length < 2) {
      if (field === 'start') setStartSuggestions([]);
      if (field === 'dest') setDestSuggestions([]);
      return;
    }

    const trimmed = query.trim();
    const biasCoords = startLocation?.coordinates || [77.2090, 28.6139]; // Default Delhi CP coords

    // 0. Try Google Places Autocomplete if loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      try {
        const autocompleteService = new window.google.maps.places.AutocompleteService();
        const predictions = await new Promise((resolve, reject) => {
          autocompleteService.getPlacePredictions(
            {
              input: trimmed,
              locationBias: new window.google.maps.LatLng(biasCoords[1], biasCoords[0])
            },
            (predictions, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                resolve(predictions);
              } else {
                reject(new Error('Google Places Autocomplete failed with status: ' + status));
              }
            }
          );
        });

        if (predictions && predictions.length > 0) {
          incrementApiUsage('googleMaps');
          const list = predictions.map(p => ({
            name: p.description,
            placeId: p.place_id,
            isGoogle: true
          }));
          if (field === 'start') setStartSuggestions(list);
          if (field === 'dest') setDestSuggestions(list);
          return;
        }
      } catch (e) {
        console.warn('Google Places Autocomplete error, falling back:', e);
      }
    }

    // 1. Try Mapbox if key is available
    if (settings.mapboxKey) {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?access_token=${settings.mapboxKey}&limit=5&proximity=${biasCoords[0]},${biasCoords[1]}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          incrementApiUsage('mapbox');
          const list = data.features.map(f => ({
            name: f.place_name,
            coordinates: f.geometry.coordinates
          }));
          if (field === 'start') setStartSuggestions(list);
          if (field === 'dest') setDestSuggestions(list);
          return;
        }
      } catch (e) {
        console.warn('Mapbox Autocomplete error, falling back:', e);
      }
    }

    // 2. Try TomTom if key is available
    if (settings.tomtomKey) {
      try {
        const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(trimmed)}.json?key=${settings.tomtomKey}&limit=5&lat=${biasCoords[1]}&lon=${biasCoords[0]}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          incrementApiUsage('tomtom');
          const list = data.results.map(r => ({
            name: r.address.freeformAddress,
            coordinates: [r.position.lon, r.position.lat]
          }));
          if (field === 'start') setStartSuggestions(list);
          if (field === 'dest') setDestSuggestions(list);
          return;
        }
      } catch (e) {
        console.warn('TomTom Autocomplete error, falling back:', e);
      }
    }

    // 3. Fallback: Komoot Photon API (free, OSM-based)
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=5&lat=${biasCoords[1]}&lon=${biasCoords[0]}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const list = data.features.map(f => {
          const props = f.properties;
          const parts = [];
          if (props.name) parts.push(props.name);
          if (props.city && props.city !== props.name) parts.push(props.city);
          if (props.state && props.state !== props.name && props.state !== props.city) parts.push(props.state);
          if (props.country) parts.push(props.country);
          return {
            name: parts.join(', '),
            coordinates: f.geometry.coordinates
          };
        });
        if (field === 'start') setStartSuggestions(list);
        if (field === 'dest') setDestSuggestions(list);
      }
    } catch (e) {
      console.error('All Autocomplete options failed:', e);
    }
  }, [startLocation, settings.mapboxKey, settings.tomtomKey]);

  // Debounced query trigger on input change
  useEffect(() => {
    if (focusedField !== 'start') return;
    const timer = setTimeout(() => {
      queryAutocomplete(startInput, 'start');
    }, 300);
    return () => clearTimeout(timer);
  }, [startInput, focusedField, queryAutocomplete]);

  useEffect(() => {
    if (focusedField !== 'dest') return;
    const timer = setTimeout(() => {
      queryAutocomplete(destInput, 'dest');
    }, 300);
    return () => clearTimeout(timer);
  }, [destInput, focusedField, queryAutocomplete]);



  const handleSelectSuggestion = async (suggestion, field) => {
    let coords = suggestion.coordinates;

    if (suggestion.isGoogle && suggestion.placeId) {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const results = await new Promise((resolve, reject) => {
          geocoder.geocode({ placeId: suggestion.placeId }, (results, status) => {
            if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
              resolve(results);
            } else {
              reject(new Error('Google Geocoder failed with status: ' + status));
            }
          });
        });
        if (results && results[0]) {
          const loc = results[0].geometry.location;
          coords = [loc.lng(), loc.lat()];
        }
      } catch (err) {
        console.error('Failed to geocode Google Place ID:', err);
        alert('Failed to resolve coordinates using Google Maps Geocoder. Please try again.');
        return;
      }
    }

    if (field === 'start') {
      setStartInput(suggestion.name);
      setStartLocation({
        name: suggestion.name,
        coordinates: coords
      });
      setStartSuggestions([]);
    } else {
      setDestInput(suggestion.name);
      setDestination({
        name: suggestion.name,
        coordinates: coords
      });
      setDestSuggestions([]);
    }
    setFocusedField(null);
  };


  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!destInput) return;



    // Helper geocode function
    const geocodeQuery = async (query) => {
      const trimmed = query.trim();
      const biasCoords = startLocation?.coordinates || [77.2090, 28.6139];

      // 0. Try Google Geocoder if loaded
      if (window.google && window.google.maps) {
        try {
          const geocoder = new window.google.maps.Geocoder();
          const results = await new Promise((resolve, reject) => {
            geocoder.geocode(
              {
                address: trimmed,
                bounds: new window.google.maps.LatLngBounds(
                  new window.google.maps.LatLng(biasCoords[1] - 0.5, biasCoords[0] - 0.5),
                  new window.google.maps.LatLng(biasCoords[1] + 0.5, biasCoords[0] + 0.5)
                )
              },
              (results, status) => {
                if (status === window.google.maps.GeocoderStatus.OK && results) {
                  resolve(results);
                } else {
                  reject(new Error('Google Geocode failed with status: ' + status));
                }
              }
            );
          });

          if (results && results[0]) {
            incrementApiUsage('googleMaps');
            const loc = results[0].geometry.location;
            return {
              name: results[0].formatted_address,
              coordinates: [loc.lng(), loc.lat()]
            };
          }
        } catch (err) {
          console.warn('Geocoding with Google Maps failed, falling back:', err);
        }
      }

      // 1. Try Mapbox Geocoding
      if (settings.mapboxKey) {
        try {
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?access_token=${settings.mapboxKey}&limit=1&proximity=${biasCoords[0]},${biasCoords[1]}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            incrementApiUsage('mapbox');
            return {
              name: data.features[0].place_name,
              coordinates: data.features[0].geometry.coordinates
            };
          }
        } catch (err) {
          console.warn('Geocoding with Mapbox failed:', err);
        }
      }

      // 2. Try TomTom Geocoding
      if (settings.tomtomKey) {
        try {
          const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(trimmed)}.json?key=${settings.tomtomKey}&limit=1&lat=${biasCoords[1]}&lon=${biasCoords[0]}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            incrementApiUsage('tomtom');
            return {
              name: data.results[0].address.freeformAddress,
              coordinates: [data.results[0].position.lon, data.results[0].position.lat]
            };
          }
        } catch (err) {
          console.warn('Geocoding with TomTom failed:', err);
        }
      }

      // 3. Fallback: OSM Photon
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=1&lat=${biasCoords[1]}&lon=${biasCoords[0]}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const f = data.features[0];
          const props = f.properties;
          const parts = [];
          if (props.name) parts.push(props.name);
          if (props.city && props.city !== props.name) parts.push(props.city);
          if (props.state && props.state !== props.name && props.state !== props.city) parts.push(props.state);
          if (props.country) parts.push(props.country);
          return {
            name: parts.join(', '),
            coordinates: f.geometry.coordinates
          };
        }
      } catch (err) {
        console.error('All geocoding options failed:', err);
      }

      return null;
    };

    // If start input has been changed and doesn't match startLocation, geocode it
    if (startInput && (!startLocation || startInput.toLowerCase() !== startLocation.name.toLowerCase())) {
      const startResult = await geocodeQuery(startInput);
      if (startResult) {
        setStartLocation(startResult);
      }
    }

    // If dest input has been changed and doesn't match destination, geocode it
    if (destInput && (!destination || destInput.toLowerCase() !== destination.name.toLowerCase())) {
      const destResult = await geocodeQuery(destInput);
      if (destResult) {
        setDestination(destResult);
      }
    } else if (destination) {
      // If destination is already set from selection, update it to trigger route updates in App.jsx
      setDestination({ ...destination });
    }

    if (onCollapse) onCollapse();
  };





  return (
    <>
      {/* Mobile backdrop — tapping it closes the sidebar */}
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
          // Desktop: use margin-left slide; Mobile: handled by CSS transform
          marginLeft: !isMobile ? (isSidebarOpen ? '0px' : '-420px') : undefined,
          transition: isMobile
            ? 'transform 0.32s cubic-bezier(0.4,0,0.2,1)'
            : 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
      {/* Brand Header */}
      <div style={styles.header}>
        <div style={styles.logoGroup}>
          <Navigation size={22} style={styles.logoIcon} />
          <h2 style={styles.logoText}>TrafficFlow <span style={styles.logoHighlight}>AI</span></h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={onOpenSettings} style={styles.settingsBtn} title="Settings">
            ⚙️
          </button>
          {/* Close button — only shown on mobile */}
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

      {/* User Session Profile */}
      <div style={styles.userSection}>
        <div style={{
          ...styles.avatar,
          backgroundImage: user?.user_metadata?.avatar_url ? `url(${user.user_metadata.avatar_url})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: user?.user_metadata?.avatar_url ? 'transparent' : undefined,
          border: user?.user_metadata?.avatar_url ? '2px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 0 8px var(--primary-glow)',
        }}>
          {!user?.user_metadata?.avatar_url && (user?.email ? user.email[0].toUpperCase() : 'U')}
        </div>
        <div style={styles.userInfo}>
          <span style={styles.userEmail}>
            {user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Guest Session'}
          </span>
          <span style={styles.userRole}>
            {user?.user_metadata?.full_name || user?.user_metadata?.name ? user.email : 'Premium Account'}
          </span>
        </div>
        <button onClick={onLogout} className="logout-btn" title="Sign Out">
          <LogOut size={16} />
        </button>
      </div>

      {/* Sidebar Tabs */}
      <div style={styles.tabContainer}>
        <button
          style={{
            ...styles.tab,
            borderBottomColor: activeTab === 'nav' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'nav' ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
          onClick={() => setActiveTab('nav')}
        >
          <Map size={16} />
          <span>Navigation</span>
        </button>
        <button
          style={{
            ...styles.tab,
            borderBottomColor: activeTab === 'ai' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'ai' ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
          onClick={() => setActiveTab('ai')}
        >
          <MessageSquareText size={16} />
          <span>AI Cognitive Advisor</span>
        </button>
      </div>

      {/* Tab Panel Contents */}
      <div style={styles.panelContent} className="panel-content-scroll">
        {activeTab === 'nav' ? (
          <div style={styles.navPanel}>
            {routingError && (
              <div style={{
                background: isSimulationMode ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                border: isSimulationMode ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '0.78rem',
                color: isSimulationMode ? '#f87171' : '#fbbf24',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                lineHeight: '1.4'
              }}>
                <span style={{ marginRight: '8px', fontSize: '1.1rem', marginTop: '1px', flexShrink: 0 }}>⚠️</span>
                <div>
                  <strong>{isSimulationMode ? 'Simulation Mode Active' : 'Routing API Status Warning'}</strong>
                  <div style={{ marginTop: '4px', fontSize: '0.74rem', opacity: 0.9 }}>
                    {routingError}
                  </div>
                  {(routingError.includes('Console') || routingError.includes('denied')) && (
                    <div style={{ marginTop: '8px', fontSize: '0.72rem', fontWeight: '700', textDecoration: 'underline' }}>
                      To fix: Wait 5 minutes for activation, check API key restrictions/billing in Google Console, and refresh the page.
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Search Input Form */}
            <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
              <div style={styles.searchWrapper}>
                <div style={styles.searchLine} />
                
                <div style={{ position: 'relative', zIndex: 10 }}>
                  <div style={styles.searchFieldGroup}>
                    <MapPin size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <input
                      ref={startInputRef}
                      type="text"
                      placeholder="Enter starting location..."
                      value={startInput}
                      onChange={(e) => {
                        setStartInput(e.target.value);
                        setFocusedField('start');
                      }}
                      onFocus={() => setFocusedField('start')}
                      onBlur={() => setTimeout(() => setFocusedField(null), 200)}
                      style={styles.searchInput}
                    />
                  </div>
                  {focusedField === 'start' && startSuggestions.length > 0 && (
                    <div className="suggestions-dropdown">
                      {startSuggestions.map((s, idx) => (
                        <div
                          key={idx}
                          onMouseDown={() => handleSelectSuggestion(s, 'start')}
                          className="suggestion-item"
                        >
                          <MapPin size={12} className="suggestion-icon" style={{ color: 'var(--primary)' }} />
                          <span className="suggestion-text">{s.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative', zIndex: 9 }}>
                  <div style={styles.searchFieldGroup}>
                    <Navigation size={16} style={{ color: 'var(--accent)', flexShrink: 0, transform: 'rotate(45deg)' }} />
                    <input
                      ref={destInputRef}
                      type="text"
                      placeholder="Where to?"
                      value={destInput}
                      onChange={(e) => {
                        setDestInput(e.target.value);
                        setFocusedField('dest');
                      }}
                      onFocus={() => setFocusedField('dest')}
                      onBlur={() => setTimeout(() => setFocusedField(null), 200)}
                      style={styles.searchInput}
                      required
                    />
                  </div>
                  {focusedField === 'dest' && destSuggestions.length > 0 && (
                    <div className="suggestions-dropdown">
                      {destSuggestions.map((s, idx) => (
                        <div
                          key={idx}
                          onMouseDown={() => handleSelectSuggestion(s, 'dest')}
                          className="suggestion-item"
                        >
                          <Navigation size={12} className="suggestion-icon" style={{ color: 'var(--accent)', transform: 'rotate(45deg)' }} />
                          <span className="suggestion-text">{s.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" className="glow-btn" style={styles.findRouteBtn}>
                Find Fastest Route
              </button>
            </form>



            {/* Search History */}
            <div style={styles.section}>
              <span style={styles.sectionTitle}>Recent Searches</span>
              <div style={styles.historyList}>
                {searchHistory.length === 0 ? (
                  <span style={styles.emptyText}>No recent searches.</span>
                ) : (
                  searchHistory.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        setDestInput(item.name);
                        onSelectHistory(item);
                      }}
                      style={styles.historyItem}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                        <History size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ ...styles.historyName, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveHistory(index);
                        }}
                        className="delete-bookmark-btn"
                        title="Delete Search History"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>



            {/* Alternative Routes display */}
            {((routeOptions && routeOptions.length > 0) || isRoutesLoading) && (
              <div style={styles.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={styles.sectionTitle}>
                    {isRoutesLoading ? 'Calculating Routes...' : 'Calculated Routes'}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={travelMode}
                      onChange={(e) => onTravelModeChange(e.target.value)}
                      style={styles.modeSelect}
                    >
                      <option value="car">🚗 Car</option>
                      <option value="motorbike">🏍️ Motorbike</option>
                      <option value="bicycle">🚲 Bicycle</option>
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
                        
                        let statusColor = 'var(--traffic-smooth)';
                        if (route.trafficStatus === 'moderate') statusColor = 'var(--traffic-moderate)';
                        if (route.trafficStatus === 'heavy') statusColor = 'var(--traffic-heavy)';
                        if (route.trafficStatus === 'blocked') statusColor = 'var(--traffic-blocked)';

                        return (
                          <div
                            key={idx}
                            onClick={() => onRouteSelected(idx)}
                            style={{
                              ...styles.routeCard,
                              borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)',
                              background: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                            }}
                          >
                            <div style={styles.routeHeader}>
                              <span style={styles.routeName}>{route.name}</span>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {route.isRecommended && (
                                  <span style={styles.recommendedBadge}>RECOMMENDED</span>
                                )}
                                 {isSelected && (
                                  <span style={{
                                    fontSize: '0.62rem',
                                    fontWeight: '800',
                                    color: '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    letterSpacing: '0.04em',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    <span className="pulse-dot" style={{
                                      width: '5px',
                                      height: '5px',
                                      borderRadius: '50%',
                                      backgroundColor: '#10b981',
                                      display: 'inline-block'
                                    }} />
                                    LIVE
                                  </span>
                                )}
                                <span style={{ ...styles.trafficBadge, backgroundColor: statusColor }}>
                                  {route.trafficStatus.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div style={styles.routeStats}>
                              <span style={styles.routeStatVal}>{route.duration}</span>
                              <span style={styles.routeStatSep}>•</span>
                              <span>{route.distance}</span>
                            </div>
                            {route.delayInfo && (
                              <span style={styles.delayInfo}>⚠️ {route.delayInfo}</span>
                            )}
                            {route.aiReason && (
                              <div style={{
                                marginTop: '8px',
                                fontSize: '0.74rem',
                                color: 'var(--text-secondary)',
                                backgroundColor: 'rgba(139, 92, 246, 0.08)',
                                borderLeft: '3px solid #8b5cf6',
                                padding: '6px 10px',
                                borderRadius: '4px',
                                fontWeight: '500',
                                lineHeight: '1.4'
                              }}>
                                🧠 <strong>AI Analysis:</strong> {route.aiReason}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {routeOptions.length === 1 && (
                        <div style={styles.noAlternativesText}>
                          ℹ️ No other alternative routes available.
                        </div>
                      )}

                      {routeOptions.length === 0 && (
                        <div style={styles.noAlternativesText}>
                          ⚠️ No possible routes found for this trip.
                        </div>
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
          /* AI Analyst panel loaded inside the second tab */
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border-color)',
  },
  logoGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoIcon: {
    color: 'var(--primary)',
    transform: 'rotate(45deg)',
    filter: 'drop-shadow(0 0 6px var(--primary-glow))',
  },
  logoText: {
    fontSize: '1.25rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    color: 'var(--text-primary)',
  },
  logoHighlight: {
    color: 'var(--primary)',
  },
  settingsBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '50%',
    transition: 'var(--transition-smooth)',
    '&:hover': {
      backgroundColor: 'var(--bg-tertiary)',
    },
  },
  userSection: {
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '0.95rem',
    boxShadow: '0 0 8px var(--primary-glow)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  userEmail: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userRole: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },

  tabContainer: {
    display: 'flex',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-tertiary)',
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
  },
  panelContent: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  navPanel: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  searchForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '8px 0',
  },
  searchLine: {
    position: 'absolute',
    left: '20px',
    top: '22px',
    bottom: '22px',
    width: '2px',
    borderLeft: '2px dashed var(--border-color)',
    zIndex: 1,
  },
  searchFieldGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    zIndex: 2,
  },
  searchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.85rem',
  },
  findRouteBtn: {
    width: '100%',
    padding: '11px',
    justifyContent: 'center',
    fontSize: '0.9rem',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '10px',
  },

  routesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  routeCard: {
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
  },
  routeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  routeName: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  trafficBadge: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: '#ffffff',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  recommendedBadge: {
    fontSize: '0.6rem',
    fontWeight: '800',
    color: '#ffffff',
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    padding: '2px 6px',
    borderRadius: '4px',
    boxShadow: '0 0 8px rgba(168, 85, 247, 0.4)',
    letterSpacing: '0.05em',
  },
  routeStats: {
    display: 'flex',
    gap: '8px',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  routeStatVal: {
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  routeStatSep: {
    color: 'var(--text-muted)',
  },
  delayInfo: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--traffic-heavy)',
    marginTop: '6px',
    fontWeight: '500',
  },
  shareBtn: {
    padding: '4px 10px',
    fontSize: '0.75rem',
  },

  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    '&:hover': {
      backgroundColor: 'var(--bg-tertiary)',
    },
  },
  historyName: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  emptyText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: '4px 0',
  },
  modeSelect: {
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: '0.75rem',
    fontWeight: '600',
    outline: 'none',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
  },
  startNavBtn: {
    marginTop: '10px',
    width: '100%',
    padding: '10px 0',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    color: '#fff',
    fontSize: '0.82rem',
    fontWeight: '700',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    transition: 'opacity 0.2s',
    boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
  },
  mobileCloseBtn: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171',
    borderRadius: '8px',
    padding: '5px 10px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '700',
    lineHeight: 1,
    transition: 'var(--transition-fast)',
  },
  noAlternativesText: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    padding: '12px 10px',
    border: '1px dashed rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    marginTop: '10px',
    lineHeight: '1.4',
  },
};

export default Sidebar;
