import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.errorScreen}>
          <div style={styles.card}>
            <span style={styles.icon}>⚠️</span>
            <h2 style={styles.title}>Something went wrong</h2>
            <p style={styles.subtitle}>TrafficFlow AI encountered a runtime rendering exception.</p>
            
            <div style={styles.errorDetails}>
              <strong>Error Message:</strong>
              <div style={styles.codeBox}>{this.state.error && this.state.error.toString()}</div>
              
              {this.state.errorInfo && (
                <>
                  <strong style={{ display: 'block', marginTop: '12px' }}>Stack Trace:</strong>
                  <pre style={styles.stackBox}>{this.state.errorInfo.componentStack}</pre>
                </>
              )}
            </div>
            
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              style={styles.reloadBtn}
            >
              Clear Cache & Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  errorScreen: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontFamily: 'system-ui, sans-serif',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '640px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '16px',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#cbd5e1',
    marginBottom: '24px',
  },
  errorDetails: {
    width: '100%',
    textAlign: 'left',
    marginBottom: '24px',
    fontSize: '0.85rem',
  },
  codeBox: {
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: '#0f172a',
    color: '#ef4444',
    fontFamily: 'monospace',
    marginTop: '6px',
    overflowX: 'auto',
  },
  stackBox: {
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginTop: '6px',
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    maxHeight: '180px',
    overflowY: 'auto',
  },
  reloadBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};
