import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { CloudRain, Compass, Eye, EyeOff, Sun, Moon, Sunrise, Sunset } from 'lucide-react';

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
  onPoiClick
}) {
  const mapContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const routeLayersRef = useRef([]);
  const [mapError, setMapError] = useState(false);
  const [simulationCoords, setSimulationCoords] = useState(null);

  // Day-Night Cycle color maps (applied as a multiplying screen overlay over the map)
  const timeOverlays = {
    day: 'rgba(0, 0, 0, 0)',
    sunrise: 'rgba(251, 146, 60, 0.15)', // warm orange
    sunset: 'rgba(124, 58, 237, 0.2)',  // violet / indigo sunset
    night: 'rgba(15, 23, 42, 0.45)',     // dark night filter
  };

  // Initialize Mapbox map or fallback to simulation mode
  useEffect(() => {
    if (!settings.mapboxKey) {
      setMapError(true);
      return;
    }

    try {
      mapboxgl.accessToken = settings.mapboxKey;
      
      const themeStyle = settings.theme === 'dark' 
        ? 'mapbox://styles/mapbox/dark-v11' 
        : 'mapbox://styles/mapbox/light-v11';

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: themeStyle,
        center: [77.2090, 28.6139], // Default New Delhi
        zoom: 12,
        pitch: 45, // 3D effect
      });

      map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
      mapRef.current = map;
      setMapError(false);

      map.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError(true); // Switch to simulation on invalid token
      });

      return () => {
        map.remove();
        mapRef.current = null;
      };
    } catch (err) {
      console.error(err);
      setMapError(true);
    }
  }, [settings.mapboxKey, settings.theme]);

  // Handle markers and route plotting on Mapbox map
  useEffect(() => {
    if (mapError || !mapRef.current) return;
    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add POIs
    if (pois && pois.length > 0) {
      pois.forEach(poi => {
        const el = document.createElement('div');
        el.className = 'amenity-marker';
        el.innerHTML = poi.type === 'petrol' ? '⛽' : poi.type === 'restaurant' ? '🍔' : poi.type === 'hotel' ? '🏨' : '🏥';
        el.addEventListener('click', () => onPoiClick(poi));

        const marker = new mapboxgl.Marker(el)
          .setLngLat(poi.coordinates)
          .addTo(map);
        markersRef.current.push(marker);
      });
    }

    // Add Start Marker
    if (startLocation && startLocation.coordinates) {
      const el = document.createElement('div');
      el.className = 'custom-marker';
      const startMarker = new mapboxgl.Marker(el)
        .setLngLat(startLocation.coordinates)
        .addTo(map);
      markersRef.current.push(startMarker);
    }

    // Add Destination Marker
    if (destination && destination.coordinates) {
      const el = document.createElement('div');
      el.className = 'custom-marker destination';
      const destMarker = new mapboxgl.Marker(el)
        .setLngLat(destination.coordinates)
        .addTo(map);
      markersRef.current.push(destMarker);
    }

    // Auto-bounds mapping if we have points
    if (startLocation?.coordinates && destination?.coordinates) {
      const bounds = new mapboxgl.LngLatBounds()
        .extend(startLocation.coordinates)
        .extend(destination.coordinates);
      map.fitBounds(bounds, { padding: 80 });
    }

    // Draw Routes
    map.on('style.load', () => {
      drawRoutesOnMap();
    });

    if (map.isStyleLoaded()) {
      drawRoutesOnMap();
    }

    function drawRoutesOnMap() {
      // Clear previous layers & sources
      routeLayersRef.current.forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      });
      routeLayersRef.current = [];

      if (!routeOptions || routeOptions.length === 0) return;

      routeOptions.forEach((route, idx) => {
        const sourceId = `route-source-${idx}`;
        const layerId = `route-layer-${idx}`;
        const layerOutlineId = `route-layer-outline-${idx}`;

        const isSelected = idx === selectedRouteIndex;

        // Route color based on traffic or selection status
        let routeColor = 'var(--traffic-smooth)';
        if (route.trafficStatus === 'moderate') routeColor = 'var(--traffic-moderate)';
        if (route.trafficStatus === 'heavy') routeColor = 'var(--traffic-heavy)';
        if (route.trafficStatus === 'blocked') routeColor = 'var(--traffic-blocked)';

        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: route.geometry,
            },
          },
        });

        // Add outline layer for selected route
        if (isSelected) {
          map.addLayer({
            id: layerOutlineId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#ffffff',
              'line-width': 8,
              'line-opacity': 0.8,
            },
          });
          routeLayersRef.current.push(layerOutlineId);
        }

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': isSelected ? routeColor : 'rgba(148, 163, 184, 0.6)',
            'line-width': isSelected ? 5 : 4,
          },
        });

        routeLayersRef.current.push(layerId);

        // Click to select route
        map.on('click', layerId, () => {
          onRouteSelected(idx);
        });
      });
    }

  }, [startLocation, destination, routeOptions, selectedRouteIndex, mapError, pois]);

  // Weather Animations Loop (HTML5 Canvas)
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

    // Rain Particles
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

    // Fog Particles
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

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Rain rendering
      if (weather === 'rain') {
        ctx.strokeStyle = 'rgba(156, 163, 175, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';

        for (let i = 0; i < rainParticles.length; i++) {
          const p = rainParticles[i];
          ctx.beginPath();
          // Diagonal rain falling
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 2, p.y + p.length);
          ctx.stroke();

          // Update position
          p.y += p.speed;
          p.x -= 0.5;

          // Recycle drop
          if (p.y > height) {
            p.y = -p.length;
            p.x = Math.random() * width;
          }
        }
      }

      // 2. Fog rendering
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

          // Update fog drift
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

  // Simulation mode route rendering (when Mapbox is disabled or failed)
  // Let's render a beautiful Canvas-based network graph inside the main viewport.
  const renderSimulationMap = () => {
    const simCanvasRef = useRef(null);
    const [vehicles, setVehicles] = useState([]);

    useEffect(() => {
      const canvas = simCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let animeId;

      let w = (canvas.width = canvas.offsetWidth);
      let h = (canvas.height = canvas.offsetHeight);

      const handleResize = () => {
        if (!canvas) return;
        w = canvas.width = canvas.offsetWidth;
        h = canvas.height = canvas.offsetHeight;
      };
      window.addEventListener('resize', handleResize);

      // Define static city landmarks and roads
      const landmarks = {
        delhi: { x: w * 0.25, y: h * 0.45, name: 'Connaught Place' },
        noida: { x: w * 0.75, y: h * 0.65, name: 'Noida Sector 62' },
        gurugram: { x: w * 0.20, y: h * 0.75, name: 'Cyber City' },
        airport: { x: w * 0.15, y: h * 0.60, name: 'IGI Airport' },
        ghaziabad: { x: w * 0.80, y: h * 0.35, name: 'Vasundhara' },
        dwarka: { x: w * 0.10, y: h * 0.40, name: 'Dwarka Sec 21' },
      };

      // Generate animated cars along paths
      const initVehicles = [];
      for (let i = 0; i < 35; i++) {
        initVehicles.push({
          progress: Math.random(),
          speed: Math.random() * 0.002 + 0.001,
          routeIndex: Math.floor(Math.random() * (routeOptions?.length || 3)),
          color: ['#10b981', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 3)]
        });
      }

      const drawGrid = () => {
        ctx.strokeStyle = settings.theme === 'dark' ? 'rgba(51, 65, 85, 0.15)' : 'rgba(226, 232, 240, 0.5)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < w; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      };

      const getRoutePoints = (routeIdx, width, height) => {
        // Generates coordinates for mock routes
        const startX = width * 0.25;
        const startY = height * 0.5;
        const endX = width * 0.75;
        const endY = height * 0.5;

        if (routeIdx === 0) {
          // Route A: Smooth Straight Highway
          return [
            { x: startX, y: startY },
            { x: width * 0.4, y: startY - 20 },
            { x: width * 0.6, y: startY - 20 },
            { x: endX, y: endY }
          ];
        } else if (routeIdx === 1) {
          // Route B: Moderate Ring Road
          return [
            { x: startX, y: startY },
            { x: width * 0.35, y: startY + 60 },
            { x: width * 0.55, y: startY + 80 },
            { x: width * 0.65, y: startY + 40 },
            { x: endX, y: endY }
          ];
        } else {
          // Route C: Heavy City Streets
          return [
            { x: startX, y: startY },
            { x: width * 0.3, y: startY - 80 },
            { x: width * 0.5, y: startY - 100 },
            { x: width * 0.7, y: startY - 50 },
            { x: endX, y: endY }
          ];
        }
      };

      const drawBezierRoute = (points, isSelected, trafficStatus) => {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }

        let routeColor = 'var(--traffic-smooth)';
        if (trafficStatus === 'moderate') routeColor = 'var(--traffic-moderate)';
        if (trafficStatus === 'heavy') routeColor = 'var(--traffic-heavy)';
        if (trafficStatus === 'blocked') routeColor = 'var(--traffic-blocked)';

        ctx.strokeStyle = isSelected ? routeColor : 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = isSelected ? 8 : 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        // Inner glowing white core for selected route
        if (isSelected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      };

      const getPointOnPath = (points, progress) => {
        // Line segments interpolation
        const segmentCount = points.length - 1;
        const segmentProgress = progress * segmentCount;
        const index = Math.min(Math.floor(segmentProgress), segmentCount - 1);
        const t = segmentProgress - index;

        const p1 = points[index];
        const p2 = points[index + 1];

        return {
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t
        };
      };

      const loop = () => {
        ctx.fillStyle = settings.theme === 'dark' ? '#0b0f19' : '#f1f5f9';
        ctx.fillRect(0, 0, w, h);

        drawGrid();

        // Draw general backdrop roadways representing a city map grid
        ctx.strokeStyle = settings.theme === 'dark' ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.9)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        // Inner Ring Road
        ctx.arc(w * 0.5, h * 0.5, Math.min(w, h) * 0.3, 0, Math.PI * 2);
        ctx.stroke();

        // Radial highways
        ctx.beginPath();
        ctx.moveTo(w * 0.1, h * 0.1); ctx.lineTo(w * 0.9, h * 0.9);
        ctx.moveTo(w * 0.9, h * 0.1); ctx.lineTo(w * 0.1, h * 0.9);
        ctx.stroke();

        // Draw landmarks
        Object.entries(landmarks).forEach(([key, lm]) => {
          ctx.fillStyle = settings.theme === 'dark' ? '#1e293b' : '#ffffff';
          ctx.strokeStyle = 'var(--primary)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(lm.x, lm.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = 'var(--text-secondary)';
          ctx.font = '10px var(--font-sans)';
          ctx.fillText(lm.name, lm.x - 30, lm.y - 12);
        });

        // Draw active routes (Alternative Routes)
        if (routeOptions && routeOptions.length > 0) {
          routeOptions.forEach((r, idx) => {
            const points = getRoutePoints(idx, w, h);
            drawBezierRoute(points, idx === selectedRouteIndex, r.trafficStatus);
          });
        }

        // Draw and update moving traffic vehicles
        initVehicles.forEach((car) => {
          car.progress += car.speed;
          if (car.progress > 1) {
            car.progress = 0;
            car.routeIndex = Math.floor(Math.random() * (routeOptions?.length || 3));
          }

          const points = getRoutePoints(car.routeIndex, w, h);
          const pos = getPointOnPath(points, car.progress);

          ctx.fillStyle = car.color;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw start / destination pins on simulation screen
        const startX = w * 0.25;
        const startY = h * 0.5;
        const endX = w * 0.75;
        const endY = h * 0.5;

        // Start Node Glow
        ctx.fillStyle = 'var(--primary)';
        ctx.beginPath();
        ctx.arc(startX, startY, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Destination Node Glow
        ctx.fillStyle = 'var(--accent)';
        ctx.beginPath();
        ctx.arc(endX, endY, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Labels
        ctx.fillStyle = 'var(--text-primary)';
        ctx.font = 'bold 12px var(--font-sans)';
        ctx.fillText(startLocation ? startLocation.name : 'Start Location', startX - 40, startY + 24);
        ctx.fillText(destination ? destination.name : 'Destination', endX - 30, endY + 24);

        // Draw search POI markers in simulation mode
        if (pois && pois.length > 0) {
          pois.forEach((poi, index) => {
            // Map POI coordinates coordinates [lng, lat] to screen points in simulation
            const pX = w * 0.45 + (index * 60) - 90;
            const pY = h * 0.6 + (index * 40 % 80);

            ctx.fillStyle = '#ef4444';
            ctx.font = '16px serif';
            const icon = poi.type === 'petrol' ? '⛽' : poi.type === 'restaurant' ? '🍔' : poi.type === 'hotel' ? '🏨' : '🏥';
            ctx.fillText(icon, pX - 8, pY);

            ctx.fillStyle = 'var(--text-secondary)';
            ctx.font = '9px var(--font-sans)';
            ctx.fillText(poi.name, pX - 20, pY + 12);
          });
        }

        animeId = requestAnimationFrame(loop);
      };

      loop();

      return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animeId);
      };
    }, [routeOptions, selectedRouteIndex, settings.theme, pois]);

    return (
      <div style={styles.simContainer}>
        <canvas ref={simCanvasRef} style={styles.simCanvas} />
        <div className="glass-panel" style={styles.simBanner}>
          <div style={styles.simPulse} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={styles.simTitle}>Simulation Radar Enabled</span>
            <span style={styles.simDesc}>Enter a Mapbox API Key in Settings to enable real-world dynamic 3D tiles.</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* Real Map or Simulation Map */}
      {mapError ? (
        renderSimulationMap()
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
      <div className="glass-panel" style={styles.weatherWidget}>
        <span style={styles.widgetHeader}>Climate & Time Engine</span>
        
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
  simContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  simCanvas: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
  simBanner: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    padding: '16px 20px',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    maxWidth: '380px',
  },
  simPulse: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#06b6d4',
    boxShadow: '0 0 0 0 rgba(6, 182, 212, 0.7)',
    animation: 'pulseGlow 2s infinite',
    flexShrink: 0,
  },
  simTitle: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  simDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.3',
    marginTop: '2px',
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
};
