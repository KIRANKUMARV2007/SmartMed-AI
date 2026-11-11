import { Component } from 'react';
import { AlertTriangle, RotateCcw, Home, ChevronDown, ChevronUp } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Safe error logging for developer analysis
    if (typeof console !== 'undefined' && console.error) {
      console.error('[SmartMed UI Error Boundary Caught Exception]:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReloadApp = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const moduleName = this.props.moduleName || 'Clinical Module';
      const errorMessage = this.state.error?.message || 'Unexpected component rendering exception';

      return (
        <div
          className="error-boundary-wrapper"
          style={{
            margin: '24px 0',
            padding: '32px 24px',
            background: 'var(--bg-card, #0f172a)',
            border: '1px solid var(--status-faulty-border, rgba(239, 68, 68, 0.3))',
            borderRadius: 'var(--radius-lg, 10px)',
            boxShadow: 'var(--shadow-card, 0 4px 12px rgba(0,0,0,0.2))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-faulty, #ef4444)',
            }}
          >
            <AlertTriangle size={28} />
          </div>

          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary, #f8fafc)' }}>
              {moduleName} Encountered an Interface Error
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary, #94a3b8)', maxWidth: 540, margin: 0 }}>
              The application preserved your session and backend data. You can retry loading this view or navigate back to the overview dashboard.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginTop: 6,
            }}
          >
            <button
              type="button"
              className="btn-primary"
              onClick={this.handleReset}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13 }}
            >
              <RotateCcw size={14} />
              <span>Retry Loading {moduleName}</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={this.handleReloadApp}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13 }}
            >
              <Home size={14} />
              <span>Reload Application</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 12px', fontSize: 12 }}
            >
              <span>Diagnostics</span>
              {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {this.state.showDetails && (
            <div
              style={{
                width: '100%',
                maxWidth: 680,
                marginTop: 12,
                padding: '12px 16px',
                background: 'var(--bg-surface, #1e293b)',
                border: '1px solid var(--border-subtle, #334155)',
                borderRadius: 'var(--radius-md, 6px)',
                textAlign: 'left',
                fontFamily: 'monospace',
                fontSize: 12,
                color: '#fca5a5',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <strong>Error:</strong> {errorMessage}
              {this.state.errorInfo?.componentStack && (
                <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 11 }}>
                  <strong>Component Stack:</strong>
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
