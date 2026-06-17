import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import LandingPage from './components/LandingPage';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import ShareEtaModal from './components/ShareEtaModal';
import { Menu, X, Map } from 'lucide-react';
import { incrementApiUsage } from './utils/usage';

// Speed (km/h) per travel mode — used for mock route duration estimation
const modeSpeed = { car: 50, motorbike: 65, bicycle: 18, walk: 5 };

// Fetch helper with timeout to prevent hanging promises
const fetchWithTimeout = async (resource, options = {}) => {
  const { timeout = 5000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// Format total minutes → Google Maps style: "X days Y hr Z min", "X hr Y min" or "Z min"
const fmtDur = (totalMinutes) => {
  const mins = Math.max(1, Math.round(totalMinutes));
  const days = Math.floor(mins / 1440);
  const remainingMinsAfterDays = mins % 1440;
  const hours = Math.floor(remainingMinsAfterDays / 60);
  const remainingMins = remainingMinsAfterDays % 60;

  if (days > 0) {
    return hours > 0 ? `${days} day${days > 1 ? 's' : ''} ${hours} hr` : `${days} day${days > 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return remainingMins > 0 ? `${hours} hr ${remainingMins} min` : `${hours} hr`;
  }
  return `${remainingMins} min`;
};

// Generate dynamic interpolated mock routes as fallback with realistic winding curves
const generateDynamicMockRoutes = (start, end, travelMode) => {
  const dLng = end[0] - start[0];
  const dLat = end[1] - start[1];
  const distDegrees = Math.sqrt(dLng * dLng + dLat * dLat);

  // Approximate distance in km (1 degree ≈ 111 km)
  const distKm = parseFloat((distDegrees * 111 * 1.25).toFixed(1));

  // Speed per mode; alternate routes are slower
  const baseSpeed  = modeSpeed[travelMode] || 50;
  const dur1 = Math.max(1, (distKm / baseSpeed) * 60);                  // express
  const dur2 = Math.max(1, (distKm * 1.2) / (baseSpeed * 0.85) * 60);  // bypass
  const dur3 = Math.max(1, (distKm * 0.95) / (baseSpeed * 0.65) * 60); // city streets

  // Helper to generate a realistic winding curve between start and end
  const generateCurvedPath = (p0, p2, offsetDirection = 0) => {
    const points = [];
    const distDegrees = Math.sqrt(dLng * dLng + dLat * dLat);
    
    // Scale steps and frequency for longer distances to maintain resolution
    const steps = distDegrees > 0.5 ? 60 : 30;
    const frequency = distDegrees > 0.5 ? 12 : 6;
    
    const perpLng = -dLat;
    const perpLat = dLng;
    
    const offsetFactor = 0.18 * offsetDirection;
    const p1 = [
      p0[0] + dLng * 0.5 + perpLng * offsetFactor,
      p0[1] + dLat * 0.5 + perpLat * offsetFactor
    ];
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const tt = t * t;
      const uu = u * u;
      
      const lng = uu * p0[0] + 2 * u * t * p1[0] + tt * p2[0];
      const lat = uu * p0[1] + 2 * u * t * p1[1] + tt * p2[1];
      
      // Scale amplitude based on distance to make winding routes visible on all scales
      const baseAmplitude = Math.max(0.006, distDegrees * 0.05);
      const currentAmplitude = baseAmplitude * Math.sin(t * Math.PI); // zero offset at exactly start & end
      const waveLng = currentAmplitude * Math.sin(t * Math.PI * frequency);
      const waveLat = currentAmplitude * Math.cos(t * Math.PI * frequency);
      
      points.push([lng + waveLng, lat + waveLat]);
    }
    return points;
  };

  const route1Geom = generateCurvedPath(start, end, 0.05);  // slightly curved
  const route2Geom = generateCurvedPath(start, end, 0.35);  // curved outer route
  const route3Geom = generateCurvedPath(start, end, -0.25); // curved inner route

  return [
    {
      name: 'Fastest Route (Best Recommended)',
      distance: distKm.toFixed(1) + ' km',
      duration: fmtDur(dur1),
      geometry: route1Geom,
      trafficStatus: 'smooth',
      delayInfo: null,
      isRecommended: true
    },
    {
      name: 'Alternative Route',
      distance: (distKm * 1.2).toFixed(1) + ' km',
      duration: fmtDur(dur2),
      geometry: route2Geom,
      trafficStatus: 'moderate',
      delayInfo: 'Moderate traffic expected',
      isRecommended: false
    },
    {
      name: 'Via City Roads',
      distance: (distKm * 0.95).toFixed(1) + ' km',
      duration: fmtDur(dur3),
      geometry: route3Geom,
      trafficStatus: 'heavy',
      delayInfo: 'Heavy urban traffic',
      isRecommended: false
    }
  ];
};

// Apply TomTom live traffic data to calculated routes immediately
const applyTomTomTrafficToRoutes = async (routes, tomtomKey, travelMode) => {
  if (!tomtomKey || !routes || routes.length === 0) return routes;
  if (travelMode === 'walk' || travelMode === 'bicycle') return routes;

  try {
    const updatedRoutes = await Promise.all(
      routes.map(async (route) => {
        const geom = route.geometry;
        if (!geom || geom.length < 2) return route;

        try {
          const midIdx = Math.floor(geom.length * 0.5);
          const pt = geom[midIdx];
          if (!pt) return route;

          const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${tomtomKey}&point=${pt[1]},${pt[0]}`;
          const res = await fetchWithTimeout(url, { timeout: 3500 });
          if (res.ok) {
            const data = await res.json();
            if (data.flowSegmentData) {
              const current = data.flowSegmentData.currentSpeed;
              const freeFlow = data.flowSegmentData.freeFlowSpeed;
              const travelTime = data.flowSegmentData.currentTravelTime;
              const freeFlowTime = data.flowSegmentData.freeFlowTravelTime;
              const delaySec = Math.max(0, (travelTime || 0) - (freeFlowTime || 0));

              let newStatus = route.trafficStatus || 'smooth';
              let newDelayInfo = route.delayInfo || null;
              let trafficFactor = 1.0;

              if (freeFlow > 0) {
                const ratio = current / freeFlow;
                if (ratio >= 0.85) {
                  newStatus = 'smooth';
                  trafficFactor = 1.0;
                  newDelayInfo = null;
                } else if (ratio >= 0.55) {
                  newStatus = 'moderate';
                  trafficFactor = 1.25;
                  newDelayInfo = delaySec > 0 ? `${Math.round(delaySec / 60)} min traffic delay` : 'Moderate traffic congestion';
                } else if (ratio >= 0.25) {
                  newStatus = 'heavy';
                  trafficFactor = 1.6;
                  newDelayInfo = delaySec > 0 ? `Heavy delay: +${Math.round(delaySec / 60)} min` : 'Heavy traffic congestion';
                } else {
                  newStatus = 'blocked';
                  trafficFactor = 2.5;
                  newDelayInfo = 'Road highly congested or blocked';
                }

                // Parse base distance (e.g. "12.4 km")
                const distKm = parseFloat(route.distance.replace(/[^\d.]/g, ''));
                if (!isNaN(distKm)) {
                  const baseSpeed = modeSpeed[travelMode] || 50;
                  const newMins = (distKm / baseSpeed) * 60 * trafficFactor;
                  return {
                    ...route,
                    trafficStatus: newStatus,
                    delayInfo: newDelayInfo,
                    duration: fmtDur(newMins)
                  };
                }
              }
            }
          }
        } catch (err) {
          console.warn('Failed to fetch TomTom live traffic segment:', err);
        }
        return route;
      })
    );
    return updatedRoutes;
  } catch (globalErr) {
    console.warn('Global error applying TomTom traffic to routes:', globalErr);
    return routes;
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSyncingSettings, setIsSyncingSettings] = useState(false);
  const [authMode, setAuthMode] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('page') || 'landing';
  });
  // Ref to track authMode inside event listeners without stale closure issues
  const authModeRef = useRef(authMode);
  const [gmapsLoaded, setGmapsLoaded] = useState(false);
  const [isGmapsAuthError, setIsGmapsAuthError] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth > 640);
  const [dismissedKeySetup, setDismissedKeySetup] = useState(false);
  
  // Settings State
  const [settings, setSettings] = useState({
    theme: localStorage.getItem('tf_theme') || 'dark',
    googleMapsKey: '',
    mapboxKey: '',
    tomtomKey: '',
    openWeatherKey: '',
    aiProvider: 'gemini',
    aiKey: '',
  });

  // Map & Navigation States
  const [startLocation, setStartLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [pois, setPois] = useState([]);
  const [mapCenter, setMapCenter] = useState([77.2090, 28.6139]);
  const [activeAmenitySearch, setActiveAmenitySearch] = useState(null);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [routingError, setRoutingError] = useState(null);
  const [activeRoutingEngine, setActiveRoutingEngine] = useState(null); // 'mapbox' | 'osrm' | 'simulation'
  const [isRoutesLoading, setIsRoutesLoading] = useState(false);
  const [isRouteSwitching, setIsRouteSwitching] = useState(false);

  // Weather & Time States
  const [weather, setWeather] = useState(localStorage.getItem('tf_weather') || 'clear');
  const [timeOfDay, setTimeOfDay] = useState('day');
  const [travelMode, setTravelMode] = useState('car'); // 'car' | 'motorbike' | 'bicycle' | 'walk'

  // Live GPS tracking states (marker position & orientation)
  const [navMarkerPos, setNavMarkerPos] = useState(null); // [lng, lat] of moving navigator dot
  const [navMarkerBearing, setNavMarkerBearing] = useState(null); // heading angle in degrees (0-360)

  const [showArrivalToast, setShowArrivalToast] = useState(false); // controls arrival toast visibility
  const lastSearchedDestNameRef = useRef(null);

  // Refs and states for route navigation simulation
  const [isRouteSimulationActive, setIsRouteSimulationActive] = useState(false);
  const isRouteSimulationActiveRef = useRef(false);
  const navMarkerPosRef = useRef(null);
  const simulationIntervalRef = useRef(null);

  // Keep refs synchronized to prevent stale closures in watchPosition and fetchEffects
  useEffect(() => {
    isRouteSimulationActiveRef.current = isRouteSimulationActive;
  }, [isRouteSimulationActive]);

  useEffect(() => {
    navMarkerPosRef.current = navMarkerPos;
  }, [navMarkerPos]);



  const [searchHistory, setSearchHistory] = useState([]);

  // Modal Toggles
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareEtaOpen, setIsShareEtaOpen] = useState(false);
  const [showWarningOnLogin, setShowWarningOnLogin] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Lifted UI overlay states
  const [isWeatherPanelOpen, setIsWeatherPanelOpen] = useState(false);
  const [sidebarActiveTab, setSidebarActiveTab] = useState('nav');

  const sidebarRef = useRef(null);

  // Ref to track dashboard state in the popstate listener without stale closure issues
  const dashboardStateRef = useRef({});
  useEffect(() => {
    dashboardStateRef.current = {
      isSettingsOpen,
      isGmapsAuthError,
      isShareEtaOpen,
      showLogoutConfirm,
      showWarningOnLogin,
      dismissedKeySetup,
      isSyncingSettings,
      settings,
      isWeatherPanelOpen,
      isSidebarOpen,
      sidebarActiveTab,
      isRouteSimulationActive,
      activeAmenitySearch,
      pois,
      destination,
      showExitConfirm,
    };
  }, [
    isSettingsOpen,
    isGmapsAuthError,
    isShareEtaOpen,
    showLogoutConfirm,
    showWarningOnLogin,
    dismissedKeySetup,
    isSyncingSettings,
    settings,
    isWeatherPanelOpen,
    isSidebarOpen,
    sidebarActiveTab,
    isRouteSimulationActive,
    activeAmenitySearch,
    pois,
    destination,
    showExitConfirm,
  ]);

  // Synchronize authMode view with URL query parameters for browser navigation support
  useEffect(() => {
    const handlePopState = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const page = searchParams.get('page') || 'landing';
      setAuthMode(page);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync Supabase Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const sessionUser = session?.user ?? null;
      setUser(prev => (prev?.id === sessionUser?.id ? prev : sessionUser));
      setAuthLoading(false);
      
      // Clean up trailing # or oauth tokens from URL hash once session is parsed
      if (window.location.href.includes('#')) {
        setTimeout(() => {
          const cleanUrl = window.location.href.split('#')[0];
          window.history.replaceState(null, '', cleanUrl);
        }, 100);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(prev => (prev?.id === sessionUser?.id ? prev : sessionUser));
      setAuthLoading(false);
      if (!session) {
        const searchParams = new URLSearchParams(window.location.search);
        const page = searchParams.get('page');
        if (page === 'login' || page === 'signup') {
          setAuthMode(page);
        } else {
          setAuthMode('landing');
        }
      } else {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.has('page')) {
          const cleanUrl = window.location.pathname;
          window.history.replaceState(null, '', cleanUrl);
        }
      }
      
      // Clean up URL hash after successful sign in / redirect state change
      if (window.location.href.includes('#')) {
        setTimeout(() => {
          const cleanUrl = window.location.href.split('#')[0];
          window.history.replaceState(null, '', cleanUrl);
        }, 100);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync user database state on auth state changes
  useEffect(() => {
    setTimeout(() => setDismissedKeySetup(false), 0);
    if (!user) {
      setTimeout(() => {
        setSearchHistory([]);
        setSettings({
          theme: localStorage.getItem('tf_theme') || 'dark',
          googleMapsKey: '',
          mapboxKey: '',
          tomtomKey: '',
          openWeatherKey: '',
          aiProvider: 'gemini',
          aiKey: '',
        });
      }, 0);
      return;
    }

    const fetchUserData = async () => {
      setIsSyncingSettings(true);
      try {
        // 1. Fetch user settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (settingsError && settingsError.code !== 'PGRST116') {
          console.error('Error fetching settings:', settingsError);
        } else if (settingsData) {
          const loadedSettings = {
            theme: settingsData.theme || 'dark',
            googleMapsKey: (settingsData.google_maps_key || '').trim(),
            mapboxKey: (settingsData.mapbox_key || '').trim(),
            tomtomKey: (settingsData.tomtom_key || '').trim(),
            openWeatherKey: (settingsData.open_weather_key || '').trim(),
            aiProvider: settingsData.ai_provider || 'gemini',
            aiKey: (settingsData.ai_key || '').trim(),
          };
          setSettings(loadedSettings);
          localStorage.setItem('tf_theme', loadedSettings.theme);
        } else {
          // No settings found, create new default settings row in Supabase
          // We initialize with empty keys for the new user session
          const defaultSettings = {
            user_id: user.id,
            theme: localStorage.getItem('tf_theme') || 'dark',
            google_maps_key: '',
            mapbox_key: '',
            tomtom_key: '',
            open_weather_key: '',
            ai_provider: 'gemini',
            ai_key: '',
          };
          await supabase.from('user_settings').insert([defaultSettings]);
          
          setSettings({
            theme: defaultSettings.theme,
            googleMapsKey: '',
            mapboxKey: '',
            tomtomKey: '',
            openWeatherKey: '',
            aiProvider: 'gemini',
            aiKey: '',
          });
        }

        // 2. Fetch search history
        const { data: historyData, error: historyError } = await supabase
          .from('search_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (historyError) {
          console.error('Error fetching search history:', historyError);
        } else if (historyData && historyData.length > 0) {
          const parsedHistory = historyData.map(h => ({
            id: h.id,
            name: h.name,
            coordinates: Array.isArray(h.coordinates) ? h.coordinates : JSON.parse(h.coordinates)
          }));
          setSearchHistory(parsedHistory);
        } else {
          setSearchHistory([]);
        }
      } catch (err) {
        console.error('Failed to sync data with Supabase:', err);
      } finally {
        setIsSyncingSettings(false);
      }
    };

    fetchUserData();
  }, [user]);

  // Sync theme HTML attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    localStorage.setItem('tf_theme', settings.theme);

    // Ensure proper mobile viewport scaling
    let vp = document.querySelector('meta[name="viewport"]');
    if (!vp) {
      vp = document.createElement('meta');
      vp.name = 'viewport';
      document.head.appendChild(vp);
    }
    vp.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  }, [settings.theme]);

  // Keep authModeRef in sync (used by popstate listener to avoid stale closures)
  useEffect(() => {
    authModeRef.current = authMode;
  }, [authMode]);

  // Intercept browser back button on the main dashboard (when user is logged in)
  // and close open components in a layered, priority-based order instead of navigating away
  useEffect(() => {
    if (!user) return; // Only active when logged in

    // Push a sentinel state so there's something to pop back to
    window.history.pushState({ dashboard: true }, '');

    const handleDashboardPopState = () => {
      const {
        isSettingsOpen,
        isGmapsAuthError,
        isShareEtaOpen,
        showLogoutConfirm,
        showWarningOnLogin,
        dismissedKeySetup,
        isSyncingSettings,
        settings,
        isWeatherPanelOpen,
        isSidebarOpen,
        sidebarActiveTab,
        isRouteSimulationActive,
        activeAmenitySearch,
        pois,
        destination,
        showExitConfirm,
      } = dashboardStateRef.current;

      // 1. Settings Modal
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 1b. Google Maps Auth Error Modal
      if (isGmapsAuthError) {
        setIsGmapsAuthError(false);
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 2. Share ETA Modal
      if (isShareEtaOpen) {
        setIsShareEtaOpen(false);
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 3. Logout Confirmation Modal
      if (showLogoutConfirm) {
        setShowLogoutConfirm(false);
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 3. First-Login Warning
      if (showWarningOnLogin) {
        setShowWarningOnLogin(false);
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 4. API Key setup card (if showing and not dismissed)
      const isKeySetupVisible = (!settings.googleMapsKey || !settings.mapboxKey) && !showWarningOnLogin && !dismissedKeySetup && !isSyncingSettings;
      if (isKeySetupVisible) {
        setDismissedKeySetup(true);
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 5. Climate Engine / Weather Panel
      if (isWeatherPanelOpen) {
        setIsWeatherPanelOpen(false);
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 6. Sidebar suggestions or focused field
      if (sidebarRef.current && sidebarRef.current.closePopups()) {
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 7. Sidebar drawer on mobile
      if (window.innerWidth <= 640 && isSidebarOpen) {
        setIsSidebarOpen(false);
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 8. Sidebar active tab (if 'ai', switch back to 'nav')
      if (sidebarActiveTab === 'ai') {
        setSidebarActiveTab('nav');
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 9. Active Route Simulation
      if (isRouteSimulationActive) {
        stopRouteSimulation();
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 10. Active Amenity / POIs on Map
      if (activeAmenitySearch || (pois && pois.length > 0)) {
        setActiveAmenitySearch(null);
        setPois([]);
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 11. Destination selected (Viewing route details)
      if (destination) {
        setDestination(null);
        setStartLocation(null);
        setRouteOptions([]);
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 12. If exit confirm is already open, back button should close it
      if (showExitConfirm) {
        setShowExitConfirm(false);
        window.history.pushState({ dashboard: true }, '');
        return;
      }

      // 13. Otherwise, show the Exit confirmation modal
      window.history.pushState({ dashboard: true }, '');
      setShowExitConfirm(true);
    };

    window.addEventListener('popstate', handleDashboardPopState);
    return () => window.removeEventListener('popstate', handleDashboardPopState);
  }, [user]);

  // Sync weather storage
  useEffect(() => {
    localStorage.setItem('tf_weather', weather);
  }, [weather]);

  // Dynamic scrollbar visibility during scroll
  useEffect(() => {
    const scrollTimeouts = new WeakMap();

    const handleScroll = (e) => {
      let target = e.target;
      if (target === document) {
        target = document.documentElement;
      }
      if (!(target instanceof HTMLElement)) return;

      target.classList.add('is-scrolling');

      const existingTimeout = scrollTimeouts.get(target);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeoutId = setTimeout(() => {
        target.classList.remove('is-scrolling');
        scrollTimeouts.delete(target);
      }, 800); // Hide smoothly after 800ms of no scrolling

      scrollTimeouts.set(target, timeoutId);
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  // Dynamically control body overflow (scrollability) based on route/session
  useEffect(() => {
    if (!user && authMode === 'landing') {
      document.body.style.overflow = 'auto';
    } else {
      document.body.style.overflow = 'hidden';
      window.scrollTo(0, 0);
    }
    return () => {
      document.body.style.overflow = 'hidden';
    };
  }, [user, authMode]);

  // Dynamically load Google Maps script globally
  useEffect(() => {
    // Wait until both auth state has initialized and user settings have synced from Supabase
    if (authLoading || isSyncingSettings) return;

    // Register Google Maps authentication failure handler
    window.gm_authFailure = () => {
      console.error('Google Maps API Authentication Failed.');
      setIsGmapsAuthError(true);
    };

    const oldScript = document.getElementById('google-maps-sdk');
    if (oldScript) {
      oldScript.remove();
      if (window.google) {
        delete window.google;
      }
      setTimeout(() => setGmapsLoaded(false), 0);
    }

    const script = document.createElement('script');
    script.id = 'google-maps-sdk';
    // Load keyless by default for public usage, or use key if provided in settings
    script.src = `https://maps.googleapis.com/maps/api/js?key=${settings.googleMapsKey || ''}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => setGmapsLoaded(true);
    script.onerror = () => console.error('Google Maps API failed to load.');
    document.head.appendChild(script);

    return () => {
      window.gm_authFailure = null;
    };
  }, [settings.googleMapsKey, authLoading, isSyncingSettings]);

  // Retrieve user's current location via HTML5 Geolocation API on mount
  useEffect(() => {
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
      setTimeout(() => {
        setStartLocation({
          name: 'My Current Location (Delhi CP)',
          coordinates: [77.2090, 28.6139]
        });
      }, 0);
    }
  }, []);

  // Haversine distance in metres between two [lng, lat] points
  const haversineMetres = (a, b) => {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  // Live GPS tracking watcher to move the navigator dot and follow user's position
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        // If simulation is running, ignore physical GPS updates
        if (isRouteSimulationActiveRef.current) return;

        const { longitude, latitude, heading } = pos.coords;
        setNavMarkerPos([longitude, latitude]);
        if (heading !== null && heading !== undefined) {
          setNavMarkerBearing(heading);
        }
      },
      (err) => console.warn('GPS watch error:', err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Arrival detection effect: runs whenever navMarkerPos or destination changes
  useEffect(() => {
    if (navMarkerPos && destination?.coordinates) {
      const dist = haversineMetres(navMarkerPos, destination.coordinates);
      if (dist <= 300) {
        setTimeout(() => {
          setShowArrivalToast(prev => {
            if (!prev) {
              // Auto dismiss toast after 7 seconds
              setTimeout(() => setShowArrivalToast(false), 7000);
              return true;
            }
            return prev;
          });
        }, 0);
      }
    }
  }, [navMarkerPos, destination]);

  const handleAuthSuccess = (authUser) => {
    setUser(authUser);
    // Show disclaimer warning banner on first login
    const hasSeenWarning = localStorage.getItem('tf_seen_warning');
    if (!hasSeenWarning) {
      setShowWarningOnLogin(true);
      localStorage.setItem('tf_seen_warning', 'true');
    }
  };

  const handleNavigate = (mode, replace = false) => {
    setAuthMode(mode);
    const searchParams = new URLSearchParams(window.location.search);
    if (mode === 'landing') {
      searchParams.delete('page');
    } else {
      searchParams.set('page', mode);
    }
    const newSearch = searchParams.toString();
    const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;
    
    const currentPage = new URLSearchParams(window.location.search).get('page') || 'landing';
    if (currentPage !== mode) {
      if (replace) {
        window.history.replaceState({ authMode: mode }, '', newUrl);
      } else {
        window.history.pushState({ authMode: mode }, '', newUrl);
      }
    }
  };

  const handleBackToLanding = () => {
    if (window.history.state && window.history.state.authMode) {
      window.history.back();
    } else {
      handleNavigate('landing', true);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await supabase.auth.signOut();
    setUser(null);
    handleNavigate('landing');
  };

  const handleSaveSettings = async (newSettings) => {
    const trimmedSettings = {
      theme: newSettings.theme,
      googleMapsKey: (newSettings.googleMapsKey || '').trim(),
      mapboxKey: (newSettings.mapboxKey || '').trim(),
      tomtomKey: (newSettings.tomtomKey || '').trim(),
      openWeatherKey: (newSettings.openWeatherKey || '').trim(),
      aiProvider: newSettings.aiProvider,
      aiKey: (newSettings.aiKey || '').trim(),
    };

    setSettings(trimmedSettings);
    setIsGmapsAuthError(false);
    localStorage.setItem('tf_theme', trimmedSettings.theme);

    if (user) {
      try {
        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            theme: trimmedSettings.theme,
            google_maps_key: trimmedSettings.googleMapsKey,
            mapbox_key: trimmedSettings.mapboxKey,
            tomtom_key: trimmedSettings.tomtomKey,
            open_weather_key: trimmedSettings.openWeatherKey,
            ai_provider: trimmedSettings.aiProvider,
            ai_key: trimmedSettings.aiKey,
            updated_at: new Date().toISOString(),
          });
        if (error) console.error('Error saving settings to Supabase:', error);
      } catch (err) {
        console.error('Failed to save settings to Supabase:', err);
      }
    }
  };

  // Fetch live weather dynamically if OpenWeatherMap API key is present
  useEffect(() => {
    if (!settings.openWeatherKey) return;
    
    // We fetch weather at the starting location coordinates
    const coords = startLocation?.coordinates || [77.2090, 28.6139]; // Default Delhi CP
    const [lng, lat] = coords;
    
    const fetchLiveWeather = async () => {
      try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${settings.openWeatherKey}&units=metric`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather API request failed');
        
        incrementApiUsage('openWeather');
        
        const data = await res.json();
        
        if (data.weather && data.weather[0]) {
          const main = data.weather[0].main.toLowerCase();
          const desc = data.weather[0].description.toLowerCase();
          
          // Map to app weather states: 'clear' | 'rain' | 'fog'
          if (main.includes('rain') || main.includes('drizzle') || main.includes('thunderstorm') || desc.includes('rain')) {
            setWeather('rain');
          } else if (main.includes('fog') || main.includes('mist') || main.includes('haze') || main.includes('smoke') || desc.includes('fog') || desc.includes('haze')) {
            setWeather('fog');
          } else {
            setWeather('clear');
          }
          
          // Map to Day-Night Cycle using data.dt, data.sys.sunrise, data.sys.sunset
          const dt = data.dt;
          const sunrise = data.sys.sunrise;
          const sunset = data.sys.sunset;
          
          if (dt && sunrise && sunset) {
            const sunriseDiff = Math.abs(dt - sunrise);
            const sunsetDiff = Math.abs(dt - sunset);
            
            if (sunriseDiff < 3600) { // Within 1 hour of sunrise
              setTimeOfDay('sunrise');
            } else if (sunsetDiff < 3600) { // Within 1 hour of sunset
              setTimeOfDay('sunset');
            } else if (dt > sunrise && dt < sunset) {
              setTimeOfDay('day');
            } else {
              setTimeOfDay('night');
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch live weather data:', err);
      }
    };

    fetchLiveWeather();
    
    // Refresh weather every 10 minutes
    const interval = setInterval(fetchLiveWeather, 600000);
    return () => clearInterval(interval);
  }, [startLocation, settings.openWeatherKey]);



  // Generate routes using Mapbox, or dynamic fallback
  useEffect(() => {
    if (!destination) {
      setTimeout(() => setRouteOptions([]), 0);
      return;
    }

    const fetchRoutes = async () => {
      setIsRoutesLoading(true);
      try {
        let start = startLocation?.coordinates || [77.2090, 28.6139]; // CP New Delhi
      let mapboxErrorMsg = null;

      // If start is "My Current Location", use the latest tracked GPS coordinates if available
      if (startLocation?.name === 'My Current Location' || startLocation?.name?.startsWith('My Current Location')) {
        if (navMarkerPosRef.current) {
          start = navMarkerPosRef.current;
        } else {
          try {
            const freshPos = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: true });
            });
            start = [freshPos.coords.longitude, freshPos.coords.latitude];
          } catch (err) {
            console.warn('Could not fetch fresh GPS coordinates for routing:', err);
          }
        }
      }

      const end = destination.coordinates;

      /**
       * Ensure the route polyline starts exactly at `start` and ends exactly at `end`.
       * OSRM / Mapbox snap to the nearest road which can leave a visible gap between
       * the drawn line and the placed marker pin.
       */
      const pinRoute = (coords) => {
        if (!coords || coords.length === 0) return [start, end];
        const result = [...coords];
        // Prepend exact start if the first point is further than ~10 m away
        const firstPt = result[0];
        const dFirst = Math.abs(firstPt[0] - start[0]) + Math.abs(firstPt[1] - start[1]);
        if (dFirst > 0.00009) result.unshift([start[0], start[1]]);
        // Append exact end if the last point is further than ~10 m away
        const lastPt = result[result.length - 1];
        const dLast = Math.abs(lastPt[0] - end[0]) + Math.abs(lastPt[1] - end[1]);
        if (dLast > 0.00009) result.push([end[0], end[1]]);
        return result;
      };

      // Helper to fetch a real road route geometry from OSRM (with retry/fallback and timeout)
      const fetchOSRMRouteGeometry = async (offsetDirection = 0, trafficMultiplier = 1) => {
        let osrmProfile = 'driving';
        if (travelMode === 'bicycle') osrmProfile = 'bicycle';
        if (travelMode === 'walk') osrmProfile = 'foot';

        // Prepare waypoints
        let coordsPath = `${start[0]},${start[1]}`;
        if (offsetDirection !== 0) {
          const dLng = end[0] - start[0];
          const dLat = end[1] - start[1];
          const distance = Math.sqrt(dLng * dLng + dLat * dLat);
          if (distance < 0.005) return null;

          const offsetFactor = 0.15 * offsetDirection;
          const midLng = start[0] + dLng * 0.5 - dLat * offsetFactor;
          const midLat = start[1] + dLat * 0.5 + dLng * offsetFactor;
          coordsPath += `;${midLng},${midLat}`;
        }
        coordsPath += `;${end[0]},${end[1]}`;

        // Attempt primary, then fallback
        const servers = [
          `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordsPath}?geometries=geojson&overview=full`,
          `https://routing.openstreetmap.de/${travelMode === 'bicycle' ? 'routed-bike' : travelMode === 'walk' ? 'routed-foot' : 'routed-car'}/route/v1/${osrmProfile}/${coordsPath}?geometries=geojson&overview=full`
        ];

        for (const url of servers) {
          try {
            const res = await fetchWithTimeout(url, { timeout: 5000 });
            if (!res.ok) continue;
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes[0]) {
              const distKm = data.routes[0].distance / 1000;
              const baseSpeed = modeSpeed[travelMode] || 50;
              const calculatedMin = (distKm / baseSpeed) * 60 * trafficMultiplier;
              return {
                geometry: pinRoute(data.routes[0].geometry.coordinates),
                distance: distKm.toFixed(1) + ' km',
                duration: fmtDur(calculatedMin),
              };
            }
          } catch (e) {
            console.warn(`OSRM call failed on ${url}:`, e);
          }
        }
        return null;
      };

      // Helper to fill missing alternative routes with real roads from OSRM
      // Falls back to guaranteed-distinct mock geometry if OSRM returns null
      const supplementWithRealRoads = async (routesList) => {
        let finalRoutes = [...routesList];
        // Pre-generate mock routes as geometry fallbacks (always distinct curves)
        const mockFallbacks = generateDynamicMockRoutes(start, end, travelMode);

        if (finalRoutes.length === 0) {
          return mockFallbacks;
        }

        if (finalRoutes.length === 1) {
          // Route 2: Try OSRM, fallback to mock curve (offset +0.35)
          const geom1 = await fetchOSRMRouteGeometry(1, 1.2);
          finalRoutes.push({
            name: 'Alternative Route',
            distance: geom1?.distance ?? mockFallbacks[1].distance,
            duration: geom1?.duration ?? mockFallbacks[1].duration,
            geometry: geom1?.geometry ?? mockFallbacks[1].geometry,
            trafficStatus: 'moderate',
            delayInfo: 'Moderate traffic expected',
            isRecommended: false
          });

          // Route 3: Try OSRM, fallback to mock curve (offset -0.25)
          const geom2 = await fetchOSRMRouteGeometry(-1, 1.4);
          finalRoutes.push({
            name: 'Via City Roads',
            distance: geom2?.distance ?? mockFallbacks[2].distance,
            duration: geom2?.duration ?? mockFallbacks[2].duration,
            geometry: geom2?.geometry ?? mockFallbacks[2].geometry,
            trafficStatus: 'heavy',
            delayInfo: 'Heavy urban traffic',
            isRecommended: false
          });
        } else if (finalRoutes.length === 2) {
          // Route 3: Try OSRM, fallback to mock curve
          const geom1 = await fetchOSRMRouteGeometry(1, 1.4);
          finalRoutes.push({
            name: 'Via City Roads',
            distance: geom1?.distance ?? mockFallbacks[2].distance,
            duration: geom1?.duration ?? mockFallbacks[2].duration,
            geometry: geom1?.geometry ?? mockFallbacks[2].geometry,
            trafficStatus: 'heavy',
            delayInfo: 'Heavy urban traffic',
            isRecommended: false
          });
        }

        return finalRoutes;
      };

      // 1. Try Mapbox Directions API if Mapbox key is present (Primary routing engine)
      if (settings.mapboxKey) {
        try {
          let mapboxProfile = 'mapbox/driving';
          if (travelMode === 'bicycle') mapboxProfile = 'mapbox/cycling';
          if (travelMode === 'walk') mapboxProfile = 'mapbox/walking';

          const response = await fetch(
            `https://api.mapbox.com/directions/v5/${mapboxProfile}/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&overview=full&alternatives=true&access_token=${settings.mapboxKey}`
          );
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || `HTTP error ${response.status}`);
          }
          if (data.routes && data.routes.length > 0) {
            incrementApiUsage('mapbox');
            const routesParsed = data.routes.map((r, index) => {
              const distanceKm = (r.distance / 1000).toFixed(1) + ' km';
              
              const rawDuration = r.duration;
              const adjustedDuration = travelMode === 'motorbike' ? rawDuration * 0.8 : rawDuration;
              const durationMin = fmtDur(adjustedDuration / 60);
              
              let traffic = 'smooth';
              let delay = '';
              if (index === 1) {
                traffic = 'moderate';
                delay = '4 min congestion expected';
              } else if (index === 2) {
                traffic = 'heavy';
                delay = 'Heavy urban traffic';
              }

              const routeLabels = ['Fastest Route (Best Recommended)', 'Alternative Route', 'Via City Roads'];
              const routeName = routeLabels[index] || `Route ${index + 1}`;

              // Validate route geometry has enough points if it covers more than 500m
              const dLng = end[0] - start[0];
              const dLat = end[1] - start[1];
              const distDegrees = Math.sqrt(dLng * dLng + dLat * dLat);
              if (distDegrees > 0.005 && (!r.geometry || !r.geometry.coordinates || r.geometry.coordinates.length < 5)) {
                throw new Error('Incomplete straight line route segment returned by Mapbox');
              }

              return {
                name: routeName,
                distance: distanceKm,
                duration: durationMin,
                geometry: pinRoute(r.geometry.coordinates),
                trafficStatus: traffic,
                delayInfo: delay,
                isRecommended: index === 0
              };
            });

            // Supplement routes using real roads if less than 3
            let finalRoutes = await supplementWithRealRoads(routesParsed);

            // Fetch live TomTom traffic for the routes immediately if key is configured
            if (settings.tomtomKey) {
              finalRoutes = await applyTomTomTrafficToRoutes(finalRoutes, settings.tomtomKey, travelMode);
            }

            setIsSimulationMode(false);
            setRoutingError(null);
            setActiveRoutingEngine('mapbox');
            setRouteOptions(finalRoutes);
            setSelectedRouteIndex(0);
            return;
          }
        } catch (error) {
          console.warn('Mapbox directions API failed, using fallback OSRM:', error);
          mapboxErrorMsg = error.message || 'Unknown Mapbox error';
        }
      } else {
        mapboxErrorMsg = 'Mapbox access token is not configured in settings.';
      }

      // 2. Try free OSRM (Open Source Routing Machine) API as a high-quality fallback (with retry & timeout)
      try {
        let osrmProfile = 'driving';
        if (travelMode === 'bicycle') osrmProfile = 'bicycle';
        if (travelMode === 'walk') osrmProfile = 'foot';

        const coordsPath = `${start[0]},${start[1]};${end[0]},${end[1]}`;
        const servers = [
          `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordsPath}?geometries=geojson&overview=full&alternatives=true`,
          `https://routing.openstreetmap.de/${travelMode === 'bicycle' ? 'routed-bike' : travelMode === 'walk' ? 'routed-foot' : 'routed-car'}/route/v1/${osrmProfile}/${coordsPath}?geometries=geojson&overview=full&alternatives=true`
        ];

        let data = null;
        for (const url of servers) {
          try {
            const response = await fetchWithTimeout(url, { timeout: 5000 });
            if (response.ok) {
              data = await response.json();
              if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                break;
              }
            }
          } catch (e) {
            console.warn(`Main OSRM call failed on ${url}:`, e);
          }
        }

        if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const routesParsed = data.routes.map((r, index) => {
            const distanceKm = (r.distance / 1000).toFixed(1) + ' km';
            
            const rawDuration = r.duration;
            const adjustedDuration = travelMode === 'motorbike' ? rawDuration * 0.8 : rawDuration;
            const durationMin = fmtDur(adjustedDuration / 60);
            
            let traffic = 'smooth';
            let delay = null;
            if (index === 1) {
              traffic = 'moderate';
              delay = 'Moderate traffic expected';
            } else if (index === 2) {
              traffic = 'heavy';
              delay = 'Heavy urban traffic';
            }

            const routeLabels = ['Fastest Route (Best Recommended)', 'Alternative Route', 'Via City Roads'];
            const routeName = routeLabels[index] || `Route ${index + 1}`;

            // Validate route geometry has enough points if it covers more than 500m
            const dLng = end[0] - start[0];
            const dLat = end[1] - start[1];
            const distDegrees = Math.sqrt(dLng * dLng + dLat * dLat);
            if (distDegrees > 0.005 && (!r.geometry || !r.geometry.coordinates || r.geometry.coordinates.length < 5)) {
              throw new Error('Incomplete straight line route segment returned by OSRM');
            }

            return {
              name: routeName,
              distance: distanceKm,
              duration: durationMin,
              geometry: pinRoute(r.geometry.coordinates),
              trafficStatus: traffic,
              delayInfo: delay,
              isRecommended: index === 0
            };
          });

          // Supplement routes using real roads if less than 3
          let finalRoutes = await supplementWithRealRoads(routesParsed);

          // Fetch live TomTom traffic for the routes immediately if key is configured
          if (settings.tomtomKey) {
            finalRoutes = await applyTomTomTrafficToRoutes(finalRoutes, settings.tomtomKey, travelMode);
          }

          setIsSimulationMode(false);
          if (mapboxErrorMsg) {
            setRoutingError(`Mapbox API failed (${mapboxErrorMsg}). Falling back to OpenStreetMap (OSRM) backup. Local street routing may be limited in rural areas.`);
          } else {
            setRoutingError('Using OpenStreetMap (OSRM) backup. Local street routing may be limited in rural areas.');
          }
          setActiveRoutingEngine('osrm');
          setRouteOptions(finalRoutes);
          setSelectedRouteIndex(0);
          return;
        }
      } catch (error) {
        console.warn('OSRM directions API failed, using fallback simulation:', error);
      }

      // 3. Simulation mode fallback route data with dynamic interpolation
      let mockRoutes = generateDynamicMockRoutes(start, end, travelMode);

      // Fetch live TomTom traffic for the routes immediately if key is configured
      if (settings.tomtomKey) {
        mockRoutes = await applyTomTomTrafficToRoutes(mockRoutes, settings.tomtomKey, travelMode);
      }

      setIsSimulationMode(true);
      if (mapboxErrorMsg) {
        setRoutingError(`Mapbox API failed (${mapboxErrorMsg}). All backup routing APIs are offline. Simulation mode active.`);
      } else {
        setRoutingError('All routing APIs offline. Simulation mode active.');
      }
      setActiveRoutingEngine('simulation');
      setRouteOptions(mockRoutes);
      setSelectedRouteIndex(0);
      } finally {
        setIsRoutesLoading(false);
      }
    };

    fetchRoutes();

    // Update search history: bump to top if already exists, add if new (only if destination name has changed)
    if (destination && destination.name !== lastSearchedDestNameRef.current) {
      lastSearchedDestNameRef.current = destination.name;
      const updateSearchHistory = async () => {
        const normName = destination.name.toLowerCase().trim();

        if (user) {
          try {
            // Delete ALL existing search history records with this name to avoid duplicates
            await supabase
              .from('search_history')
              .delete()
              .eq('user_id', user.id)
              .ilike('name', destination.name.trim());

            // Insert fresh at the top
            const { data, error } = await supabase
              .from('search_history')
              .insert([{ user_id: user.id, name: destination.name, coordinates: destination.coordinates }])
              .select();

            if (!error && data && data[0]) {
              const newItem = {
                id: data[0].id,
                name: data[0].name,
                coordinates: Array.isArray(data[0].coordinates)
                  ? data[0].coordinates
                  : JSON.parse(data[0].coordinates),
              };
              // Bump to top in local state (remove old occurrences, prepend new)
              setSearchHistory(prev => [
                newItem,
                ...prev.filter(h => h.name.toLowerCase().trim() !== normName).slice(0, 4),
              ]);
            }

            // Prune to keep only 5 most recent
            const { data: historyItems, error: fetchErr } = await supabase
              .from('search_history')
              .select('id')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });

            if (!fetchErr && historyItems && historyItems.length > 5) {
              const idsToDelete = historyItems.slice(5).map(item => item.id);
              await supabase.from('search_history').delete().in('id', idsToDelete);
            }
          } catch (err) {
            console.error('Failed to update search history in Supabase:', err);
          }
        } else {
          // Local-only mode: bump to top, no duplicates
          setSearchHistory(prev => [
            { name: destination.name, coordinates: destination.coordinates },
            ...prev.filter(h => h.name.toLowerCase().trim() !== normName).slice(0, 4),
          ]);
        }
      };
      updateSearchHistory();
    }


  }, [startLocation, destination, settings.mapboxKey, settings.tomtomKey, gmapsLoaded, user, travelMode]);

  // Real-time traffic tracking loop (updates every 15 seconds when route is active)
  useEffect(() => {
    if (!destination) return;

    const interval = setInterval(async () => {
      // Get the currently selected route
      let selectedRoute = null;
      setRouteOptions(prev => {
        if (prev && prev[selectedRouteIndex]) {
          selectedRoute = prev[selectedRouteIndex];
        }
        return prev;
      });

      if (!selectedRoute) return;

      const geom = selectedRoute.geometry;
      if (!geom || geom.length < 2) return;

      let newStatus;
      let newDelayInfo = null;
      let trafficFactor;

      // 1. Try TomTom Live Traffic Flow segments if key is set
      if (settings.tomtomKey) {
        try {
          // Sample only the midpoint of the route (1 API call instead of 3)
          const midIdx = Math.floor(geom.length * 0.5);
          const pt = geom[midIdx];

          if (pt) {
            const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative-to-functional/10/json?key=${settings.tomtomKey}&point=${pt[1]},${pt[0]}`;
            const res = await fetchWithTimeout(url, { timeout: 3500 });
            if (res.ok) {
              const data = await res.json();
              if (data.flowSegmentData) {
                const current = data.flowSegmentData.currentSpeed;
                const freeFlow = data.flowSegmentData.freeFlowSpeed;
                const travelTime = data.flowSegmentData.currentTravelTime;
                const freeFlowTime = data.flowSegmentData.freeFlowTravelTime;
                const delaySec = Math.max(0, (travelTime || 0) - (freeFlowTime || 0));

                if (freeFlow > 0) {
                  const ratio = current / freeFlow;
                  if (ratio >= 0.85) {
                    newStatus = 'smooth'; trafficFactor = 1.0;
                  } else if (ratio >= 0.55) {
                    newStatus = 'moderate'; trafficFactor = 1.25;
                    newDelayInfo = delaySec > 0 ? `${Math.round(delaySec / 60)} min traffic delay` : 'Moderate traffic congestion';
                  } else if (ratio >= 0.25) {
                    newStatus = 'heavy'; trafficFactor = 1.6;
                    newDelayInfo = delaySec > 0 ? `Heavy delay: +${Math.round(delaySec / 60)} min` : 'Heavy traffic congestion';
                  } else {
                    newStatus = 'blocked'; trafficFactor = 2.5;
                    newDelayInfo = 'Road highly congested or blocked';
                  }
                  updateRouteWithTraffic(newStatus, newDelayInfo, trafficFactor);
                  return;
                }
              }
            }
          }
        } catch (e) {
          console.warn('TomTom live traffic routing failed, using fallback simulation:', e);
        }
      }

      // 2. Simulation fallback (runs if key is missing or API failed)
      // Pick a random traffic update with realistic conditions
      const roll = Math.random();
      if (roll < 0.65) {
        newStatus = 'smooth';
        newDelayInfo = null;
        trafficFactor = 1.0;
      } else if (roll < 0.85) {
        newStatus = 'moderate';
        const mins = Math.floor(Math.random() * 5) + 2;
        newDelayInfo = `${mins} min slow traffic ahead`;
        trafficFactor = 1.15 + (mins * 0.02);
      } else if (roll < 0.95) {
        newStatus = 'heavy';
        const mins = Math.floor(Math.random() * 12) + 6;
        newDelayInfo = `Heavy congestion: +${mins} min delay`;
        trafficFactor = 1.35 + (mins * 0.03);
      } else {
        newStatus = 'blocked';
        newDelayInfo = 'Bottleneck: Road works or accident reported';
        trafficFactor = 2.1;
      }

      updateRouteWithTraffic(newStatus, newDelayInfo, trafficFactor);

    }, 60000); // run every 60 seconds (reduced from 15s to cut API token usage by 75%)

    // Helper to update state reactively
    const updateRouteWithTraffic = (status, delayInfo, factor) => {
      setRouteOptions(prev => {
        if (!prev || !prev[selectedRouteIndex]) return prev;
        return prev.map((route, idx) => {
          if (idx !== selectedRouteIndex) return route;

          // Parse base distance (e.g. "12.4 km")
          const distKm = parseFloat(route.distance.replace(/[^\d.]/g, ''));
          if (isNaN(distKm)) return route;

          // Recalculate duration using traffic factor
          const baseSpeed = modeSpeed[travelMode] || 50;
          const newMins = (distKm / baseSpeed) * 60 * factor;

          return {
            ...route,
            trafficStatus: status,
            delayInfo: delayInfo,
            duration: fmtDur(newMins)
          };
        });
      });
    };

    return () => clearInterval(interval);
  }, [destination, selectedRouteIndex, travelMode, settings.tomtomKey]);






  // Search History Action
  const handleSelectHistory = (item) => {
    stopRouteSimulation();
    setDestination({ name: item.name, coordinates: item.coordinates });
    if (window.innerWidth <= 640) {
      setIsSidebarOpen(false);
    }
  };

  const handleRemoveHistory = async (indexToRemove) => {
    const itemToRemove = searchHistory[indexToRemove];
    if (user && itemToRemove.id) {
      try {
        const { error } = await supabase
          .from('search_history')
          .delete()
          .eq('id', itemToRemove.id);
        
        if (error) {
          console.error('Error deleting search history from Supabase:', error);
          return;
        }
        setSearchHistory(prev => prev.filter((_, idx) => idx !== indexToRemove));
      } catch (err) {
        console.error('Failed to delete search history from Supabase:', err);
      }
    } else {
      setSearchHistory(prev => prev.filter((_, idx) => idx !== indexToRemove));
    }
  };

  // Amenities Search Action (spawns POIs on map viewport)
  const handleAmenitiesSearch = (type) => {
    setActiveAmenitySearch({ type, timestamp: Date.now() });
  };

  const handleAmenitiesSearchFallback = (type, customCenter) => {
    const center = customCenter || mapCenter || startLocation?.coordinates || [77.2090, 28.6139];
    
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

  const calculateBearing = (start, end) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;

    const lat1 = toRad(start[1]);
    const lat2 = toRad(end[1]);
    const dLng = toRad(end[0] - start[0]);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
  };

  const startRouteSimulation = () => {
    const route = routeOptions[selectedRouteIndex];
    if (!route || !route.geometry || route.geometry.length < 2) return;

    stopRouteSimulation();

    setIsRouteSimulationActive(true);
    setShowArrivalToast(false);

    let currentIndex = 0;
    const geometry = route.geometry;

    // Set starting position
    setNavMarkerPos(geometry[0]);
    if (geometry.length > 1) {
      setNavMarkerBearing(calculateBearing(geometry[0], geometry[1]));
    }

    simulationIntervalRef.current = setInterval(() => {
      currentIndex++;
      if (currentIndex >= geometry.length) {
        stopRouteSimulation();
        return;
      }

      const prevPt = geometry[currentIndex - 1];
      const currPt = geometry[currentIndex];

      const bearing = calculateBearing(prevPt, currPt);
      setNavMarkerBearing(bearing);
      setNavMarkerPos(currPt);
    }, 850);
  };

  function stopRouteSimulation() {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setIsRouteSimulationActive(false);
  }

  // Cleanup simulation timer on unmount
  useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

  const handlePoiClick = (poi) => {
    stopRouteSimulation();
    setDestination({ name: poi.name, coordinates: poi.coordinates });
  };

  const handleRouteSelected = (idx) => {
    stopRouteSimulation();
    if (idx === selectedRouteIndex) return;
    setIsRouteSwitching(true);
    setSelectedRouteIndex(idx);

    // After route switches, zoom map to user's current GPS position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { longitude, latitude } = pos.coords;
          setNavMarkerPos([longitude, latitude]);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 4000 }
      );
    }

    setTimeout(() => {
      setIsRouteSwitching(false);
    }, 450);
  };



  if (authLoading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner} className="spin" />
        <span style={{ marginTop: '16px', fontWeight: '600' }}>Initializing TrafficFlow AI Database...</span>
      </div>
    );
  }

  // Render Landing Page or Authentication screens if not signed in
  if (!user) {
    if (authMode === 'login' || authMode === 'signup') {
      return (
        <Auth 
          isInitialSignUp={authMode === 'signup'} 
          onAuthSuccess={handleAuthSuccess} 
          onBackToLanding={handleBackToLanding}
          onToggleMode={(mode) => handleNavigate(mode, true)}
        />
      );
    }
    return <LandingPage onNavigate={handleNavigate} />;
  }

  return (
    <div className="app-container">
      
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

      {/* ─── Sign Out Confirmation Dialog ─── */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(5, 8, 22, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(15,20,40,0.98) 0%, rgba(20,28,58,0.98) 100%)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: '24px',
            padding: '36px 32px',
            maxWidth: '360px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '12px',
            boxShadow: '0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.07)',
            animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            {/* Icon */}
            <div style={{
              width: '64px', height: '64px', borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.08) 100%)',
              border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', marginBottom: '4px',
            }}>
              🚪
            </div>

            {/* Title */}
            <h2 style={{
              fontSize: '1.25rem', fontWeight: '800',
              color: '#f1f5f9', margin: 0,
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-sans)',
            }}>Sign Out?</h2>

            {/* Subtitle */}
            <p style={{
              fontSize: '0.875rem', color: 'rgba(148,163,184,0.85)',
              lineHeight: '1.55', margin: 0,
              fontFamily: 'var(--font-sans)',
            }}>
              Are you sure you want to sign out of TrafficFlow AI?
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
              {/* No — stay */}
              <button
                id="logout-confirm-no"
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: '12px',
                  border: '1px solid rgba(99,102,241,0.3)',
                  background: 'rgba(99,102,241,0.1)',
                  color: '#a5b4fc', fontSize: '0.92rem', fontWeight: '700',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  transition: 'all 0.18s ease', letterSpacing: '0.01em',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
              >
                No, Stay
              </button>

              {/* Yes — logout */}
              <button
                id="logout-confirm-yes"
                onClick={confirmLogout}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: '12px',
                  border: '1px solid rgba(239,68,68,0.3)',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(220,38,38,0.12) 100%)',
                  color: '#fca5a5', fontSize: '0.92rem', fontWeight: '700',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  transition: 'all 0.18s ease', letterSpacing: '0.01em',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.32) 0%, rgba(220,38,38,0.24) 100%)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(220,38,38,0.12) 100%)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Exit App Confirmation Dialog (shown when user presses back on dashboard) ─── */}
      {showExitConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(5, 8, 22, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(15,20,40,0.98) 0%, rgba(20,28,58,0.98) 100%)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: '24px',
            padding: '36px 32px',
            maxWidth: '360px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '12px',
            boxShadow: '0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.07)',
            animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            {/* Icon */}
            <div style={{
              width: '64px', height: '64px', borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.08) 100%)',
              border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', marginBottom: '4px',
            }}>
              🚪
            </div>

            {/* Title */}
            <h2 style={{
              fontSize: '1.25rem', fontWeight: '800',
              color: '#f1f5f9', margin: 0,
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-sans)',
            }}>Exit App?</h2>

            {/* Subtitle */}
            <p style={{
              fontSize: '0.875rem', color: 'rgba(148,163,184,0.85)',
              lineHeight: '1.55', margin: 0,
              fontFamily: 'var(--font-sans)',
            }}>
              Are you sure you want to leave TrafficFlow AI?
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
              {/* No — stay */}
              <button
                id="exit-confirm-no"
                onClick={() => setShowExitConfirm(false)}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: '12px',
                  border: '1px solid rgba(99,102,241,0.3)',
                  background: 'rgba(99,102,241,0.1)',
                  color: '#a5b4fc', fontSize: '0.92rem', fontWeight: '700',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  transition: 'all 0.18s ease', letterSpacing: '0.01em',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
              >
                No, Stay
              </button>

              {/* Yes — exit */}
              <button
                id="exit-confirm-yes"
                onClick={() => {
                  setShowExitConfirm(false);
                  try {
                    window.close();
                  } catch {
                    // Suppress window close permissions warning
                  }
                  setTimeout(() => { if (!window.closed) window.location.href = 'about:blank'; }, 150);
                }}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: '12px',
                  border: '1px solid rgba(239,68,68,0.3)',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(220,38,38,0.12) 100%)',
                  color: '#fca5a5', fontSize: '0.92rem', fontWeight: '700',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  transition: 'all 0.18s ease', letterSpacing: '0.01em',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.32) 0%, rgba(220,38,38,0.24) 100%)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(220,38,38,0.12) 100%)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
              >
                Yes, Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Arrival Toast Notification ─── */}
      {showArrivalToast && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          padding: '18px 28px',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(16, 185, 129, 0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          animation: 'fadeIn 0.4s ease',
          maxWidth: '90vw',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.2)',
        }}>
          <span style={{ fontSize: '2rem' }}>🎉</span>
          <div>
            <div style={{ fontWeight: '800', fontSize: '1rem', letterSpacing: '-0.01em' }}>
              You've Arrived!
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '2px' }}>
              {destination?.name || 'Destination'} reached successfully
            </div>
          </div>
          <button
            onClick={() => setShowArrivalToast(false)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '28px', height: '28px',
              color: '#fff',
              fontWeight: '700',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: '4px',
            }}
          >✕</button>
        </div>
      )}

      {/* First-Login Keys Disclaimer Alert Dialog */}
      {showWarningOnLogin && (
        <div style={styles.disclaimerBackdrop}>
          <div className="glass-panel" style={styles.disclaimerCard}>
            <span style={styles.disclaimerEmoji}>🚨</span>
            <h3 style={styles.disclaimerTitle}>API Security Warning</h3>
            <p style={styles.disclaimerText}>
              Welcome to TrafficFlow AI! This app uses your own API keys for Mapbox, TomTom, and AI features.
              <br /><br />
              <strong>The developer takes no responsibility</strong> for key usage, rates, or limits. Your keys are saved only locally in your browser and sent directly to the services.
            </p>
            <button onClick={() => setShowWarningOnLogin(false)} className="glow-btn" style={{ marginTop: '8px' }}>
              I Understand &amp; Agree
            </button>
          </div>
        </div>
      )}

      {/* API Key Setup Guide — shown to new users and locks the app if keys are missing */}
      {(!settings.googleMapsKey || !settings.mapboxKey) && !showWarningOnLogin && !dismissedKeySetup && !isSyncingSettings && (
        <div style={{ ...styles.disclaimerBackdrop, backdropFilter: 'blur(16px)', backgroundColor: 'rgba(15, 23, 42, 0.9)' }}>
          <div className="glass-panel" style={{ ...styles.disclaimerCard, maxWidth: '520px', textAlign: 'left', gap: '0', position: 'relative' }}>
            <button
              onClick={() => setDismissedKeySetup(true)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition-smooth)',
              }}
              title="Close Setup Guide"
            >
              <X size={18} />
            </button>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '2.5rem' }}>🔑</span>
              <h3 style={{ ...styles.disclaimerTitle, marginTop: '8px' }}>Mandatory API Key Configuration</h3>
              <p style={{ ...styles.disclaimerText, marginTop: '6px' }}>
                TrafficFlow AI requires your own API credentials. Keyless simulation mode and public map fallbacks are disabled. You must configure them to proceed.
              </p>
            </div>
            <div style={styles.setupKeysList}>
              <div style={styles.setupKeyRow}>
                <span style={styles.setupKeyIcon}>🗺️</span>
                <div>
                  <div style={styles.setupKeyName}>Google Maps API Key <span style={styles.setupKeyRequired}>Required</span></div>
                  <div style={styles.setupKeyDesc}>Used for loading the interactive maps and geocoding places</div>
                </div>
              </div>
              <div style={styles.setupKeyRow}>
                <span style={styles.setupKeyIcon}>📍</span>
                <div>
                  <div style={styles.setupKeyName}>Mapbox Access Token <span style={styles.setupKeyRequired}>Required</span></div>
                  <div style={styles.setupKeyDesc}>Used for calculating real-time routes, directions and road geometry</div>
                </div>
              </div>
              <div style={styles.setupKeyRow}>
                <span style={styles.setupKeyIcon}>🤖</span>
                <div>
                  <div style={styles.setupKeyName}>Gemini / OpenAI Key <span style={styles.setupKeyOptional}>Optional</span></div>
                  <div style={styles.setupKeyDesc}>Powers the AI traffic analyst and smart route summaries</div>
                </div>
              </div>
              <div style={styles.setupKeyRow}>
                <span style={styles.setupKeyIcon}>🌤️</span>
                <div>
                  <div style={styles.setupKeyName}>OpenWeatherMap Key <span style={styles.setupKeyOptional}>Optional</span></div>
                  <div style={styles.setupKeyDesc}>Enables live weather sync and automatic day/night mode</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'center', width: '100%' }}>
              <button
                className="glow-btn"
                style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                onClick={() => {
                  setIsSettingsOpen(true);
                }}
              >
                ⚙️ Setup API Keys in Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Maps Authentication Error Warning Modal */}
      {isGmapsAuthError && (
        <div style={{ ...styles.disclaimerBackdrop, backdropFilter: 'blur(16px)', backgroundColor: 'rgba(15, 23, 42, 0.9)' }}>
          <div className="glass-panel" style={{ ...styles.disclaimerCard, maxWidth: '520px', textAlign: 'left', gap: '0', position: 'relative' }}>
            <button
              onClick={() => setIsGmapsAuthError(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition-smooth)',
              }}
              title="Dismiss Warning"
            >
              <X size={18} />
            </button>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '2.5rem' }}>⚠️</span>
              <h3 style={{ ...styles.disclaimerTitle, marginTop: '8px', color: '#ef4444' }}>Google Maps Key Validation Failed</h3>
              <p style={{ ...styles.disclaimerText, marginTop: '6px' }}>
                Your Google Maps API key loaded with errors. Google Maps will not render correctly until this is fixed.
              </p>
            </div>
            <div style={styles.setupKeysList}>
              <div style={{ ...styles.setupKeyRow, border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.03)' }}>
                <span style={styles.setupKeyIcon}>💳</span>
                <div>
                  <div style={{ ...styles.setupKeyName, color: '#fca5a5' }}>Billing Account Required</div>
                  <div style={styles.setupKeyDesc}>Google requires a valid billing account linked to your Cloud project, even within the free tier.</div>
                </div>
              </div>
              <div style={{ ...styles.setupKeyRow, border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.03)' }}>
                <span style={styles.setupKeyIcon}>💻</span>
                <div>
                  <div style={{ ...styles.setupKeyName, color: '#fca5a5' }}>Enable Maps JavaScript API</div>
                  <div style={styles.setupKeyDesc}>Ensure "Maps JavaScript API" is enabled in your Google Cloud Console project's APIs library.</div>
                </div>
              </div>
              <div style={{ ...styles.setupKeyRow, border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.03)' }}>
                <span style={styles.setupKeyIcon}>🔒</span>
                <div>
                  <div style={{ ...styles.setupKeyName, color: '#fca5a5' }}>Referrer Restrictions</div>
                  <div style={styles.setupKeyDesc}>Check if your key restrictions block the current website domain or localhost.</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', width: '100%' }}>
              <button
                className="glow-btn"
                style={{ flex: 1, padding: '12px', fontSize: '0.9rem', cursor: 'pointer' }}
                onClick={() => {
                  setIsSettingsOpen(true);
                }}
              >
                ⚙️ Update Settings
              </button>
              <button
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-secondary)', fontSize: '0.9rem',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  transition: 'all 0.18s ease'
                }}
                onClick={() => setIsGmapsAuthError(false)}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Layout Sidebars & Interactive Map View */}
      {/* Floating Hamburger Button for collapsed Sidebar */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="floating-menu-btn"
          title="Open Navigation Sidebar"
        >
          <Menu size={20} />
        </button>
      )}

      <Sidebar
        ref={sidebarRef}
        settings={settings}
        gmapsLoaded={gmapsLoaded}
        isSidebarOpen={isSidebarOpen}
        onCollapse={() => setIsSidebarOpen(false)}
        startLocation={startLocation}
        setStartLocation={setStartLocation}
        destination={destination}
        setDestination={setDestination}
        routeOptions={routeOptions}
        selectedRouteIndex={selectedRouteIndex}
        onRouteSelected={handleRouteSelected}
        isRoutesLoading={isRoutesLoading}
        isRouteSwitching={isRouteSwitching}
        searchHistory={searchHistory}
        onSelectHistory={handleSelectHistory}
        onRemoveHistory={handleRemoveHistory}
        onAmenitiesSearch={handleAmenitiesSearch}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        user={user}
        onShareEta={() => setIsShareEtaOpen(true)}
        travelMode={travelMode}
        onTravelModeChange={setTravelMode}
        isSimulationMode={isSimulationMode}
        routingError={routingError}
        isRouteSimulationActive={isRouteSimulationActive}
        onStartSimulation={startRouteSimulation}
        onStopSimulation={stopRouteSimulation}
        activeTab={sidebarActiveTab}
        setActiveTab={setSidebarActiveTab}
      />

      {(!settings.googleMapsKey || !settings.mapboxKey) && !isSyncingSettings ? (
        <div style={styles.mapPlaceholderContainer}>
          <div className="glass-panel" style={styles.mapPlaceholderCard}>
            <div style={styles.placeholderIconWrapper}>
              <Map size={40} className="pulse" style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 8px var(--primary-glow))' }} />
            </div>
            <h3 style={styles.placeholderTitle}>Interactive Map View Disabled</h3>
            <p style={styles.placeholderText}>
              To load 3D vector tile layouts, telemetry tracking, and dynamic routing navigation, please configure your own **Google Maps** and **Mapbox** credentials in the application settings modal.
            </p>
            <button
              className="glow-btn"
              onClick={() => setIsSettingsOpen(true)}
              style={styles.placeholderBtn}
            >
              ⚙️ Setup API Keys in Settings
            </button>
          </div>
        </div>
      ) : (
        <MapView
          settings={settings}
          gmapsLoaded={gmapsLoaded}
          startLocation={startLocation}
          destination={destination}
          routeOptions={routeOptions}
          selectedRouteIndex={selectedRouteIndex}
          onRouteSelected={handleRouteSelected}
          isRoutesLoading={isRoutesLoading}
          isRouteSwitching={isRouteSwitching}
          weather={weather}
          setWeather={setWeather}
          timeOfDay={timeOfDay}
          setTimeOfDay={setTimeOfDay}
          pois={pois}
          onPoiClick={handlePoiClick}
          onMapClick={() => {
            if (window.innerWidth <= 640) {
              setIsSidebarOpen(false);
            }
          }}
          navMarkerPos={navMarkerPos}
          navMarkerBearing={navMarkerBearing}
          onMapCenterChange={setMapCenter}
          activeAmenitySearch={activeAmenitySearch}
          onPoisFound={setPois}
          onAmenitiesSearchFallback={handleAmenitiesSearchFallback}
          activeRoutingEngine={activeRoutingEngine}
          routingError={routingError}
          isRouteSimulationActive={isRouteSimulationActive}
          isWeatherPanelOpen={isWeatherPanelOpen}
          setIsWeatherPanelOpen={setIsWeatherPanelOpen}
        />
      )}

    </div>
  );
}

const styles = {
  mapPlaceholderContainer: {
    flex: 1,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0d14',
    padding: '24px',
  },
  mapPlaceholderCard: {
    maxWidth: '460px',
    padding: '40px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '20px',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-lg)',
  },
  placeholderIconWrapper: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-glow)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  placeholderTitle: {
    fontSize: '1.4rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.01em',
  },
  placeholderText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
  },
  placeholderBtn: {
    marginTop: '8px',
    padding: '12px 28px',
    fontSize: '0.88rem',
    fontWeight: '700',
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
  setupKeysList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    padding: '0 4px',
  },
  setupKeyRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '12px 14px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  setupKeyIcon: {
    fontSize: '1.4rem',
    marginTop: '2px',
    flexShrink: 0,
  },
  setupKeyName: {
    fontSize: '0.87rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  setupKeyDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '3px',
    lineHeight: '1.4',
  },
  setupKeyRequired: {
    fontSize: '0.65rem',
    fontWeight: '700',
    padding: '2px 7px',
    borderRadius: '20px',
    background: 'rgba(239,68,68,0.15)',
    color: '#f87171',
    border: '1px solid rgba(239,68,68,0.3)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  setupKeyOptional: {
    fontSize: '0.65rem',
    fontWeight: '700',
    padding: '2px 7px',
    borderRadius: '20px',
    background: 'rgba(99,102,241,0.15)',
    color: '#a5b4fc',
    border: '1px solid rgba(99,102,241,0.3)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  skipBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
};
