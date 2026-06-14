import React, { useState } from 'react';
import { Search, MapPin, Navigation, History, Bookmark, BookmarkPlus, Map, Coffee, Fuel, Shield, MessageSquareText, HelpCircle } from 'lucide-react';
import AiPanel from './AiPanel';

export default function Sidebar({
  settings,
  startLocation,
  setStartLocation,
  destination,
  setDestination,
  routeOptions,
  selectedRouteIndex,
  onRouteSelected,
  bookmarks,
  onAddBookmark,
  onSelectBookmark,
  searchHistory,
  onSelectHistory,
  onAmenitiesSearch,
  onOpenSettings,
  onLogout,
  user,
  onShareEta
}) {
  const [activeTab, setActiveTab] = useState('nav'); // 'nav' or 'ai'
  const [startInput, setStartInput] = useState(startLocation?.name || '');
  const [destInput, setDestInput] = useState(destination?.name || '');
  const [newBookmarkName, setNewBookmarkName] = useState('');
  const [showAddBookmark, setShowAddBookmark] = useState(false);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!destInput) return;

    // Set mock coordinates or trigger search
    // In Simulation Mode, we use mock Delhi / Noida coords
    const startCoord = startLocation?.coordinates || [77.2090, 28.6139]; // Default Delhi CP
    const destCoord = [77.3910, 28.5708]; // Default Noida

    setStartLocation({ name: startInput || 'My Current Location (Delhi CP)', coordinates: startCoord });
    setDestination({ name: destInput, coordinates: destCoord });
  };

  const handleQuickAmenity = (type) => {
    onAmenitiesSearch(type);
  };

  const handleAddBookmarkSubmit = (e) => {
    e.preventDefault();
    if (!newBookmarkName || !destination) return;
    onAddBookmark({
      name: newBookmarkName,
      coordinates: destination.coordinates,
      address: destination.name
    });
    setNewBookmarkName('');
    setShowAddBookmark(false);
  };

  return (
    <div className="glass-panel" style={styles.sidebar}>
      {/* Brand Header */}
      <div style={styles.header}>
        <div style={styles.logoGroup}>
          <Navigation size={22} style={styles.logoIcon} />
          <h2 style={styles.logoText}>TrafficFlow <span style={styles.logoHighlight}>AI</span></h2>
        </div>
        <button onClick={onOpenSettings} style={styles.settingsBtn} title="Settings">
          ⚙️
        </button>
      </div>

      {/* User Session Profile */}
      <div style={styles.userSection}>
        <div style={styles.avatar}>
          {user?.email ? user.email[0].toUpperCase() : 'U'}
        </div>
        <div style={styles.userInfo}>
          <span style={styles.userEmail}>{user?.email || 'Guest Session'}</span>
          <span style={styles.userRole}>Premium Account</span>
        </div>
        <button onClick={onLogout} style={styles.logoutBtn} title="Sign Out">
          🚪
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
      <div style={styles.panelContent}>
        {activeTab === 'nav' ? (
          <div style={styles.navPanel}>
            
            {/* Search Input Form */}
            <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
              <div style={styles.searchWrapper}>
                <div style={styles.searchLine} />
                
                <div style={styles.searchFieldGroup}>
                  <MapPin size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Enter starting location..."
                    value={startInput}
                    onChange={(e) => setStartInput(e.target.value)}
                    style={styles.searchInput}
                  />
                </div>

                <div style={styles.searchFieldGroup}>
                  <Navigation size={16} style={{ color: 'var(--accent)', flexShrink: 0, transform: 'rotate(45deg)' }} />
                  <input
                    type="text"
                    placeholder="Where to?"
                    value={destInput}
                    onChange={(e) => setDestInput(e.target.value)}
                    style={styles.searchInput}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="glow-btn" style={styles.findRouteBtn}>
                Find Fastest Route
              </button>
            </form>

            {/* Quick Amenities Shortcuts */}
            <div style={styles.section}>
              <span style={styles.sectionTitle}>Amenities Shortcuts</span>
              <div style={styles.amenitiesGrid}>
                <button onClick={() => handleQuickAmenity('petrol')} style={styles.amenityBtn}>
                  <Fuel size={16} style={{ color: '#f59e0b' }} />
                  <span>Petrol</span>
                </button>
                <button onClick={() => handleQuickAmenity('restaurant')} style={styles.amenityBtn}>
                  <Coffee size={16} style={{ color: '#ef4444' }} />
                  <span>Food</span>
                </button>
                <button onClick={() => handleQuickAmenity('hotel')} style={styles.amenityBtn}>
                  🏨
                  <span>Hotels</span>
                </button>
                <button onClick={() => handleQuickAmenity('hospital')} style={styles.amenityBtn}>
                  🏥
                  <span>Hospitals</span>
                </button>
              </div>
            </div>

            {/* Alternative Routes display */}
            {routeOptions && routeOptions.length > 0 && (
              <div style={styles.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={styles.sectionTitle}>Calculated Routes</span>
                  <button onClick={onShareEta} className="glow-btn" style={styles.shareBtn}>
                    Share ETA
                  </button>
                </div>
                <div style={styles.routesList}>
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
                          <span style={{ ...styles.trafficBadge, backgroundColor: statusColor }}>
                            {route.trafficStatus.toUpperCase()}
                          </span>
                        </div>
                        <div style={styles.routeStats}>
                          <span style={styles.routeStatVal}>{route.duration}</span>
                          <span style={styles.routeStatSep}>•</span>
                          <span>{route.distance}</span>
                        </div>
                        {route.delayInfo && (
                          <span style={styles.delayText}>⚠️ {route.delayInfo}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Bookmarks */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>Bookmarks</span>
                {destination && (
                  <button onClick={() => setShowAddBookmark(!showAddBookmark)} style={styles.addBookmarkBtn}>
                    <BookmarkPlus size={14} />
                    <span>Save Dest</span>
                  </button>
                )}
              </div>

              {showAddBookmark && (
                <form onSubmit={handleAddBookmarkSubmit} style={styles.addBookmarkForm}>
                  <input
                    type="text"
                    placeholder="e.g. Work, Home, Gym"
                    value={newBookmarkName}
                    onChange={(e) => setNewBookmarkName(e.target.value)}
                    style={styles.addBookmarkInput}
                    required
                  />
                  <button type="submit" style={styles.addBookmarkSubmit}>Save</button>
                </form>
              )}

              <div style={styles.bookmarksList}>
                {bookmarks.length === 0 ? (
                  <span style={styles.emptyText}>No bookmarks saved yet.</span>
                ) : (
                  bookmarks.map((bm, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        setDestInput(bm.address);
                        onSelectBookmark(bm);
                      }}
                      style={styles.bookmarkItem}
                    >
                      <Bookmark size={14} style={{ color: 'var(--primary)' }} />
                      <div style={styles.bookmarkTextGroup}>
                        <span style={styles.bookmarkName}>{bm.name}</span>
                        <span style={styles.bookmarkAddress}>{bm.address}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

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
                      <History size={14} style={{ color: 'var(--text-muted)' }} />
                      <span style={styles.historyName}>{item.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

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
  );
}

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
    zIndex: 200,
    animation: 'slideInLeft 0.4s ease',
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
  logoutBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    transition: 'var(--transition-smooth)',
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
  amenitiesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  amenityBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '10px 6px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '0.7rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    '&:hover': {
      borderColor: 'var(--primary)',
      backgroundColor: 'var(--bg-tertiary)',
    },
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
  addBookmarkBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '0.7rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  addBookmarkForm: {
    display: 'flex',
    gap: '6px',
    marginBottom: '8px',
  },
  addBookmarkInput: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: '0.75rem',
    outline: 'none',
  },
  addBookmarkSubmit: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: 'none',
    background: 'var(--primary)',
    color: 'white',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontWeight: '600',
  },
  bookmarksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  bookmarkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    '&:hover': {
      borderColor: 'var(--primary)',
    },
  },
  bookmarkTextGroup: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  bookmarkName: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  bookmarkAddress: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
};
