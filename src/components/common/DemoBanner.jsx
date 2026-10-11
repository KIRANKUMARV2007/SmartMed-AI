import { AlertTriangle, Database } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function DemoBanner() {
  const { staleThresholdHours, stats } = useEquipment();

  return (
    <div className="demo-banner">
      <div className="demo-banner-content">
        <span className="demo-chip">PROTOTYPE SIMULATION</span>
        <span className="demo-banner-text">
          <Database size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          <strong>Synthetic Clinical Environment:</strong> Locations reflect dual-scan room updates (no real-time GPS/RFID telemetry connected).
        </span>
      </div>

      <div className="demo-banner-meta">
        {stats.stale > 0 && (
          <span className="demo-stale-tag">
            <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            {stats.stale} Stale Location{stats.stale > 1 ? 's' : ''} (&gt;{staleThresholdHours}h unverified)
          </span>
        )}
        <span style={{ fontSize: 11, opacity: 0.85 }}>
          Stale Threshold: {staleThresholdHours}h
        </span>
      </div>
    </div>
  );
}
