import React, { useState } from 'react';
import { X, Copy, Check, Share2, MessageCircle } from 'lucide-react';

export default function ShareEtaModal({ isOpen, onClose, destination, selectedRoute }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !selectedRoute) return null;

  // Calculate ETA time
  const calculateEta = (durationStr) => {
    // Extract minutes
    const minsMatch = durationStr.match(/(\d+)\s*min/);
    const hrsMatch = durationStr.match(/(\d+)\s*hr/);
    let totalMins = 0;
    if (hrsMatch) totalMins += parseInt(hrsMatch[1]) * 60;
    if (minsMatch) totalMins += parseInt(minsMatch[1]);
    if (totalMins === 0) totalMins = 30; // Fallback

    const etaDate = new Date();
    etaDate.setMinutes(etaDate.getMinutes() + totalMins);
    
    return etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const etaTime = calculateEta(selectedRoute.duration);
  
  const shareMessage = `🚦 Navigation update via TrafficFlow AI:\nI am heading to "${destination?.name || 'my destination'}".\nSelected Route: "${selectedRoute.name}"\nDistance: ${selectedRoute.distance}\nEstimated Duration: ${selectedRoute.duration}\nExpected ETA: ${etaTime}\n\nDriving safe under optimal AI navigation routing.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsapp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`, '_blank');
  };

  return (
    <div style={styles.backdrop}>
      <div className="glass-panel" style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.headerTitleGroup}>
            <Share2 size={20} style={{ color: 'var(--primary)' }} />
            <h3>Share Journey ETA</h3>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        <div style={styles.body}>
          <p style={styles.bodyText}>Keep your friends or family updated with your real-time ETA and travel safety details.</p>
          
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Expected ETA</span>
              <span style={styles.statValue}>{etaTime}</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Time Left</span>
              <span style={styles.statValue}>{selectedRoute.duration}</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Distance</span>
              <span style={styles.statValue}>{selectedRoute.distance}</span>
            </div>
          </div>

          <div style={styles.messageGroup}>
            <label style={styles.messageLabel}>Shareable Message</label>
            <div style={styles.messagePreview}>
              {shareMessage}
            </div>
          </div>

          <div style={styles.actionRow}>
            <button onClick={handleCopy} className="glow-btn" style={{ ...styles.actionBtn, backgroundColor: copied ? 'var(--traffic-smooth)' : 'var(--primary)' }}>
              {copied ? (
                <>
                  <Check size={16} />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copy Message</span>
                </>
              )}
            </button>
            <button onClick={handleWhatsapp} style={styles.whatsappBtn}>
              <MessageCircle size={16} />
              <span>Share on WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modal: {
    width: '100%',
    maxWidth: '480px',
    animation: 'fadeIn 0.3s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border-color)',
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '50%',
    transition: 'var(--transition-smooth)',
  },
  body: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  bodyText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  statCard: {
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  statLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  statValue: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  messageGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  messageLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  messagePreview: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    whiteSpace: 'pre-line',
    maxHeight: '150px',
    overflowY: 'auto',
    lineHeight: '1.4',
  },
  actionRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px',
  },
  actionBtn: {
    flex: 1.2,
    justifyContent: 'center',
    padding: '11px',
    fontSize: '0.85rem',
  },
  whatsappBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '11px',
    borderRadius: '8px',
    border: '1px solid #25d366',
    backgroundColor: 'rgba(37, 211, 102, 0.05)',
    color: '#25d366',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    '&:hover': {
      backgroundColor: '#25d366',
      color: '#ffffff',
    },
  },
};
