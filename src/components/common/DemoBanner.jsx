import { AlertTriangle, Database, Server, RefreshCw, CheckCircle2, WifiOff } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function DemoBanner() {
  const {
    staleThresholdHours,
    stats,
    dataSource,
    setDataSource,
    apiSyncStatus,
    apiError,
    refreshEquipment,
    isBackendDegraded,
  } = useEquipment();

  const isLive = dataSource === 'live';

  return (
    <div className={`demo-banner ${isLive && apiSyncStatus === 'error' ? 'banner-error' : ''}`}>
      <div className="demo-banner-content">
        {/* Chip Indicator */}
        {!isLive && (
          <span className="demo-chip">PROTOTYPE SIMULATION</span>
        )}
        {isLive && apiSyncStatus === 'loading' && (
          <span className="demo-chip" style={{ background: 'rgba(56, 189, 248, 0.2)', color: 'var(--accent-cyan)' }}>
            <RefreshCw size={10} className="animate-spin" style={{ display: 'inline', marginRight: 4 }} />
            SYNCING API
          </span>
        )}
        {isLive && apiSyncStatus === 'error' && (
          <span className="demo-chip" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.5)' }}>
            <WifiOff size={10} style={{ display: 'inline', marginRight: 4 }} />
            BACKEND OFFLINE
          </span>
        )}
        {isLive && apiSyncStatus === 'success' && (
          <span
            className="demo-chip"
            style={{
              background: isBackendDegraded ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)',
              color: isBackendDegraded ? '#fde047' : '#86efac',
              borderColor: isBackendDegraded ? 'rgba(234, 179, 8, 0.4)' : 'rgba(34, 197, 94, 0.4)',
            }}
          >
            <CheckCircle2 size={10} style={{ display: 'inline', marginRight: 4 }} />
            {isBackendDegraded ? 'API UP (DB OFFLINE)' : 'LIVE BACKEND'}
          </span>
        )}

        {/* Informational Message */}
        <span className="demo-banner-text">
          {!isLive && (
            <>
              <Database size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              <strong>Synthetic Clinical Environment:</strong> Locations reflect simulated QR scans.
            </>
          )}
          {isLive && apiSyncStatus === 'loading' && (
            <span>Requesting equipment from SmartMed Express API (http://localhost:5000/api)...</span>
          )}
          {isLive && apiSyncStatus === 'error' && (
            <span style={{ color: '#fca5a5' }}>
              <strong>API Error:</strong> {apiError}
            </span>
          )}
          {isLive && apiSyncStatus === 'success' && (
            <span>
              {isBackendDegraded ? (
                <>Express server reached, but MongoDB is disconnected. Run backend in DB connected mode.</>
              ) : (
                <>Connected to SmartMed Express backend. Synchronized {stats.total} assets.</>
              )}
            </span>
          )}
        </span>
      </div>

      <div className="demo-banner-meta">
        {/* Stale Count */}
        {stats.stale > 0 && (
          <span className="demo-stale-tag">
            <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            {stats.stale} Stale Location{stats.stale > 1 ? 's' : ''} (&gt;{staleThresholdHours}h)
          </span>
        )}

        {/* Live / Mock Mode Toggles */}
        {!isLive ? (
          <button
            type="button"
            onClick={() => setDataSource('live')}
            className="btn-secondary"
            style={{
              padding: '3px 9px',
              fontSize: '11px',
              height: '24px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Connect to SmartMed Express backend at http://localhost:5000/api"
          >
            <Server size={12} />
            <span>Connect Live API</span>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={refreshEquipment}
              className="btn-secondary"
              style={{
                padding: '3px 8px',
                fontSize: '11px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Refresh equipment from backend"
            >
              <RefreshCw size={11} className={apiSyncStatus === 'loading' ? 'animate-spin' : ''} />
              <span>{apiSyncStatus === 'error' ? 'Retry' : 'Sync'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDataSource('mock')}
              className="btn-secondary"
              style={{
                padding: '3px 8px',
                fontSize: '11px',
                height: '24px',
              }}
              title="Return to mock simulation data"
            >
              Mock Mode
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

