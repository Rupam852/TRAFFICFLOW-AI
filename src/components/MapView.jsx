import { useEffect, useRef, useState } from 'react';
import { CloudRain, Compass, Sun, Moon, Sunrise, Sunset, X, CloudSun, RotateCw, Box } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function MapView({
  settings,
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
  const navMarkerRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxError, setMapboxError] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [isNetworkOnline, setIsNetworkOnline] = useState(navigator.onLine);
  const [styleLoadedTrigger, setStyleLoadedTrigger] = useState(0);

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

  // Initialize Mapbox GL JS map
  useEffect(() => {
    if (!settings.mapboxKey || !mapContainerRef.current) return;

    try {
      mapboxgl.accessToken = settings.mapboxKey;
      
      const style = settings.theme === 'light' ? 'mapbox://styles/mapbox/navigation-day-v1' : 'mapbox://styles/mapbox/navigation-night-v1';
      
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: style,
        center: [77.2090, 28.6139], // New Delhi Default (lng, lat)
        zoom: 11,
        pitch: 45, // default premium 3D tilt
        bearing: 0,
        antialias: true
      });

      map.on('load', () => {
        mapRef.current = map;
        setMapLoaded(true);
        setMapboxError(false);
      });

      map.on('style.load', () => {
        setStyleLoadedTrigger(prev => prev + 1);
      });

      map.on('click', (e) => {
        // If clicked directly on map and not on layers
        setIsWeatherPanelOpen(false);
        if (onMapClickRef.current) onMapClickRef.current();
      });

      map.on('dragstart', () => {
        setAutoFollow(false);
      });

      map.on('moveend', () => {
        const center = map.getCenter();
        if (center && onMapCenterChangeRef.current) {
          onMapCenterChangeRef.current([center.lng, center.lat]);
        }
      });

      return () => {
        map.remove();
        mapRef.current = null;
        setMapLoaded(false);
      };
    } catch (err) {
      console.error('Failed to instantiate Mapbox GL JS Map:', err);
      setMapboxError(true);
    }
  }, [settings.mapboxKey, settings.theme]);

  // Handle dynamic map style switching on theme changes (avoids destroying/recreating map instance)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const style = settings.theme === 'light' ? 'mapbox://styles/mapbox/navigation-day-v1' : 'mapbox://styles/mapbox/navigation-night-v1';
    mapRef.current.setStyle(style);
  }, [settings.theme, mapLoaded]);

  // Draw routes, markers, and POIs on the Mapbox Map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    // Track if destination or route index changed
    const fitKey = `${destination?.coordinates?.join(',')}_${selectedRouteIndex}`;
    const shouldFitBounds = fitKey !== lastRouteKeyRef.current;
    if (shouldFitBounds) {
      lastRouteKeyRef.current = fitKey;
    }

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Clear old route sources/layers
    if (map.getLayer('route-line')) map.removeLayer('route-line');
    if (map.getLayer('route-outline')) map.removeLayer('route-outline');
    if (map.getSource('route-source')) map.removeSource('route-source');

    // 1. Render Start Pin
    if (startLocation?.coordinates) {
      const el = document.createElement('div');
      el.className = 'start-marker';
      el.style.width = '18px';
      el.style.height = '18px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#6366f1';
      el.style.border = '3px solid #ffffff';
      el.style.boxShadow = '0 0 10px rgba(99,102,241,0.6)';
      
      const m = new mapboxgl.Marker(el)
        .setLngLat(startLocation.coordinates)
        .addTo(map);
      markersRef.current.push(m);

      if (!navMarkerRef.current && shouldFitBounds) {
        map.panTo(startLocation.coordinates);
      }
    }

    // 2. Render Destination Pin
    if (destination?.coordinates) {
      const el = document.createElement('div');
      el.className = 'destination-marker';
      el.style.width = '18px';
      el.style.height = '18px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#06b6d4';
      el.style.border = '3px solid #ffffff';
      el.style.boxShadow = '0 0 10px rgba(6,182,212,0.6)';

      const m = new mapboxgl.Marker(el)
        .setLngLat(destination.coordinates)
        .addTo(map);
      markersRef.current.push(m);
    }

    // 3. Render Amenities POIs
    if (pois && pois.length > 0) {
      pois.forEach(poi => {
        const el = document.createElement('div');
        el.className = 'poi-marker';
        el.style.width = '26px';
        el.style.height = '26px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#ef4444';
        el.style.border = '2px solid #ffffff';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontSize = '12px';
        el.style.cursor = 'pointer';
        el.innerText = poi.type === 'petrol' ? '⛽' : poi.type === 'restaurant' ? '🍔' : poi.type === 'hotel' ? '🏨' : '🏥';

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onPoiClickRef.current) onPoiClickRef.current(poi);
        });

        const m = new mapboxgl.Marker(el)
          .setLngLat(poi.coordinates)
          .addTo(map);
        markersRef.current.push(m);
      });
    }

    // 4. Render Active Route
    if (routeOptions && routeOptions.length > 0) {
      const route = routeOptions[selectedRouteIndex];
      if (route && route.geometry && route.geometry.length >= 2) {
        const pathCoords = route.geometry; // Array of [lng, lat]
        
        // Assemble route features collection (for different traffic colors)
        const features = [];
        if (route.trafficSegments && route.trafficSegments.length > 0) {
          route.trafficSegments.forEach(seg => {
            features.push({
              type: 'Feature',
              properties: {
                trafficStatus: seg.trafficStatus || 'smooth'
              },
              geometry: {
                type: 'LineString',
                coordinates: seg.geometry
              }
            });
          });
        } else {
          features.push({
            type: 'Feature',
            properties: {
              trafficStatus: route.trafficStatus || 'smooth'
            },
            geometry: {
              type: 'LineString',
              coordinates: pathCoords
            }
          });
        }

        // Add GEOJSON route source
        map.addSource('route-source', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: features
          }
        });

        // 4a. White outline Layer
        map.addLayer({
          id: 'route-outline',
          type: 'line',
          source: 'route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ffffff',
            'line-width': 12,
            'line-opacity': 0.6
          }
        });

        // 4b. Base route path + traffic congestion styling
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': [
              'match',
              ['get', 'trafficStatus'],
              'moderate', '#f59e0b',
              'heavy', '#ef4444',
              'blocked', '#7f1d1d',
              '#3b82f6' // smooth / default
            ],
            'line-width': 7
          }
        });

        // Allow selection/click on route line
        map.on('click', 'route-line', () => {
          if (onRouteSelectedRef.current) {
            onRouteSelectedRef.current(selectedRouteIndex);
          }
        });

        // Fit boundaries smoothly
        if (shouldFitBounds && pathCoords.length > 0) {
          const bounds = new mapboxgl.LngLatBounds();
          pathCoords.forEach(pt => bounds.extend(pt));
          if (startLocation?.coordinates) bounds.extend(startLocation.coordinates);
          if (destination?.coordinates) bounds.extend(destination.coordinates);

          map.fitBounds(bounds, {
            padding: { top: 80, bottom: 80, left: 40, right: 40 },
            duration: 1200
          });
        }
      }
    }
  }, [startLocation, destination, routeOptions, selectedRouteIndex, mapLoaded, pois, styleLoadedTrigger]);

  // Handle GPS location dot rendering and movement
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    if (!navMarkerPos) {
      if (navMarkerRef.current) {
        navMarkerRef.current.remove();
        navMarkerRef.current = null;
      }
      return;
    }

    const hasBearing = navMarkerBearing !== undefined && navMarkerBearing !== null;

    if (!navMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'nav-marker';
      el.style.width = '22px';
      el.style.height = '22px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#3b82f6';
      el.style.border = '3px solid #ffffff';
      el.style.boxShadow = '0 0 14px rgba(59,130,246,0.9)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';

      const arrow = document.createElement('div');
      arrow.className = 'nav-arrow';
      arrow.style.width = '0';
      arrow.style.height = '0';
      arrow.style.borderLeft = '5px solid transparent';
      arrow.style.borderRight = '5px solid transparent';
      arrow.style.borderBottom = '9px solid #ffffff';
      arrow.style.transition = 'transform 0.15s ease';
      arrow.style.display = hasBearing ? 'block' : 'none';
      if (hasBearing) {
        arrow.style.transform = `rotate(${navMarkerBearing}deg)`;
      }
      el.appendChild(arrow);

      navMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat(navMarkerPos)
        .addTo(map);

      map.easeTo({ center: navMarkerPos, zoom: 16 });
      setTimeout(() => {
        setAutoFollow(true);
      }, 0);
    } else {
      navMarkerRef.current.setLngLat(navMarkerPos);
      const arrow = navMarkerRef.current.getElement().querySelector('.nav-arrow');
      if (arrow) {
        if (hasBearing) {
          arrow.style.display = 'block';
          arrow.style.transform = `rotate(${navMarkerBearing}deg)`;
        } else {
          arrow.style.display = 'none';
        }
      }
    }

    if (autoFollow) {
      map.easeTo({ center: navMarkerPos });
      if (hasBearing) {
        map.easeTo({ bearing: navMarkerBearing, pitch: 45 });
      }
    }
  }, [navMarkerPos, navMarkerBearing, mapLoaded, autoFollow]);

  // Adjust map viewport during simulation mode switches
  useEffect(() => {
    if (isRouteSimulationActive) {
      setTimeout(() => {
        setAutoFollow(true);
      }, 0);
      if (mapRef.current && navMarkerPos) {
        mapRef.current.easeTo({
          center: navMarkerPos,
          zoom: 16,
          pitch: 45,
          bearing: navMarkerBearing !== null ? navMarkerBearing : 0
        });
      }
    } else if (wasSimulationActiveRef.current) {
      if (mapRef.current) {
        mapRef.current.easeTo({ pitch: 0, bearing: 0 });
      }
    }
    wasSimulationActiveRef.current = isRouteSimulationActive;
  }, [isRouteSimulationActive, navMarkerPos, navMarkerBearing]);

  // Trigger fallback amenities searches around current map center
  useEffect(() => {
    if (!activeAmenitySearch || !mapRef.current) return;

    const { type } = activeAmenitySearch;
    const center = mapRef.current.getCenter();
    if (center && onAmenitiesSearchFallbackRef.current) {
      // Mapbox centers are lng, lat
      onAmenitiesSearchFallbackRef.current(type, [center.lng, center.lat]);
    }
  }, [activeAmenitySearch]);

  // Weather Canvas Animations Overlay (Rain / Fog effects)
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

      {mapboxError ? (
        <div style={styles.errorBanner}>
          <h3>Mapbox GL JS Loading Error</h3>
          <span>Please make sure your Mapbox Access Token is configured correctly, or check your internet connection.</span>
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

      {/* Map Control Widget: Weather & Day/Night Toggle */}
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

          {/* Live Auto badge */}
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

      {/* Floating Weather Trigger Button */}
      {!isWeatherPanelOpen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
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
                mapRef.current.easeTo({ center: navMarkerPos, zoom: 16 });
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
              const currentBearing = mapRef.current.getBearing() || 0;
              mapRef.current.easeTo({ bearing: (currentBearing + 45) % 360 });
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
              const currentPitch = mapRef.current.getPitch() || 0;
              mapRef.current.easeTo({ pitch: currentPitch === 0 ? 45 : 0 });
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
