import {
  Boxes,
  CheckCircle2,
  Clock,
  Activity,
  AlertTriangle,
  Wrench,
  ShieldAlert,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function MetricCards() {
  const { stats, showStaleOnly, setShowStaleOnly, staleThresholdHours } = useEquipment();

  return (
    <div className="metrics-grid">
      {/* 1. Total Equipment */}
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-title">Total Tracked Assets</span>
          <div className="metric-icon-box total">
            <Boxes size={18} />
          </div>
        </div>
        <div className="metric-value-row">
          <span className="metric-value">{stats.total}</span>
          <span className="metric-subtitle">units</span>
        </div>
        <div className="metric-footer-note">
          <Activity size={13} color="var(--accent-cyan)" />
          <span>Across 11 modeled hospital rooms</span>
        </div>
      </div>

      {/* 2. Available & Ready */}
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-title">Available & Ready</span>
          <div className="metric-icon-box ready">
            <CheckCircle2 size={18} />
          </div>
        </div>
        <div className="metric-value-row">
          <span className="metric-value">
            {stats.available}
          </span>
          <span className="metric-subtitle">
            ({stats.readyRate}% readiness)
          </span>
        </div>
        <div className="metric-footer-note">
          <span>Decontaminated & cleared for allocation</span>
        </div>
      </div>

      {/* 3. In Active Use */}
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-title">In Active Use</span>
          <div className="metric-icon-box inuse">
            <Activity size={18} />
          </div>
        </div>
        <div className="metric-value-row">
          <span className="metric-value">
            {stats.inUse}
          </span>
          <span className="metric-subtitle">deployed</span>
        </div>
        <div className="metric-footer-note">
          <span>Physical handover verified by clinical staff</span>
        </div>
      </div>

      {/* 4. Reserved (Handover Pending) */}
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-title">Reserved (Handover Pending)</span>
          <div className="metric-icon-box reserved">
            <Clock size={18} />
          </div>
        </div>
        <div className="metric-value-row">
          <span className="metric-value">
            {stats.reserved}
          </span>
          <span className="metric-subtitle">held</span>
        </div>
        <div className="metric-footer-note">
          <span>Awaiting bedside verification scan</span>
        </div>
      </div>

      {/* 5. Stale Location Alerts */}
      <div
        className={`metric-card alert-stale ${showStaleOnly ? 'active' : ''}`}
        style={{ cursor: 'pointer' }}
        onClick={() => setShowStaleOnly(!showStaleOnly)}
        title="Click to toggle filter for unverified equipment"
      >
        <div className="metric-header">
          <span className="metric-title">Stale Location Alerts</span>
          <div className="metric-icon-box stale">
            <AlertTriangle size={18} />
          </div>
        </div>
        <div className="metric-value-row">
          <span className="metric-value">
            {stats.stale}
          </span>
          <span className="metric-subtitle">
            {showStaleOnly ? '(Filter Active)' : `(>${staleThresholdHours}h unverified)`}
          </span>
        </div>
        <div className="metric-footer-note">
          <ShieldAlert size={13} color="#f59e0b" />
          <span style={{ color: '#fbbf24', fontWeight: 600 }}>
            {showStaleOnly ? 'Click to show all equipment' : 'Click to filter stale items'}
          </span>
        </div>
      </div>

      {/* 6. Maintenance & Sanitization Queue */}
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-title">Maintenance / Decon</span>
          <div className="metric-icon-box alert">
            <Wrench size={18} />
          </div>
        </div>
        <div className="metric-value-row">
          <span className="metric-value">
            {stats.sanitization + stats.maintenance + stats.faulty}
          </span>
          <span className="metric-subtitle">
            ({stats.sanitization} Decon | {stats.faulty} Faulty)
          </span>
        </div>
        <div className="metric-footer-note">
          <span>Biomedical engineering attention required</span>
        </div>
      </div>
    </div>
  );
}
