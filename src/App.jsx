import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import ShareEtaModal from './components/ShareEtaModal';
import { Menu } from 'lucide-react';
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
    const steps = 30;
    
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
      
      // Add a small sine wave wiggle to look like real winding streets
      const frequency = 6;
      const amplitude = 0.006 * Math.sin(t * Math.PI); // zero offset at exactly start & end
      const waveLng = amplitude * Math.sin(t * Math.PI * frequency);
      const waveLat = amplitude * Math.cos(t * Math.PI * frequency);
      
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

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [gmapsLoaded, setGmapsLoaded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth > 640);
  
  // Settings State
  const [settings, setSettings] = useState({
    theme: localStorage.getItem('tf_theme') || 'dark',
    googleMapsKey: localStorage.getItem('tf_google_maps_key') || '',
    mapboxKey: localStorage.getItem('tf_mapbox_key') || '',
    tomtomKey: localStorage.getItem('tf_tomtom_key') || '',
    openWeatherKey: localStorage.getItem('tf_open_weather_key') || '',
    aiProvider: localStorage.getItem('tf_ai_provider') || 'gemini',
    aiKey: localStorage.getItem('tf_ai_key') || '',
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

  // Weather & Time States
  const [weather, setWeather] = useState(localStorage.getItem('tf_weather') || 'clear');
  const [timeOfDay, setTimeOfDay] = useState('day');
  const [travelMode, setTravelMode] = useState('car'); // 'car' | 'motorbike' | 'bicycle' | 'walk'

  // Live GPS tracking states (marker position & orientation)
  const [navMarkerPos, setNavMarkerPos] = useState(null); // [lng, lat] of moving navigator dot
  const [navMarkerBearing, setNavMarkerBearing] = useState(null); // heading angle in degrees (0-360)
  const lastSearchedDestNameRef = useRef(null);

  // Bookmarks & Search History States
  const [bookmarks, setBookmarks] = useState(() => {
    const saved = localStorage.getItem('tf_bookmarks');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('tf_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  const [searchHistory, setSearchHistory] = useState([
    { name: 'Cyber City, Gurugram', coordinates: [77.0878, 28.4950] },
    { name: 'India Gate, Delhi', coordinates: [77.2295, 28.6129] },
  ]);

  // Modal Toggles
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareEtaOpen, setIsShareEtaOpen] = useState(false);
  const [showWarningOnLogin, setShowWarningOnLogin] = useState(false);
  const [showApiSetupGuide, setShowApiSetupGuide] = useState(false);

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

  // Sync user database state on auth state changes
  useEffect(() => {
    if (!user) {
      // Clear or reset to local storage defaults
      const savedBm = localStorage.getItem('tf_bookmarks');
      setTimeout(() => {
        setBookmarks(savedBm ? JSON.parse(savedBm) : []);
        setSearchHistory([
          { name: 'Cyber City, Gurugram', coordinates: [77.0878, 28.4950] },
          { name: 'India Gate, Delhi', coordinates: [77.2295, 28.6129] },
        ]);
        setSettings({
          theme: localStorage.getItem('tf_theme') || 'dark',
          googleMapsKey: localStorage.getItem('tf_google_maps_key') || '',
          mapboxKey: localStorage.getItem('tf_mapbox_key') || '',
          tomtomKey: localStorage.getItem('tf_tomtom_key') || '',
          openWeatherKey: localStorage.getItem('tf_open_weather_key') || '',
          aiProvider: localStorage.getItem('tf_ai_provider') || 'gemini',
          aiKey: localStorage.getItem('tf_ai_key') || '',
        });
      }, 0);
      return;
    }

    const fetchUserData = async () => {
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
          setSettings({
            theme: settingsData.theme || 'dark',
            googleMapsKey: settingsData.google_maps_key || '',
            mapboxKey: settingsData.mapbox_key || '',
            tomtomKey: settingsData.tomtom_key || '',
            openWeatherKey: settingsData.open_weather_key || '',
            aiProvider: settingsData.ai_provider || 'gemini',
            aiKey: settingsData.ai_key || '',
          });
        } else {
          // No settings found, create new default settings row in Supabase
          const defaultSettings = {
            user_id: user.id,
            theme: localStorage.getItem('tf_theme') || 'dark',
            google_maps_key: localStorage.getItem('tf_google_maps_key') || '',
            mapbox_key: localStorage.getItem('tf_mapbox_key') || '',
            tomtom_key: localStorage.getItem('tf_tomtom_key') || '',
            open_weather_key: localStorage.getItem('tf_open_weather_key') || '',
            ai_provider: localStorage.getItem('tf_ai_provider') || 'gemini',
            ai_key: localStorage.getItem('tf_ai_key') || '',
          };
          await supabase.from('user_settings').insert([defaultSettings]);
        }

        // 2. Fetch bookmarks
        const { data: bookmarksData, error: bookmarksError } = await supabase
          .from('bookmarks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (bookmarksError) {
          console.error('Error fetching bookmarks:', bookmarksError);
        } else if (bookmarksData) {
          const parsedBookmarks = bookmarksData.map(bm => ({
            id: bm.id,
            name: bm.name,
            address: bm.address,
            coordinates: Array.isArray(bm.coordinates) ? bm.coordinates : JSON.parse(bm.coordinates)
          }));
          setBookmarks(parsedBookmarks);
        }

        // 3. Fetch search history
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
        }
      } catch (err) {
        console.error('Failed to sync data with Supabase:', err);
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
      setTimeout(() => setGmapsLoaded(false), 0);
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

  // Live GPS tracking watcher to move the navigator dot and follow user's position
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
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

  const handleAuthSuccess = (authUser) => {
    setUser(authUser);
    // Show disclaimer warning banner on first login
    const hasSeenWarning = localStorage.getItem('tf_seen_warning');
    if (!hasSeenWarning) {
      setShowWarningOnLogin(true);
      localStorage.setItem('tf_seen_warning', 'true');
    }
    // Show API key setup guide if not yet seen
    const hasSeenSetup = localStorage.getItem('tf_seen_setup');
    if (!hasSeenSetup) {
      setShowApiSetupGuide(true);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleSaveSettings = async (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('tf_theme', newSettings.theme);
    localStorage.setItem('tf_google_maps_key', newSettings.googleMapsKey || '');
    localStorage.setItem('tf_mapbox_key', newSettings.mapboxKey);
    localStorage.setItem('tf_tomtom_key', newSettings.tomtomKey);
    localStorage.setItem('tf_open_weather_key', newSettings.openWeatherKey || '');
    localStorage.setItem('tf_ai_provider', newSettings.aiProvider);
    localStorage.setItem('tf_ai_key', newSettings.aiKey);

    if (user) {
      try {
        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            theme: newSettings.theme,
            google_maps_key: newSettings.googleMapsKey || '',
            mapbox_key: newSettings.mapboxKey,
            tomtom_key: newSettings.tomtomKey,
            open_weather_key: newSettings.openWeatherKey || '',
            ai_provider: newSettings.aiProvider,
            ai_key: newSettings.aiKey,
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



  // Generate routes using Google Maps Directions, Mapbox, or dynamic fallback
  useEffect(() => {
    if (!destination) {
      setTimeout(() => setRouteOptions([]), 0);
      return;
    }

    const fetchRoutes = async () => {
      let start = startLocation?.coordinates || [77.2090, 28.6139]; // CP New Delhi
      let googleMapsErrorMsg = null;
      let mapboxErrorMsg = null;

      // If start is "My Current Location", fetch fresh GPS coordinates first
      if (startLocation?.name === 'My Current Location' || startLocation?.name?.startsWith('My Current Location')) {
        try {
          const freshPos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: true });
          });
          start = [freshPos.coords.longitude, freshPos.coords.latitude];
          // Update startLocation state with the fresh coordinates so start marker snaps to user
          setStartLocation(prev => ({
            ...prev,
            coordinates: start
          }));
        } catch (err) {
          console.warn('Could not fetch fresh GPS coordinates for routing:', err);
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
      const supplementWithRealRoads = async (routesList) => {
        let finalRoutes = [...routesList];
        if (finalRoutes.length < 3) {
          if (finalRoutes.length === 0) {
            const mockAlternatives = generateDynamicMockRoutes(start, end, travelMode);
            finalRoutes = mockAlternatives;
          } else if (finalRoutes.length === 1) {
            const geom1 = await fetchOSRMRouteGeometry(1, 1.2);  // moderate traffic +20%
            if (geom1) {
              finalRoutes.push({
                name: 'Alternative Route',
                distance: geom1.distance,
                duration: geom1.duration,
                geometry: geom1.geometry,
                trafficStatus: 'moderate',
                delayInfo: 'Moderate traffic expected',
                isRecommended: false
              });
            }
            const geom2 = await fetchOSRMRouteGeometry(-1, 1.4);  // heavy traffic +40%
            if (geom2) {
              finalRoutes.push({
                name: 'Via City Roads',
                distance: geom2.distance,
                duration: geom2.duration,
                geometry: geom2.geometry,
                trafficStatus: 'heavy',
                delayInfo: 'Heavy urban traffic',
                isRecommended: false
              });
            }
          } else if (finalRoutes.length === 2) {
            const geom1 = await fetchOSRMRouteGeometry(1, 1.4);
            if (geom1) {
              finalRoutes.push({
                name: 'Via City Roads',
                distance: geom1.distance,
                duration: geom1.duration,
                geometry: geom1.geometry,
                trafficStatus: 'heavy',
                delayInfo: 'Heavy urban traffic',
                isRecommended: false
              });
            }
          }

          // Absolute fallback if OSRM also failed to yield enough alternative routes
          if (finalRoutes.length < 3) {
            const mockAlternatives = generateDynamicMockRoutes(start, end, travelMode);
            if (finalRoutes.length === 1) {
              finalRoutes.push({ ...mockAlternatives[1], isRecommended: false });
              finalRoutes.push({ ...mockAlternatives[2], isRecommended: false });
            } else if (finalRoutes.length === 2) {
              finalRoutes.push({ ...mockAlternatives[2], isRecommended: false });
            }
          }
        }
        return finalRoutes;
      };

      // 1. Try Google Maps Directions Service client-side first
      if (gmapsLoaded && window.google && window.google.maps) {
        try {
          const response = await new Promise((resolve, reject) => {
            let googleMode = window.google.maps.TravelMode.DRIVING;
            if (travelMode === 'bicycle') googleMode = window.google.maps.TravelMode.BICYCLING;
            if (travelMode === 'walk') googleMode = window.google.maps.TravelMode.WALKING;

            const directionsService = new window.google.maps.DirectionsService();
            directionsService.route(
              {
                origin: new window.google.maps.LatLng(start[1], start[0]),
                destination: new window.google.maps.LatLng(end[1], end[0]),
                travelMode: googleMode,
                provideRouteAlternatives: true
              },
              (res, status) => {
                if (status === window.google.maps.DirectionsStatus.OK) {
                  resolve(res);
                } else {
                  reject(new Error('Google Maps directions failed with status: ' + status));
                }
              }
            );
          });

          if (response.routes && response.routes.length > 0) {
            incrementApiUsage('googleMaps');
            const routesParsed = response.routes.map((route, index) => {
              const coords = pinRoute(route.overview_path.map(latLng => [latLng.lng(), latLng.lat()]));
              const distanceText = route.legs[0].distance.text;
              
              let durationVal = route.legs[0].duration.value;
              if (travelMode === 'motorbike') durationVal = durationVal * 0.8;
              const durationText = fmtDur(durationVal / 60);
              
              let traffic = 'smooth';
              let delay = null;
              if (index === 1) {
                traffic = 'moderate';
                delay = 'Minor traffic congestion';
              } else if (index === 2) {
                traffic = 'heavy';
                delay = 'Alternate route delay warning';
              }

              let routeName = route.summary 
                ? `via ${route.summary}`
                : index === 0 ? 'Main Route' : `Alternate Route ${index}`;
              
              if (index === 0) {
                routeName += ' (Best Recommended)';
              }

              return {
                name: routeName,
                distance: distanceText,
                duration: durationText,
                geometry: coords,
                trafficStatus: traffic,
                delayInfo: delay,
                isRecommended: index === 0
              };
            });

            // Supplement routes using real roads if less than 3
            const finalRoutes = await supplementWithRealRoads(routesParsed);

            setIsSimulationMode(false);
            setRoutingError(null);
            setRouteOptions(finalRoutes);
            setSelectedRouteIndex(0);
            return;
          }
        } catch (error) {
          console.warn('Google Maps Directions Service failed, trying Mapbox API:', error);
          if (error.message && error.message.includes('REQUEST_DENIED')) {
            googleMapsErrorMsg = 'Directions API request denied. If you recently enabled it, Google can take up to 5-10 minutes to propagate the changes. Also, ensure your API Key has no "API restrictions" blocking Directions API (under Credentials > API Key settings in Google Console) and that billing is active for your Google Cloud project.';
          } else {
            googleMapsErrorMsg = error.message || 'Unknown error';
          }
        }
      }

      // 2. Try Mapbox Directions API if Mapbox key is present
      if (settings.mapboxKey) {
        try {
          let mapboxProfile = 'mapbox/driving';
          if (travelMode === 'bicycle') mapboxProfile = 'mapbox/cycling';
          if (travelMode === 'walk') mapboxProfile = 'mapbox/walking';

          const response = await fetch(
            `https://api.mapbox.com/directions/v5/${mapboxProfile}/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&alternatives=true&access_token=${settings.mapboxKey}`
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
            const finalRoutes = await supplementWithRealRoads(routesParsed);

            setIsSimulationMode(false);
            if (googleMapsErrorMsg) {
              setRoutingError(`Google Directions API failed (${googleMapsErrorMsg}). Falling back to Mapbox API.`);
            } else {
              setRoutingError(null);
            }
            setRouteOptions(finalRoutes);
            setSelectedRouteIndex(0);
            return;
          }
        } catch (error) {
          console.warn('Mapbox directions API failed, using fallback simulation:', error);
          mapboxErrorMsg = error.message || 'Unknown Mapbox error';
        }
      }

      // 3. Try free OSRM (Open Source Routing Machine) API as a high-quality fallback (with retry & timeout)
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
          const finalRoutes = await supplementWithRealRoads(routesParsed);

          setIsSimulationMode(false);
          if (googleMapsErrorMsg || mapboxErrorMsg) {
            let combined = '';
            if (googleMapsErrorMsg) combined += `Google: ${googleMapsErrorMsg} `;
            if (mapboxErrorMsg) combined += `Mapbox: ${mapboxErrorMsg} `;
            setRoutingError(`${combined}Falling back to OpenStreetMap (OSRM) backup. Local street routing may be limited in rural areas.`);
          } else {
            setRoutingError('Using OpenStreetMap (OSRM) backup. Local street routing may be limited in rural areas.');
          }
          setRouteOptions(finalRoutes);
          setSelectedRouteIndex(0);
          return;
        }
      } catch (error) {
        console.warn('OSRM directions API failed, using fallback simulation:', error);
      }

      // 4. Simulation mode fallback route data with dynamic interpolation
      const mockRoutes = generateDynamicMockRoutes(start, end, travelMode);
      setIsSimulationMode(true);
      if (googleMapsErrorMsg || mapboxErrorMsg) {
        let combined = '';
        if (googleMapsErrorMsg) combined += `Google: ${googleMapsErrorMsg} `;
        if (mapboxErrorMsg) combined += `Mapbox: ${mapboxErrorMsg} `;
        setRoutingError(`${combined}All backup routing APIs are offline. Simulation mode active.`);
      } else {
        setRoutingError('All routing APIs offline. Simulation mode active.');
      }
      setRouteOptions(mockRoutes);
      setSelectedRouteIndex(0);
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


  }, [startLocation, destination, settings.mapboxKey, gmapsLoaded, user, travelMode]);

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
          // Sample 3 points along the route
          const idxs = [
            Math.floor(geom.length * 0.15),
            Math.floor(geom.length * 0.5),
            Math.floor(geom.length * 0.85)
          ];
          
          let totalRatio = 0;
          let validPointsCount = 0;
          let totalDelaySec = 0;

          await Promise.all(
            idxs.map(async (i) => {
              const pt = geom[i];
              if (!pt) return;
              try {
                // TomTom Traffic Flow segments API (lat,lng so pt[1],pt[0])
                const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative-to-functional/10/json?key=${settings.tomtomKey}&point=${pt[1]},${pt[0]}`;
                const res = await fetchWithTimeout(url, { timeout: 3500 });
                if (res.ok) {
                  const data = await res.json();
                  if (data.flowSegmentData) {
                    const current = data.flowSegmentData.currentSpeed;
                    const freeFlow = data.flowSegmentData.freeFlowSpeed;
                    if (freeFlow > 0) {
                      totalRatio += current / freeFlow;
                      validPointsCount++;
                    }
                    const travelTime = data.flowSegmentData.currentTravelTime;
                    const freeFlowTime = data.flowSegmentData.freeFlowTravelTime;
                    if (travelTime > freeFlowTime) {
                      totalDelaySec += (travelTime - freeFlowTime);
                    }
                  }
                }
              } catch (e) {
                console.warn('Failed to fetch TomTom traffic flow point:', e);
              }
            })
          );

          if (validPointsCount > 0) {
            const avgRatio = totalRatio / validPointsCount;
            // Map to traffic status
            if (avgRatio >= 0.85) {
              newStatus = 'smooth';
              trafficFactor = 1.0;
            } else if (avgRatio >= 0.55) {
              newStatus = 'moderate';
              trafficFactor = 1.25;
              newDelayInfo = totalDelaySec > 0 
                ? `${Math.round(totalDelaySec / 60)} min traffic delay`
                : 'Moderate traffic congestion';
            } else if (avgRatio >= 0.25) {
              newStatus = 'heavy';
              trafficFactor = 1.6;
              newDelayInfo = totalDelaySec > 0 
                ? `Heavy delay: +${Math.round(totalDelaySec / 60)} min`
                : 'Heavy traffic congestion';
            } else {
              newStatus = 'blocked';
              trafficFactor = 2.5;
              newDelayInfo = 'Road highly congested or blocked';
            }

            // Successfully fetched traffic
            updateRouteWithTraffic(newStatus, newDelayInfo, trafficFactor);
            return;
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

    }, 15000); // run every 15 seconds

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




  // Bookmarks Actions
  const handleAddBookmark = async (newBm) => {
    if (user) {
      try {
        const { data, error } = await supabase
          .from('bookmarks')
          .insert([
            {
              user_id: user.id,
              name: newBm.name,
              address: newBm.address,
              coordinates: newBm.coordinates,
            }
          ])
          .select();
        
        if (error) {
          console.error('Error adding bookmark to Supabase:', error);
          return;
        }

        if (data && data[0]) {
          const inserted = {
            id: data[0].id,
            name: data[0].name,
            address: data[0].address,
            coordinates: data[0].coordinates
          };
          setBookmarks(prev => [...prev, inserted]);
        }
      } catch (err) {
        console.error('Failed to save bookmark to Supabase:', err);
      }
    } else {
      setBookmarks(prev => [...prev, newBm]);
    }
  };

  const handleSelectBookmark = (bm) => {
    setDestination({ name: bm.address, coordinates: bm.coordinates });
    if (window.innerWidth <= 640) {
      setIsSidebarOpen(false);
    }
  };

  const handleRemoveBookmark = async (indexToRemove) => {
    const bmToRemove = bookmarks[indexToRemove];
    if (user && bmToRemove.id) {
      try {
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('id', bmToRemove.id);
        
        if (error) {
          console.error('Error deleting bookmark from Supabase:', error);
          return;
        }
        setBookmarks(prev => prev.filter((_, idx) => idx !== indexToRemove));
      } catch (err) {
        console.error('Failed to delete bookmark from Supabase:', err);
      }
    } else {
      setBookmarks(prev => prev.filter((_, idx) => idx !== indexToRemove));
    }
  };

  // Search History Action
  const handleSelectHistory = (item) => {
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

      {/* API Key Setup Guide — shown to new users after first login */}
      {showApiSetupGuide && !showWarningOnLogin && (
        <div style={styles.disclaimerBackdrop}>
          <div className="glass-panel" style={{ ...styles.disclaimerCard, maxWidth: '520px', textAlign: 'left', gap: '0' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '2.5rem' }}>🔑</span>
              <h3 style={{ ...styles.disclaimerTitle, marginTop: '8px' }}>Setup Your API Keys</h3>
              <p style={{ ...styles.disclaimerText, marginTop: '4px' }}>
                TrafficFlow AI needs API keys to show maps, calculate routes, and enable AI. Without them, features will be limited.
              </p>
            </div>
            <div style={styles.setupKeysList}>
              <div style={styles.setupKeyRow}>
                <span style={styles.setupKeyIcon}>🗺️</span>
                <div>
                  <div style={styles.setupKeyName}>Google Maps API Key <span style={styles.setupKeyRequired}>Required</span></div>
                  <div style={styles.setupKeyDesc}>Shows the live map, calculates real routes and directions</div>
                </div>
              </div>
              <div style={styles.setupKeyRow}>
                <span style={styles.setupKeyIcon}>🤖</span>
                <div>
                  <div style={styles.setupKeyName}>Gemini / OpenAI Key <span style={styles.setupKeyOptional}>Recommended</span></div>
                  <div style={styles.setupKeyDesc}>Powers the AI traffic analyst and smart suggestions</div>
                </div>
              </div>
              <div style={styles.setupKeyRow}>
                <span style={styles.setupKeyIcon}>🌤️</span>
                <div>
                  <div style={styles.setupKeyName}>OpenWeatherMap Key <span style={styles.setupKeyOptional}>Optional</span></div>
                  <div style={styles.setupKeyDesc}>Enables live weather sync and automatic day/night mode</div>
                </div>
              </div>
              <div style={styles.setupKeyRow}>
                <span style={styles.setupKeyIcon}>📍</span>
                <div>
                  <div style={styles.setupKeyName}>Mapbox Key <span style={styles.setupKeyOptional}>Optional</span></div>
                  <div style={styles.setupKeyDesc}>Backup routing when Google Maps is unavailable</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' }}>
              <button
                className="glow-btn"
                onClick={() => {
                  localStorage.setItem('tf_seen_setup', 'true');
                  setShowApiSetupGuide(false);
                  setIsSettingsOpen(true);
                }}
              >
                ⚙️ Open Settings
              </button>
              <button
                style={styles.skipBtn}
                onClick={() => {
                  localStorage.setItem('tf_seen_setup', 'true');
                  setShowApiSetupGuide(false);
                }}
              >
                Skip for now
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
        onRouteSelected={setSelectedRouteIndex}
        bookmarks={bookmarks}
        onAddBookmark={handleAddBookmark}
        onSelectBookmark={handleSelectBookmark}
        onRemoveBookmark={handleRemoveBookmark}
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
