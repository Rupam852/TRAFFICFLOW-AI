import React, { useEffect, useRef, useState } from 'react';
import { CloudRain, Compass, Sun, Moon, Sunrise, Sunset } from 'lucide-react';

// Sleek Custom Dark Mode Styles for Google Maps
const googleMapsDarkStyles = [
  { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1e293b" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e1" }]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }]
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#0f172a" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#334155" }]
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1e293b" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#475569" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1e293b" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0f172a" }]
  }
];

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
  const polylinesRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [gmapsError, setGmapsError] = useState(false);

  const timeOverlays = {
    day: 'rgba(0, 0, 0, 0)',
    sunrise: 'rgba(251, 146, 60, 0.15)', // warm orange
    sunset: 'rgba(124, 58, 237, 0.2)',  // violet sunset
    night: 'rgba(15, 23, 42, 0.45)',     // dark night
  };

  // Load Google Maps JavaScript SDK
  useEffect(() => {
    const initGoogleMap = () => {
      if (!mapContainerRef.current) return;

      try {
        const themeStyles = settings.theme === 'dark' ? googleMapsDarkStyles : [];

        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: { lat: 28.6139, lng: 77.2090 }, // New Delhi Default
          zoom: 12,
          styles: themeStyles,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        // Enable real-time traffic highlights via Google's Traffic Layer
        const trafficLayer = new window.google.maps.TrafficLayer();
        trafficLayer.setMap(map);

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
      const existingScript = document.getElementById('google-maps-sdk');
      if (existingScript) {
        existingScript.onload = () => initGoogleMap();
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-sdk';
      // Load public SDK keyless if key is missing
      script.src = `https://maps.googleapis.com/maps/api/js?key=${settings.googleMapsKey || ''}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initGoogleMap();
      };
      script.onerror = () => {
        setGmapsError(true);
      };
      document.head.appendChild(script);
    }
  }, [settings.theme, settings.googleMapsKey]);

  // Handle drawing markers, routes, and POIs on the Google Map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

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

        marker.addListener('click', () => onPoiClick(poi));
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
        title: startLocation?.name || "Start Location",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#4f46e5',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        }
      });
      markersRef.current.push(startMarker);
      map.panTo(startLatLng);
    }

    if (!destination) return;

    const endLatLng = { lat: destination.coordinates[1], lng: destination.coordinates[0] };

    const endMarker = new window.google.maps.Marker({
      position: endLatLng,
      map: map,
      title: destination.name,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#06b6d4',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      }
    });
    markersRef.current.push(endMarker);

    // Fit map bounds
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(startLatLng);
    bounds.extend(endLatLng);
    map.fitBounds(bounds);

    // Draw Calculated Alternative Routes
    if (routeOptions && routeOptions.length > 0) {
      routeOptions.forEach((route, idx) => {
        const isSelected = idx === selectedRouteIndex;

        let routeColor = 'var(--traffic-smooth)';
        if (route.trafficStatus === 'moderate') routeColor = 'var(--traffic-moderate)';
        if (route.trafficStatus === 'heavy') routeColor = 'var(--traffic-heavy)';
        if (route.trafficStatus === 'blocked') routeColor = 'var(--traffic-blocked)';

        const pathCoords = route.geometry.map(coord => ({ lat: coord[1], lng: coord[0] }));

        // Outline white backdrop for selected route
        if (isSelected) {
          const outlinePoly = new window.google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor: '#ffffff',
            strokeOpacity: 0.7,
            strokeWeight: 8,
            map: map,
            zIndex: 10
          });
          polylinesRef.current.push(outlinePoly);
        }

        const poly = new window.google.maps.Polyline({
          path: pathCoords,
          geodesic: true,
          strokeColor: isSelected ? routeColor : 'rgba(148, 163, 184, 0.5)',
          strokeOpacity: isSelected ? 1.0 : 0.6,
          strokeWeight: isSelected ? 5 : 4,
          map: map,
          zIndex: isSelected ? 20 : 5
        });

        // Toggle selected route on line click
        poly.addListener('click', () => {
          onRouteSelected(idx);
        });

        polylinesRef.current.push(poly);
      });
    }

  }, [startLocation, destination, routeOptions, selectedRouteIndex, mapLoaded, pois]);

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

      {/* Map Control Widget: Weather & Day/Night Toggle */}
      <div className="glass-panel" style={styles.weatherWidget}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ ...styles.widgetHeader, marginBottom: 0 }}>Climate & Time Engine</span>
          {settings.openWeatherKey && (
            <span 
              style={{ 
                fontSize: '0.65rem', 
                color: 'var(--traffic-smooth)', 
                fontWeight: '800', 
                textTransform: 'uppercase', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
              title="Live Weather & Day-Night cycle syncing automatically via OpenWeatherMap"
            >
              🟢 Live Auto
            </span>
          )}
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
};
