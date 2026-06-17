import { useEffect, useRef, useState } from 'react';
import { CloudRain, Compass, Sun, Moon, Sunrise, Sunset, X, CloudSun, RotateCw, Box } from 'lucide-react';

export default function MapView({
  settings,
  gmapsLoaded,
  startLocation,
  destination,
  routeOptions,
  selectedRouteIndex,
  onRouteSelected,
  weather,
  setWeather,
  timeOfDay,
  setTimeOfDay,
  pois,
  onPoiClick,
  onMapClick,
  navMarkerPos,
  navMarkerBearing,
  onMapCenterChange,
  activeAmenitySearch,
  onPoisFound,
  onAmenitiesSearchFallback,
  routingError,
  isRoutesLoading,
  isRouteSwitching,
  isRouteSimulationActive,
  isWeatherPanelOpen,
  setIsWeatherPanelOpen,
}) {
  const mapContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const navMarkerRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [gmapsError, setGmapsError] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [isNetworkOnline, setIsNetworkOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Refs to track map boundary updates and avoid jumping zoom loops
  const hasFittedBoundsRef = useRef(false);
  const lastRouteKeyRef = useRef('');
  const wasSimulationActiveRef = useRef(false);

  const onMapClickRef = useRef(onMapClick);
  const onPoiClickRef = useRef(onPoiClick);
  const onRouteSelectedRef = useRef(onRouteSelected);
  const onMapCenterChangeRef = useRef(onMapCenterChange);
  const onPoisFoundRef = useRef(onPoisFound);
  const onAmenitiesSearchFallbackRef = useRef(onAmenitiesSearchFallback);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
    onPoiClickRef.current = onPoiClick;
    onRouteSelectedRef.current = onRouteSelected;
    onMapCenterChangeRef.current = onMapCenterChange;
    onPoisFoundRef.current = onPoisFound;
    onAmenitiesSearchFallbackRef.current = onAmenitiesSearchFallback;
  }, [onMapClick, onPoiClick, onRouteSelected, onMapCenterChange, onPoisFound, onAmenitiesSearchFallback]);

  const timeOverlays = {
    day: 'rgba(0, 0, 0, 0)',
    sunrise: 'rgba(251, 146, 60, 0.15)', // warm orange
    sunset: 'rgba(124, 58, 237, 0.2)',  // violet sunset
    night: 'rgba(15, 23, 42, 0.45)',     // dark night
  };

  // Load Google Maps JavaScript SDK when parent tells us it is loaded
  useEffect(() => {
    if (!gmapsLoaded) {
      setTimeout(() => setMapLoaded(false), 0);
      mapRef.current = null;
      return;
    }

    const initGoogleMap = () => {
      if (!mapContainerRef.current) return;

      try {
        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: { lat: 28.6139, lng: 77.2090 }, // New Delhi Default
          zoom: 12,
          // Note: Omit local JS 'styles' array to prevent Google Maps from falling back to raster tiles.
          // This allows full WebGL Vector map rendering which is required for two-finger rotate and tilt gestures.
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          renderingType: 'VECTOR', // Enable WebGL Vector maps for rotation & tilt
          tilt: 45, // Set default tilt to 45 so vector rendering features are obvious
          heading: 0,
          mapId: 'DEMO_MAP_ID', // Enable vector features like rotation and tilt on mobile
          gestureHandling: 'greedy', // Enable single-finger panning on mobile
          rotateControl: true, // Show rotate control
          tiltControl: true, // Show tilt control
        });

        // Collapse sidebar on map click
        map.addListener('click', () => {
          setIsWeatherPanelOpen(false); // Close weather panel on map click
          if (onMapClickRef.current) onMapClickRef.current();
        });

        // Detect manual dragging to disable auto-follow
        map.addListener('dragstart', () => {
          setAutoFollow(false);
        });

        // Track map center changes
        map.addListener('idle', () => {
          const center = map.getCenter();
          if (center && onMapCenterChangeRef.current) {
            onMapCenterChangeRef.current([center.lng(), center.lat()]);
          }
        });

        mapRef.current = map;
        setMapLoaded(true);
        setGmapsError(false);
      } catch (err) {
        console.error('Failed to instantiate Google Maps:', err);
        setGmapsError(true);
      }
    };

    if (window.google && window.google.maps) {
      initGoogleMap();
    } else {
      // Fallback: wait briefly or retry in case it's in a transitional state
      const interval = setInterval(() => {
        if (window.google && window.google.maps) {
          initGoogleMap();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [gmapsLoaded, settings.theme, setIsWeatherPanelOpen]);

  // Handle drawing markers, routes, and POIs on the Google Map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google || !window.google.maps) return;
    const map = mapRef.current;

    // Track if destination or route index changed (not traffic data) — only fit bounds on real changes
    const fitKey = `${destination?.coordinates?.join(',')}_${selectedRouteIndex}`;
    const shouldFitBounds = fitKey !== lastRouteKeyRef.current;
    if (shouldFitBounds) {
      lastRouteKeyRef.current = fitKey;
    }

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Clear old route polylines
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    // Add Amenities POIs
    if (pois && pois.length > 0) {
      pois.forEach(poi => {
        const marker = new window.google.maps.Marker({
          position: { lat: poi.coordinates[1], lng: poi.coordinates[0] },
          map: map,
          title: poi.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#ef4444',
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          label: {
            text: poi.type === 'petrol' ? '⛽' : poi.type === 'restaurant' ? '🍔' : poi.type === 'hotel' ? '🏨' : '🏥',
            fontSize: '11px',
          }
        });

        marker.addListener('click', () => {
          if (onPoiClickRef.current) onPoiClickRef.current(poi);
        });
        markersRef.current.push(marker);
      });
    }

    // Render Start Pin if available
    const startLatLng = startLocation?.coordinates
      ? { lat: startLocation.coordinates[1], lng: startLocation.coordinates[0] }
      : null;

    if (startLatLng) {
      const startMarker = new window.google.maps.Marker({
        position: startLatLng,
        map: map,
        title: startLocation?.name || 'Start Location',
        zIndex: 50,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#6366f1',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });
      markersRef.current.push(startMarker);
      if (!navMarkerRef.current) {
        map.panTo(startLatLng);
      }
    }

    if (!destination) return;

    const endLatLng = { lat: destination.coordinates[1], lng: destination.coordinates[0] };

    // Destination circle marker
    const endMarker = new window.google.maps.Marker({
      position: endLatLng,
      map: map,
      title: destination.name,
      zIndex: 50,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#06b6d4',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
    });
    markersRef.current.push(endMarker);

    // Center on start location and zoom in close when route is decided, as requested
    if (startLatLng && !hasFittedBoundsRef.current) {
      map.setCenter(startLatLng);
      map.setZoom(15);
      hasFittedBoundsRef.current = true;
      setAutoFollow(true); // Reset auto-follow when a new route is decided
    }


    // Draw only the currently selected route on the map
    if (routeOptions && routeOptions.length > 0) {
      const route = routeOptions[selectedRouteIndex];
      // Safety: skip if route or geometry is missing/invalid
      if (!route || !route.geometry || route.geometry.length < 2) return;

      const baseRouteColor = '#3b82f6'; // Royal Blue road color
      let trafficColor = '#10b981'; // Green (smooth) default
      if (route.trafficStatus === 'moderate') {
        trafficColor = '#f59e0b'; // Amber/Orange
      } else if (route.trafficStatus === 'heavy') {
        trafficColor = '#ef4444'; // Red
      } else if (route.trafficStatus === 'blocked') {
        trafficColor = '#7f1d1d'; // Maroon
      }

      const pathCoords = route.geometry.map(coord => ({ lat: coord[1], lng: coord[0] }));

      // Dashed connector: start marker → first route point
      if (startLatLng && pathCoords.length > 0) {
        const startConnector = new window.google.maps.Polyline({
          path: [startLatLng, pathCoords[0]],
          geodesic: true,
          strokeColor: baseRouteColor,
          strokeOpacity: 0.7,
          strokeWeight: 2,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
            offset: '0', repeat: '10px',
          }],
          map, zIndex: 15,
        });
        polylinesRef.current.push(startConnector);
      }

      // Dashed connector: last route point → destination marker
      if (pathCoords.length > 0) {
        const endConnector = new window.google.maps.Polyline({
          path: [pathCoords[pathCoords.length - 1], endLatLng],
          geodesic: true,
          strokeColor: baseRouteColor,
          strokeOpacity: 0.7,
          strokeWeight: 2,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
            offset: '0', repeat: '10px',
          }],
          map, zIndex: 15,
        });
        polylinesRef.current.push(endConnector);
      }

      // 1. White outline backdrop (widest)
      const outlinePoly = new window.google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeColor: '#ffffff',
        strokeOpacity: 0.6,
        strokeWeight: 12,
        map, zIndex: 10,
      });
      polylinesRef.current.push(outlinePoly);

      // 2. Base route path (thicker Royal Blue road representation)
      const baseRoutePoly = new window.google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeColor: baseRouteColor,
        strokeOpacity: 1.0,
        strokeWeight: 7,
        map, zIndex: 20,
      });
      baseRoutePoly.addListener('click', () => {
        if (onRouteSelectedRef.current) {
          onRouteSelectedRef.current(selectedRouteIndex);
        }
      });
      polylinesRef.current.push(baseRoutePoly);

      // 3. Inner traffic line (drawn exactly in the middle of the road)
      const trafficPoly = new window.google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeColor: trafficColor,
        strokeOpacity: 1.0,
        strokeWeight: 3,
        map, zIndex: 30,
      });
      trafficPoly.addListener('click', () => {
        if (onRouteSelectedRef.current) {
          onRouteSelectedRef.current(selectedRouteIndex);
        }
      });
      polylinesRef.current.push(trafficPoly);

      // Fit map bounds ONLY when destination or route index genuinely changed
      if (shouldFitBounds) {
        const bounds = new window.google.maps.LatLngBounds();
        pathCoords.forEach(pt => bounds.extend(pt));
        if (startLatLng) bounds.extend(startLatLng);
        if (endLatLng) bounds.extend(endLatLng);
        
        // Capture current perspective before fitBounds flattens it
        const currentTilt = map.getTilt() || 45;
        const currentHeading = map.getHeading() || 0;
        
        map.fitBounds(bounds, { top: 80, right: 40, bottom: 80, left: 40 });
        
        // Restore perspective once bounds-fitting completes and map goes idle
        const once = map.addListener('idle', () => {
          map.setTilt(currentTilt);
          if (currentHeading) {
            map.setHeading(currentHeading);
          }
          once.remove();
        });
      }
    }

  }, [startLocation, destination, routeOptions, selectedRouteIndex, mapLoaded, pois]);

  // Move navigator dot on the map when position updates
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google || !window.google.maps) return;
    if (!navMarkerPos) {
      if (navMarkerRef.current) {
        navMarkerRef.current.setMap(null);
        navMarkerRef.current = null;
      }
      return;
    }

    const latlng = { lat: navMarkerPos[1], lng: navMarkerPos[0] };
    const hasBearing = navMarkerBearing !== undefined && navMarkerBearing !== null;

    const markerIcon = {
      path: hasBearing ? window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW : window.google.maps.SymbolPath.CIRCLE,
      scale: hasBearing ? 8 : 10,
      fillColor: '#3b82f6',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2.5,
      rotation: hasBearing ? navMarkerBearing : 0,
    };

    if (!navMarkerRef.current) {
      navMarkerRef.current = new window.google.maps.Marker({
        position: latlng,
        map: mapRef.current,
        title: 'You are here',
        icon: markerIcon,
        zIndex: 999,
      });
      // First time GPS arrives: zoom to user location at street level
      mapRef.current.panTo(latlng);
      mapRef.current.setZoom(16);
      setTimeout(() => {
        setAutoFollow(true);
      }, 0);
    } else {
      navMarkerRef.current.setPosition(latlng);
      navMarkerRef.current.setIcon(markerIcon);
    }

    // Smoothly pan map to follow the navigator if autoFollow is active
    if (autoFollow) {
      mapRef.current.panTo(latlng);
      if (hasBearing) {
        mapRef.current.setHeading(navMarkerBearing);
        mapRef.current.setTilt(45); // 3D navigation perspective
      }
    }
  }, [navMarkerPos, navMarkerBearing, mapLoaded, autoFollow]);

  // Handle automatic follow reset when route simulation starts/stops
  useEffect(() => {
    if (isRouteSimulationActive) {
      setTimeout(() => {
        setAutoFollow(true);
      }, 0);
      if (mapRef.current && navMarkerPos) {
        const latlng = { lat: navMarkerPos[1], lng: navMarkerPos[0] };
        mapRef.current.setZoom(16);
        mapRef.current.panTo(latlng);
        mapRef.current.setTilt(45);
        if (navMarkerBearing !== null && navMarkerBearing !== undefined) {
          mapRef.current.setHeading(navMarkerBearing);
        }
      }
    } else if (wasSimulationActiveRef.current) {
      // Only reset the camera heading and tilt once when the simulation is explicitly stopped
      if (mapRef.current) {
        mapRef.current.setTilt(0);
        mapRef.current.setHeading(0);
      }
    }
    wasSimulationActiveRef.current = isRouteSimulationActive;
  }, [isRouteSimulationActive, navMarkerPos, navMarkerBearing]);

  // Synchronize Google Map styles dynamically with timeOfDay (day/night cycle) and settings.theme
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google || !window.google.maps) return;

    // Note: Omit calling setOptions({ styles }) because dynamic JS styling is not supported on vector maps.
    // Calling it forces a fallback to raster rendering, which disables tilt and rotation gestures.
  }, [timeOfDay, settings.theme, mapLoaded]);

  // Handle active amenity searches around map center
  useEffect(() => {
    if (!activeAmenitySearch || !mapRef.current || !window.google || !window.google.maps) {
      return;
    }

    const { type } = activeAmenitySearch;
    const map = mapRef.current;
    const center = map.getCenter();
    if (!center) return;

    const googleTypes = {
      petrol: 'gas_station',
      restaurant: 'restaurant',
      hotel: 'lodging',
      hospital: 'hospital'
    };

    const googleType = googleTypes[type];

    // If Places API is loaded, do a real search
    if (window.google.maps.places) {
      try {
        const service = new window.google.maps.places.PlacesService(map);
        service.nearbySearch(
          {
            location: center,
            radius: 5000, // 5km search radius
            type: [googleType]
          },
          (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
              const list = results.map(r => ({
                name: r.name,
                type: type,
                coordinates: [r.geometry.location.lng(), r.geometry.location.lat()]
              }));
              if (onPoisFoundRef.current) {
                onPoisFoundRef.current(list);
              }
            } else {
              console.warn('Google Places nearby search returned status:', status);
              if (onAmenitiesSearchFallbackRef.current) {
                onAmenitiesSearchFallbackRef.current(type, [center.lng(), center.lat()]);
              }
            }
          }
        );
        return;
      } catch (e) {
        console.error('Failed to execute Google Places nearby search:', e);
      }
    }

    // Fallback if places library is not loaded
    if (onAmenitiesSearchFallbackRef.current) {
      onAmenitiesSearchFallbackRef.current(type, [center.lng(), center.lat()]);
    }
  }, [activeAmenitySearch]);

  // Weather Animations Loop (HTML5 Canvas overlay)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const rainCount = 120;
    const rainParticles = [];
    for (let i = 0; i < rainCount; i++) {
      rainParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        length: Math.random() * 20 + 10,
        speed: Math.random() * 10 + 10,
        opacity: Math.random() * 0.4 + 0.1,
      });
    }

    const fogCount = 8;
    const fogParticles = [];
    for (let i = 0; i < fogCount; i++) {
      fogParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.random() * 0.4 - 0.2,
        vy: Math.random() * 0.2 - 0.1,
        radius: Math.random() * 150 + 100,
        opacity: Math.random() * 0.15 + 0.05,
      });
    }

    const render = () => {
      const offsetWidth = canvas.offsetWidth;
      const offsetHeight = canvas.offsetHeight;
      if (canvas.width !== offsetWidth || canvas.height !== offsetHeight) {
        canvas.width = offsetWidth;
        canvas.height = offsetHeight;
        const oldWidth = width;
        width = offsetWidth;
        height = offsetHeight;

        if (oldWidth === 0 && width > 0) {
          rainParticles.forEach(p => {
            p.x = Math.random() * width;
            p.y = Math.random() * height;
          });
          fogParticles.forEach(p => {
            p.x = Math.random() * width;
            p.y = Math.random() * height;
          });
        }
      }

      ctx.clearRect(0, 0, width, height);

      // Rain rendering
      if (weather === 'rain') {
        ctx.strokeStyle = 'rgba(156, 163, 175, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';

        for (let i = 0; i < rainParticles.length; i++) {
          const p = rainParticles[i];
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 2, p.y + p.length);
          ctx.stroke();

          p.y += p.speed;
          p.x -= 0.5;

          if (p.y > height) {
            p.y = -p.length;
            p.x = Math.random() * width;
          }
        }
      }

      // Fog rendering
      if (weather === 'fog') {
        for (let i = 0; i < fogParticles.length; i++) {
          const p = fogParticles[i];
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          let colorTheme = settings.theme === 'dark' ? '255, 255, 255' : '200, 200, 200';
          grad.addColorStop(0, `rgba(${colorTheme}, ${p.opacity})`);
          grad.addColorStop(1, `rgba(${colorTheme}, 0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();

          p.x += p.vx;
          p.y += p.vy;

          if (p.x - p.radius > width) p.x = -p.radius;
          if (p.x + p.radius < 0) p.x = width + p.radius;
          if (p.y - p.radius > height) p.y = -p.radius;
          if (p.y + p.radius < 0) p.y = height + p.radius;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [weather, settings.theme]);

  return (
    <div style={styles.container}>
      {/* Route Calculation/Switching Map Overlay */}
      {(isRoutesLoading || isRouteSwitching) && (
        <div style={styles.mapLoaderOverlay}>
          <div style={styles.mapLoaderCard}>
            <div className="route-switch-spinner" />
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              {isRoutesLoading ? 'Calculating optimal paths...' : 'Recalculating traffic telemetry...'}
            </span>
          </div>
        </div>
      )}

      {gmapsError ? (
        <div style={styles.errorBanner}>
          <h3>Google Maps API Error</h3>
          <span>Please make sure your Google Maps SDK Key is correct, or check your internet connection.</span>
        </div>
      ) : (
        <div ref={mapContainerRef} style={styles.mapContainer} />
      )}

      {/* Floating Canvas Weather Overlay */}
      <canvas ref={canvasRef} className="weather-overlay" />

      {/* Time Cycle CSS Overlay */}
      <div 
        className="time-overlay" 
        style={{ backgroundColor: timeOverlays[timeOfDay] }} 
      />

      {/* Map Control Widget: Weather & Day/Night Toggle (Shown conditionally) */}
      {isWeatherPanelOpen && (
        <div 
          className="glass-panel weather-widget-responsive" 
          style={styles.weatherWidget}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Panel Button */}
          <button 
            onClick={() => setIsWeatherPanelOpen(false)}
            style={styles.closeWidgetBtn}
            className="weather-close-btn"
            title="Close Settings"
          >
            <X size={16} />
          </button>

          {/* Live Auto badge — top line, always visible */}
          {settings.openWeatherKey && (
            <div style={{ marginBottom: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.68rem',
                  fontWeight: '800',
                  color: 'var(--traffic-smooth)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  padding: '3px 8px',
                  borderRadius: '20px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
                title="Live Weather & Day-Night cycle syncing automatically via OpenWeatherMap"
              >
                🟢 Live · Auto
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ ...styles.widgetHeader, marginBottom: 0 }}>Climate & Time Engine</span>
          </div>
          
          <div style={styles.widgetGroup}>
            <span style={styles.widgetLabel}>Weather Mode:</span>
            <div style={styles.btnRow}>
              {['clear', 'rain', 'fog'].map((w) => (
                <button
                  key={w}
                  style={{
                    ...styles.widgetBtn,
                    background: weather === w ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                    color: weather === w ? '#ffffff' : 'var(--text-secondary)',
                    borderColor: weather === w ? 'var(--primary)' : 'var(--border-color)',
                  }}
                  onClick={() => setWeather(w)}
                >
                  {w === 'clear' && <Sun size={14} />}
                  {w === 'rain' && <CloudRain size={14} />}
                  {w === 'fog' && <Compass size={14} />}
                  <span style={{ textTransform: 'capitalize' }}>{w}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={styles.widgetGroup}>
            <span style={styles.widgetLabel}>Day-Night Cycle:</span>
            <div style={styles.btnRow}>
              {['day', 'sunrise', 'sunset', 'night'].map((t) => (
                <button
                  key={t}
                  style={{
                    ...styles.widgetBtn,
                    background: timeOfDay === t ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                    color: timeOfDay === t ? '#ffffff' : 'var(--text-secondary)',
                    borderColor: timeOfDay === t ? 'var(--primary)' : 'var(--border-color)',
                  }}
                  onClick={() => setTimeOfDay(t)}
                >
                  {t === 'day' && <Sun size={14} />}
                  {t === 'sunrise' && <Sunrise size={14} />}
                  {t === 'sunset' && <Sunset size={14} />}
                  {t === 'night' && <Moon size={14} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Weather Trigger Button (Pill on desktop, circle icon on mobile) */}
      {!isWeatherPanelOpen && (
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent map click listener from firing
            setIsWeatherPanelOpen(true);
          }}
          className="glass-panel glow-btn weather-trigger-btn"
          style={styles.weatherTriggerBtn}
          title="Adjust Weather & Time Cycles"
        >
          <CloudSun size={18} />
          <span className="weather-trigger-text">Climate Engine</span>
        </button>
      )}

      {/* Map Perspective & Navigation Controls Stack */}
      <div className="map-controls-stack" style={styles.controlsStack}>
        {navMarkerPos && (
          <button
            onClick={() => {
              setAutoFollow(true);
              if (mapRef.current && navMarkerPos) {
                const latlng = { lat: navMarkerPos[1], lng: navMarkerPos[0] };
                mapRef.current.panTo(latlng);
                mapRef.current.setZoom(16);
              }
            }}
            className="glass-panel map-control-btn recenter-btn-responsive"
            title="Recenter Map"
          >
            🎯 <span className="control-btn-text">Recenter</span>
          </button>
        )}

        <button
          onClick={() => {
            if (mapRef.current) {
              const currentHeading = mapRef.current.getHeading() || 0;
              mapRef.current.setHeading((currentHeading + 45) % 360);
            }
          }}
          className="glass-panel map-control-btn"
          title="Rotate Map 45°"
        >
          <RotateCw size={14} /> <span className="control-btn-text">Rotate</span>
        </button>

        <button
          onClick={() => {
            if (mapRef.current) {
              const currentTilt = mapRef.current.getTilt() || 0;
              // Toggle between 2D (0 tilt) and 3D (45 tilt)
              mapRef.current.setTilt(currentTilt === 0 ? 45 : 0);
            }
          }}
          className="glass-panel map-control-btn"
          title="Toggle 2D/3D Perspective"
        >
          <Box size={14} /> <span className="control-btn-text">3D view</span>
        </button>
      </div>

      {/* Floating Routing Engine Status Indicator */}
      {destination && (
        <div
          className="glass-panel routing-status-responsive"
          style={styles.routingStatusBanner}
        >
          <div style={styles.statusRow}>
            {(!isNetworkOnline || routingError) ? (
              <>
                <span className="status-dot offline" />
                <span style={{ fontWeight: '700', fontSize: '0.75rem', color: '#f87171' }}>Offline</span>
              </>
            ) : (
              <>
                <span className="status-dot online" />
                <span style={{ fontWeight: '700', fontSize: '0.75rem', color: 'var(--traffic-smooth)' }}>Online</span>
              </>
            )}
          </div>
          {(!isNetworkOnline || routingError) && (
            <div style={styles.statusErrorText} title={routingError || "Network offline"}>
              {routingError 
                ? (routingError.length > 50 ? routingError.substring(0, 47) + '...' : routingError)
                : "Network offline"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    flex: 1,
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },
  mapContainer: {
    width: '100%',
    height: '100%',
  },
  errorBanner: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    padding: '24px',
    textAlign: 'center',
  },
  weatherWidget: {
    position: 'absolute',
    bottom: '20px',
    left: '20px',
    padding: '16px 20px',
    zIndex: 100,
    width: '280px',
  },
  widgetHeader: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  widgetGroup: {
    marginBottom: '12px',
  },
  widgetLabel: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  },
  btnRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  widgetBtn: {
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600',
    border: '1px solid',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'var(--transition-smooth)',
  },
  controlsStack: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 1000,
  },
  routingStatusBanner: {
    position: 'absolute',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '6px 12px',
    borderRadius: '20px',
    zIndex: 1000,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-glass)',
    color: 'var(--text-primary)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    maxWidth: '90%',
    width: 'auto',
    textAlign: 'center',
    transition: 'all 0.3s ease',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
  },
  statusErrorText: {
    fontSize: '0.65rem',
    color: '#ef4444',
    marginTop: '2px',
    fontWeight: '600',
  },
  mapLoaderOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.35)',
    backdropFilter: 'blur(3px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition-smooth)',
  },
  mapLoaderCard: {
    padding: '20px 24px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    boxShadow: 'var(--shadow-lg)',
    backgroundColor: 'var(--bg-glass)',
    border: '1px solid var(--border-color)',
    maxWidth: '280px',
    textAlign: 'center',
  },
  closeWidgetBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition-smooth)',
  },
  weatherTriggerBtn: {
    position: 'absolute',
    bottom: '20px',
    left: '20px',
    padding: '10px 16px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    zIndex: 100,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(30,41,59,0.85)',
    color: '#ffffff',
    backdropFilter: 'blur(8px)',
    transition: 'var(--transition-smooth)',
  },
};
