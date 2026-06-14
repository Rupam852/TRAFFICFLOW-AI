import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import ShareEtaModal from './components/ShareEtaModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [gmapsLoaded, setGmapsLoaded] = useState(false);
  
  // Settings State
  const [settings, setSettings] = useState({
    theme: localStorage.getItem('tf_theme') || 'dark',
    googleMapsKey: localStorage.getItem('tf_google_maps_key') || '',
    mapboxKey: localStorage.getItem('tf_mapbox_key') || '',
    tomtomKey: localStorage.getItem('tf_tomtom_key') || '',
    aiProvider: localStorage.getItem('tf_ai_provider') || 'gemini',
    aiKey: localStorage.getItem('tf_ai_key') || '',
  });

  // Map & Navigation States
  const [startLocation, setStartLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [pois, setPois] = useState([]);

  // Weather & Time States
  const [weather, setWeather] = useState(localStorage.getItem('tf_weather') || 'clear');
  const [timeOfDay, setTimeOfDay] = useState('day');

  // Bookmarks & Search History States
  const [bookmarks, setBookmarks] = useState([
    { name: '📍 Office (Noida Sec 62)', coordinates: [77.3898, 28.6273], address: 'Noida Sector 62, Uttar Pradesh' },
    { name: '🏠 Home (Connaught Place)', coordinates: [77.2187, 28.6299], address: 'Connaught Place, New Delhi' },
    { name: '✈️ IGI Airport (T3)', coordinates: [77.1000, 28.5562], address: 'Indira Gandhi International Airport, Delhi' },
  ]);
  const [searchHistory, setSearchHistory] = useState([
    { name: 'Cyber City, Gurugram', coordinates: [77.0878, 28.4950] },
    { name: 'India Gate, Delhi', coordinates: [77.2295, 28.6129] },
  ]);

  // Modal Toggles
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareEtaOpen, setIsShareEtaOpen] = useState(false);
  const [showWarningOnLogin, setShowWarningOnLogin] = useState(false);

  // Sync Supabase Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync theme HTML attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    localStorage.setItem('tf_theme', settings.theme);
  }, [settings.theme]);

  // Sync weather storage
  useEffect(() => {
    localStorage.setItem('tf_weather', weather);
  }, [weather]);

  // Dynamically load Google Maps script globally
  useEffect(() => {
    const oldScript = document.getElementById('google-maps-sdk');
    if (oldScript) {
      oldScript.remove();
      if (window.google) {
        delete window.google;
      }
      setGmapsLoaded(false);
    }

    const script = document.createElement('script');
    script.id = 'google-maps-sdk';
    // Load keyless by default for public usage, or use key if provided in settings
    script.src = `https://maps.googleapis.com/maps/api/js?key=${settings.googleMapsKey || ''}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setGmapsLoaded(true);
    script.onerror = () => console.error('Google Maps API failed to load.');
    document.head.appendChild(script);
  }, [settings.googleMapsKey]);

  // Retrieve user's current location via HTML5 Geolocation API on login
  useEffect(() => {
    if (!user) return;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setStartLocation({
            name: 'My Current Location',
            coordinates: [longitude, latitude]
          });
        },
        (error) => {
          console.warn('Geolocation failed, defaulting to CP, New Delhi:', error);
          setStartLocation({
            name: 'My Current Location (Delhi CP)',
            coordinates: [77.2090, 28.6139]
          });
        }
      );
    } else {
      setStartLocation({
        name: 'My Current Location (Delhi CP)',
        coordinates: [77.2090, 28.6139]
      });
    }
  }, [user]);

  const handleAuthSuccess = (authUser) => {
    setUser(authUser);
    // Show disclaimer warning banner on first login
    const hasSeenWarning = localStorage.getItem('tf_seen_warning');
    if (!hasSeenWarning) {
      setShowWarningOnLogin(true);
      localStorage.setItem('tf_seen_warning', 'true');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('tf_theme', newSettings.theme);
    localStorage.setItem('tf_google_maps_key', newSettings.googleMapsKey || '');
    localStorage.setItem('tf_mapbox_key', newSettings.mapboxKey);
    localStorage.setItem('tf_tomtom_key', newSettings.tomtomKey);
    localStorage.setItem('tf_ai_provider', newSettings.aiProvider);
    localStorage.setItem('tf_ai_key', newSettings.aiKey);
  };

  // Generate mock routes or fetch from Mapbox / TomTom APIs
  useEffect(() => {
    if (!destination) {
      setRouteOptions([]);
      return;
    }

    const fetchRoutes = async () => {
      const start = startLocation?.coordinates || [77.2090, 28.6139]; // CP New Delhi
      const end = destination.coordinates;

      // If Mapbox key is present, we try to fetch actual coordinates
      if (settings.mapboxKey) {
        try {
          const response = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&alternatives=true&access_token=${settings.mapboxKey}`
          );
          const data = await response.json();
          if (data.routes && data.routes.length > 0) {
            const routesParsed = data.routes.map((r, index) => {
              const distanceKm = (r.distance / 1000).toFixed(1) + ' km';
              const durationMin = Math.round(r.duration / 60) + ' mins';
              
              // Mocking traffic attributes based on TomTom telemetry simulation
              let traffic = 'smooth';
              let delay = '';
              if (index === 1) {
                traffic = 'moderate';
                delay = '4 mins congestion at Junction 12';
              } else if (index === 2) {
                traffic = 'heavy';
                delay = '9 mins bottleneck near central crossing';
              }

              return {
                name: index === 0 ? 'Express Highway (Fastest)' : index === 1 ? 'Alternate Ring Road' : 'Local City Streets',
                distance: distanceKm,
                duration: durationMin,
                geometry: r.geometry.coordinates,
                trafficStatus: traffic,
                delayInfo: delay
              };
            });
            setRouteOptions(routesParsed);
            setSelectedRouteIndex(0);
            return;
          }
        } catch (error) {
          console.warn('Mapbox directions API failed, using fallback telemetry simulation:', error);
        }
      }

      // Simulation mode fallback route data
      const mockRoutes = [
        {
          name: 'NH-48 Expressway (Fastest)',
          distance: '18.4 km',
          duration: '22 mins',
          geometry: [
            start,
            [start[0] + 0.05, start[1] + 0.02],
            [end[0] - 0.05, end[1] - 0.02],
            end
          ],
          trafficStatus: 'smooth',
          delayInfo: null
        },
        {
          name: 'Outer Bypass Ring Road',
          distance: '21.1 km',
          duration: '31 mins',
          geometry: [
            start,
            [start[0] + 0.02, start[1] - 0.04],
            [end[0] - 0.02, end[1] + 0.04],
            end
          ],
          trafficStatus: 'moderate',
          delayInfo: 'Minor delay at main bypass toll plaza'
        },
        {
          name: 'Subhash Marg City Link',
          distance: '15.8 km',
          duration: '45 mins',
          geometry: [
            start,
            [start[0] - 0.03, start[1] + 0.05],
            [end[0] + 0.03, end[1] - 0.05],
            end
          ],
          trafficStatus: 'heavy',
          delayInfo: 'Heavy traffic congestion due to pipeline construction'
        }
      ];

      setRouteOptions(mockRoutes);
      setSelectedRouteIndex(0);
    };

    fetchRoutes();

    // Add to search history if not duplicate
    if (destination) {
      setSearchHistory(prev => {
        if (prev.some(h => h.name.toLowerCase() === destination.name.toLowerCase())) {
          return prev;
        }
        return [{ name: destination.name, coordinates: destination.coordinates }, ...prev.slice(0, 4)];
      });
    }

  }, [startLocation, destination, settings.mapboxKey]);

  // Bookmarks Actions
  const handleAddBookmark = (newBm) => {
    setBookmarks(prev => [...prev, newBm]);
  };

  const handleSelectBookmark = (bm) => {
    setDestination({ name: bm.address, coordinates: bm.coordinates });
  };

  // Search History Action
  const handleSelectHistory = (item) => {
    setDestination({ name: item.name, coordinates: item.coordinates });
  };

  // Amenities Search Action (spawns POIs on map viewport)
  const handleAmenitiesSearch = (type) => {
    const center = startLocation?.coordinates || [77.2090, 28.6139]; // Default Delhi center
    
    // Generate 4 mock POIs near the map center
    const mockPOIs = {
      petrol: [
        { name: 'Shell Fuel Station', type: 'petrol', coordinates: [center[0] + 0.015, center[1] + 0.012] },
        { name: 'Indian Oil Plaza', type: 'petrol', coordinates: [center[0] - 0.018, center[1] - 0.005] },
        { name: 'HP Petrol Pump', type: 'petrol', coordinates: [center[0] + 0.008, center[1] - 0.022] },
      ],
      restaurant: [
        { name: 'Starbucks Coffee Drive-Thru', type: 'restaurant', coordinates: [center[0] + 0.022, center[1] + 0.002] },
        { name: 'Haldirams Express', type: 'restaurant', coordinates: [center[0] - 0.012, center[1] + 0.018] },
        { name: 'McDonalds Hub', type: 'restaurant', coordinates: [center[0] + 0.005, center[1] - 0.015] },
      ],
      hotel: [
        { name: 'Radisson Executive Suites', type: 'hotel', coordinates: [center[0] + 0.03, center[1] + 0.02] },
        { name: 'The Taj Palace Resort', type: 'hotel', coordinates: [center[0] - 0.025, center[1] - 0.018] },
      ],
      hospital: [
        { name: 'Fortis Healthcare Center', type: 'hospital', coordinates: [center[0] + 0.002, center[1] + 0.028] },
        { name: 'Apollo Emergency Clinic', type: 'hospital', coordinates: [center[0] - 0.022, center[1] + 0.005] },
      ]
    };

    setPois(mockPOIs[type] || []);
  };

  const handlePoiClick = (poi) => {
    setDestination({ name: poi.name, coordinates: poi.coordinates });
  };

  if (authLoading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner} className="spin" />
        <span style={{ marginTop: '16px', fontWeight: '600' }}>Initializing TrafficFlow AI Database...</span>
      </div>
    );
  }

  // Render Authentication screen if not signed in
  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div style={styles.appContainer}>
      
      {/* Settings Dialog Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />

      {/* Share Journey ETA Modal */}
      <ShareEtaModal
        isOpen={isShareEtaOpen}
        onClose={() => setIsShareEtaOpen(false)}
        destination={destination}
        selectedRoute={routeOptions[selectedRouteIndex]}
      />

      {/* First-Login Keys Disclaimer Alert Dialog */}
      {showWarningOnLogin && (
        <div style={styles.disclaimerBackdrop}>
          <div className="glass-panel" style={styles.disclaimerCard}>
            <span style={styles.disclaimerEmoji}>🚨</span>
            <h3 style={styles.disclaimerTitle}>API Security Warning</h3>
            <p style={styles.disclaimerText}>
              Welcome to TrafficFlow AI! Please note that this application allows you to connect your own keys for Mapbox, TomTom, and AI features. 
              <br /><br />
              <strong>The developer takes no responsibility</strong> for key usage, rates, or limits. Your keys are saved only locally in your browser's Cache and are sent directly to the services.
            </p>
            <button onClick={() => setShowWarningOnLogin(false)} className="glow-btn" style={{ marginTop: '8px' }}>
              I Understand & Agree
            </button>
          </div>
        </div>
      )}

      {/* Navigation Layout Sidebars & Interactive Map View */}
      <Sidebar
        settings={settings}
        gmapsLoaded={gmapsLoaded}
        startLocation={startLocation}
        setStartLocation={setStartLocation}
        destination={destination}
        setDestination={setDestination}
        routeOptions={routeOptions}
        selectedRouteIndex={selectedRouteIndex}
        onRouteSelected={setSelectedRouteIndex}
        bookmarks={bookmarks}
        onAddBookmark={handleAddBookmark}
        onSelectBookmark={handleSelectBookmark}
        searchHistory={searchHistory}
        onSelectHistory={handleSelectHistory}
        onAmenitiesSearch={handleAmenitiesSearch}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        user={user}
        onShareEta={() => setIsShareEtaOpen(true)}
      />

      <MapView
        settings={settings}
        gmapsLoaded={gmapsLoaded}
        startLocation={startLocation}
        destination={destination}
        routeOptions={routeOptions}
        selectedRouteIndex={selectedRouteIndex}
        onRouteSelected={setSelectedRouteIndex}
        weather={weather}
        setWeather={setWeather}
        timeOfDay={timeOfDay}
        setTimeOfDay={setTimeOfDay}
        pois={pois}
        onPoiClick={handlePoiClick}
      />

    </div>
  );
}

const styles = {
  appContainer: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'var(--bg-primary)',
  },
  loadingScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#0b0f19',
    color: '#ffffff',
    fontFamily: 'var(--font-sans)',
  },
  spinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: 'var(--primary)',
  },
  disclaimerBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(8px)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  disclaimerCard: {
    maxWidth: '440px',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '16px',
    animation: 'fadeIn 0.3s ease',
  },
  disclaimerEmoji: {
    fontSize: '2.5rem',
  },
  disclaimerTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  disclaimerText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
};
