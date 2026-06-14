import React, { useEffect, useRef, useState } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function haversineMeters([lng1, lat1], [lng2, lat2]) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtTime(sec) {
  if (sec <= 0) return '0 min';
  const m = Math.max(1, Math.round(sec / 60));
  const days = Math.floor(m / 1440);
  const remainingMinsAfterDays = m % 1440;
  const hours = Math.floor(remainingMinsAfterDays / 60);
  const remainingMins = remainingMinsAfterDays % 60;

  if (days > 0) {
    return hours > 0 ? `${days} day${days > 1 ? 's' : ''} ${hours} hr` : `${days} day${days > 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return remainingMins > 0 ? `${hours} hr ${remainingMins} min` : `${hours} hr`;
  }
  return `${remainingMins} min`;
}

function fmtDist(m) {
  if (m >= 1000) return (m / 1000).toFixed(1) + ' km';
  return Math.round(m) + ' m';
}

/** Snap user to nearest route point, return remaining distance */
function distRemainingOnRoute(routeCoords, userPos) {
  let bestDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < routeCoords.length; i++) {
    const d = haversineMeters(routeCoords[i], userPos);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  let remaining = 0;
  for (let i = bestIdx; i < routeCoords.length - 1; i++) {
    remaining += haversineMeters(routeCoords[i], routeCoords[i + 1]);
  }
  return { remaining, bestIdx };
}

const SPEED_SAMPLES = 5;
const ARRIVAL_RADIUS_M = 40; // metres — considered arrived when within this range

// ── Component ─────────────────────────────────────────────────────────────────

export default function NavigationHUD({
  route,
  travelMode,
  destination,
  onStop,
  onArrived,       // called when user taps "Got it" after arrival — triggers full reset
  onPositionUpdate,
}) {
  const waypoints = route?.geometry || [];

  // Pre-compute total route distance
  const totalDist = useRef(0);
  const tripStartTime = useRef(Date.now());

  useEffect(() => {
    let t = 0;
    for (let i = 1; i < waypoints.length; i++) {
      t += haversineMeters(waypoints[i - 1], waypoints[i]);
    }
    totalDist.current = t;
    tripStartTime.current = Date.now();
  }, [waypoints]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [speed, setSpeed]                   = useState(0);
  const [distRemaining, setDistRemaining]   = useState(0);
  const [arrived, setArrived]               = useState(false);
  const [tripElapsed, setTripElapsed]       = useState(0);   // seconds
  const [gpsStatus, setGpsStatus]           = useState('acquiring');

  const speedBuf  = useRef([]);
  const prevPos   = useRef(null);
  const watchId   = useRef(null);
  const elapsedTimer = useRef(null);

  // ── Elapsed time counter (stops when arrived) ─────────────────────────────
  useEffect(() => {
    if (arrived) {
      clearInterval(elapsedTimer.current);
      return;
    }
    elapsedTimer.current = setInterval(() => {
      setTripElapsed(Math.floor((Date.now() - tripStartTime.current) / 1000));
    }, 1000);
    return () => clearInterval(elapsedTimer.current);
  }, [arrived]);

  // ── GPS watch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus('denied'); return; }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus('ok');
        const { latitude, longitude, speed: gpsSpeedMs } = pos.coords;
        const userCoord = [longitude, latitude];

        // Speed calculation
        let speedMs = 0;
        if (gpsSpeedMs != null && gpsSpeedMs >= 0) {
          speedMs = gpsSpeedMs;
        } else if (prevPos.current) {
          const dt = (pos.timestamp - prevPos.current.timestamp) / 1000;
          if (dt > 0) {
            const dx = haversineMeters(
              [prevPos.current.coords.longitude, prevPos.current.coords.latitude],
              userCoord
            );
            speedMs = dx / dt;
          }
        }

        speedBuf.current.push(speedMs);
        if (speedBuf.current.length > SPEED_SAMPLES) speedBuf.current.shift();
        const avgMs = speedBuf.current.reduce((a, b) => a + b, 0) / speedBuf.current.length;
        setSpeed(Math.round(avgMs * 3.6));

        prevPos.current = pos;

        if (waypoints.length >= 2) {
          const destCoord = waypoints[waypoints.length - 1];
          const distToDest = haversineMeters(userCoord, destCoord);

          if (distToDest <= ARRIVAL_RADIUS_M && !arrived) {
            setArrived(true);
            setDistRemaining(0);
          } else if (!arrived) {
            const { remaining, bestIdx } = distRemainingOnRoute(waypoints, userCoord);
            setDistRemaining(remaining);

            if (onPositionUpdate) {
              const snapPoint = waypoints[bestIdx];
              const nextPoint = waypoints[Math.min(bestIdx + 1, waypoints.length - 1)];
              const rawBearing = Math.atan2(
                nextPoint[0] - snapPoint[0],
                nextPoint[1] - snapPoint[1]
              ) * (180 / Math.PI);
              const bearing = (rawBearing + 360) % 360;
              // Snap navigation cursor to the road geometry path instead of using raw GPS to prevent off-road drifting
              onPositionUpdate(snapPoint, bearing);
            }
          }
        }
      },
      (err) => {
        setGpsStatus(err.code === 1 ? 'denied' : 'acquiring');
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [waypoints, onPositionUpdate, arrived]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const total = totalDist.current || 1;
  const progress = Math.min(1, Math.max(0, 1 - distRemaining / total));
  const modeAvgKmh = { car: 50, motorbike: 65, bicycle: 18, walk: 5 }[travelMode] || 50;
  const effectiveSpeedMs = speed > 2 ? speed / 3.6 : modeAvgKmh / 3.6;
  const timeRemainingS = distRemaining / effectiveSpeedMs;
  const totalDistanceTravelled = total - distRemaining;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.overlay}>

      {/* ── TOP BANNER ── */}
      <div style={S.topBanner}>
        <div style={S.topBannerContent}>
          <span style={S.topBannerIcon}>📍</span>
          <div>
            <div style={S.topDestName}>{destination?.name || 'Destination'}</div>
            <div style={S.topBannerSub}>{route?.name || 'Navigating…'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            ...S.gpsPill,
            background: gpsStatus === 'ok' ? 'rgba(16,185,129,0.15)'
              : gpsStatus === 'denied' ? 'rgba(239,68,68,0.15)'
              : 'rgba(245,158,11,0.15)',
            color: gpsStatus === 'ok' ? '#34d399'
              : gpsStatus === 'denied' ? '#f87171' : '#fbbf24',
            borderColor: gpsStatus === 'ok' ? 'rgba(16,185,129,0.4)'
              : gpsStatus === 'denied' ? 'rgba(239,68,68,0.4)'
              : 'rgba(245,158,11,0.4)',
          }}>
            {gpsStatus === 'ok' ? '🛰 GPS Live'
              : gpsStatus === 'denied' ? '⛔ GPS Off'
              : '⌛ Acquiring…'}
          </span>
          <button style={S.stopBtn} onClick={onStop}>✕ Stop</button>
        </div>
      </div>

      {/* ── PROGRESS BAR ── */}
      <div style={S.progressTrack}>
        <div style={{ ...S.progressFill, width: `${progress * 100}%` }} />
      </div>

      {/* ── BOTTOM STATS BAR ── */}
      <div style={S.statsBar}>
        <div style={S.statBlock}>
          <div style={{ ...S.statValue, color: speed === 0 ? '#64748b' : '#f1f5f9' }}>
            {speed}
          </div>
          <div style={S.statLabel}>km/h</div>
        </div>
        <div style={S.divider} />
        <div style={S.statBlockCenter}>
          <div style={S.statValueLarge}>{fmtTime(timeRemainingS)}</div>
          <div style={S.statLabel}>remaining</div>
        </div>
        <div style={S.divider} />
        <div style={S.statBlock}>
          <div style={S.statValue}>{fmtDist(distRemaining).split(' ')[0]}</div>
          <div style={S.statLabel}>{fmtDist(distRemaining).split(' ')[1]}</div>
        </div>
      </div>

      {/* ── GPS DENIED WARNING ── */}
      {gpsStatus === 'denied' && (
        <div style={S.gpsWarn}>
          ⚠️ Location permission denied — enable GPS for live tracking
        </div>
      )}

      {/* ── ARRIVAL CELEBRATION OVERLAY ── */}
      {arrived && (
        <div style={S.arrivedOverlay}>
          <div style={S.arrivedCard}>
            {/* Animated checkmark */}
            <div style={S.checkCircle}>
              <svg viewBox="0 0 52 52" style={{ width: 52, height: 52 }}>
                <circle cx="26" cy="26" r="25" fill="none" stroke="#10b981" strokeWidth="2.5" />
                <path
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14 27 l9 9 l15-17"
                  style={{ animation: 'drawCheck 0.5s ease 0.2s forwards', strokeDasharray: 40, strokeDashoffset: 40 }}
                />
              </svg>
            </div>

            <div style={S.arrivedLabel}>Trip Completed</div>
            <div style={S.arrivedTitle}>Successfully Arrived! 🎉</div>
            <div style={S.arrivedDest}>{destination?.name}</div>

            {/* Trip summary stats */}
            <div style={S.tripStats}>
              <div style={S.tripStat}>
                <div style={S.tripStatVal}>{fmtDist(totalDistanceTravelled)}</div>
                <div style={S.tripStatLabel}>Distance</div>
              </div>
              <div style={S.tripStatDivider} />
              <div style={S.tripStat}>
                <div style={S.tripStatVal}>{fmtTime(tripElapsed)}</div>
                <div style={S.tripStatLabel}>Travel Time</div>
              </div>
              <div style={S.tripStatDivider} />
              <div style={S.tripStat}>
                <div style={S.tripStatVal}>{speed} km/h</div>
                <div style={S.tripStatLabel}>Avg Speed</div>
              </div>
            </div>

            <button style={S.gotItBtn} onClick={onArrived || onStop}>
              ✓ Got it
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes drawCheck {
          to { stroke-dashoffset: 0; }
        }
        @keyframes arrivalBounce {
          0% { transform: scale(0.8); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 5000,
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  topBanner: {
    pointerEvents: 'all',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'linear-gradient(135deg,rgba(15,23,42,0.97) 0%,rgba(30,41,59,0.97) 100%)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(99,102,241,0.3)',
    padding: '14px 24px',
    boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
  },
  topBannerContent: { display: 'flex', alignItems: 'center', gap: '12px' },
  topBannerIcon: { fontSize: '1.5rem' },
  topDestName: {
    fontSize: '1.05rem', fontWeight: '700',
    color: '#f1f5f9', fontFamily: 'var(--font-sans)',
  },
  topBannerSub: { fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' },
  gpsPill: {
    fontSize: '0.7rem', fontWeight: '700',
    padding: '4px 10px', borderRadius: '20px',
    border: '1px solid', letterSpacing: '0.04em', whiteSpace: 'nowrap',
  },
  stopBtn: {
    pointerEvents: 'all',
    background: 'rgba(239,68,68,0.18)',
    border: '1px solid rgba(239,68,68,0.4)',
    color: '#f87171', fontWeight: '700',
    fontSize: '0.8rem', borderRadius: '8px',
    padding: '8px 16px', cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  progressTrack: { height: '4px', background: 'rgba(99,102,241,0.15)' },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg,#6366f1 0%,#06b6d4 100%)',
    borderRadius: '0 2px 2px 0',
    transition: 'width 1s linear',
    boxShadow: '0 0 8px rgba(99,102,241,0.6)',
  },
  statsBar: {
    pointerEvents: 'all',
    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
    background: 'linear-gradient(135deg,rgba(15,23,42,0.97) 0%,rgba(30,41,59,0.97) 100%)',
    backdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(99,102,241,0.3)',
    padding: '18px 32px',
    boxShadow: '0 -4px 32px rgba(0,0,0,0.5)',
  },
  statBlock: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '72px',
  },
  statBlockCenter: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, textAlign: 'center',
  },
  statValue: {
    fontSize: '2rem', fontWeight: '800', color: '#f1f5f9',
    lineHeight: 1, fontFamily: 'var(--font-sans)',
    fontVariantNumeric: 'tabular-nums', transition: 'color 0.3s',
  },
  statValueLarge: {
    fontSize: '2.2rem', fontWeight: '800', color: '#6366f1',
    lineHeight: 1, fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em',
  },
  statLabel: {
    fontSize: '0.72rem', color: '#64748b', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px',
  },
  divider: {
    width: '1px', height: '48px',
    background: 'rgba(99,102,241,0.2)', margin: '0 8px',
  },

  /* ── ARRIVAL ── */
  arrivedOverlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(5,10,25,0.88)',
    backdropFilter: 'blur(16px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 6000, pointerEvents: 'all',
  },
  arrivedCard: {
    background: 'linear-gradient(160deg,#1e293b 0%,#0f172a 100%)',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: '24px',
    padding: '40px 48px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
    boxShadow: '0 0 60px rgba(16,185,129,0.15), 0 24px 60px rgba(0,0,0,0.7)',
    animation: 'arrivalBounce 0.5s cubic-bezier(0.34,1.56,0.64,1)',
    maxWidth: '400px', width: '90vw',
  },
  checkCircle: {
    marginBottom: '4px',
    filter: 'drop-shadow(0 0 12px rgba(16,185,129,0.5))',
  },
  arrivedLabel: {
    fontSize: '0.7rem', fontWeight: '800',
    color: '#10b981', textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  arrivedTitle: {
    fontSize: '1.6rem', fontWeight: '800',
    color: '#f1f5f9', fontFamily: 'var(--font-sans)',
    textAlign: 'center', lineHeight: 1.2,
  },
  arrivedDest: {
    fontSize: '0.88rem', color: '#94a3b8',
    textAlign: 'center', maxWidth: '280px',
    lineHeight: 1.4,
  },
  tripStats: {
    display: 'flex', alignItems: 'center',
    gap: '0', marginTop: '8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px', padding: '12px 0',
    width: '100%',
  },
  tripStat: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '3px',
  },
  tripStatVal: {
    fontSize: '1.1rem', fontWeight: '800',
    color: '#f1f5f9', fontFamily: 'var(--font-sans)',
  },
  tripStatLabel: {
    fontSize: '0.65rem', color: '#64748b',
    fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tripStatDivider: {
    width: '1px', height: '36px',
    background: 'rgba(255,255,255,0.07)',
  },
  gotItBtn: {
    marginTop: '8px',
    background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)',
    color: '#fff', border: 'none', borderRadius: '12px',
    padding: '14px 48px', fontWeight: '800', fontSize: '1rem',
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
    boxShadow: '0 4px 20px rgba(16,185,129,0.4)',
    letterSpacing: '0.03em',
    transition: 'transform 0.15s, box-shadow 0.15s',
    width: '100%',
  },
  gpsWarn: {
    pointerEvents: 'all',
    position: 'fixed', top: '80px',
    left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.4)',
    color: '#fca5a5', padding: '10px 20px',
    borderRadius: '10px', fontSize: '0.8rem',
    fontWeight: '600', backdropFilter: 'blur(12px)',
    zIndex: 6000, whiteSpace: 'nowrap',
  },
};
