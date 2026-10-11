import { Wrench, Sparkles, CheckCircle2, ShieldAlert, Cpu } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function MaintenanceView() {
  const { equipment, clearSanitization, setInspectingEquipment, stats } =
    useEquipment();

  // Find items requiring attention
  const attentionItems = equipment.filter(
    (e) =>
      e.status === 'Sanitization Required' ||
      e.status === 'Under Maintenance' ||
      e.status === 'Faulty'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ML Roadmap Advisory Notice */}
      <div className="advisory-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Cpu size={24} color="#8b5cf6" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: 14 }}>Biomedical Predictive Maintenance Service (Architecture Reserved)</strong>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              A dedicated Python microservice will host Random Forest failure-risk classification and K-Means idle clustering. All displayed metrics currently use synthetic test telemetry.
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            color: '#a78bfa',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Phase 4: ML Service Bridge
        </span>
      </div>

      {/* Maintenance KPI Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Faulty Equipment</span>
            <div className="metric-icon-box alert">
              <ShieldAlert size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value" style={{ color: 'var(--status-faulty)' }}>
              {stats.faulty}
            </span>
            <span className="metric-subtitle">unsafe for use</span>
          </div>
          <div className="metric-footer-note">
            <span>Circuit or sensor faults flagged</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Under Active Repair</span>
            <div className="metric-icon-box alert" style={{ background: 'var(--status-maintenance-bg)', color: 'var(--status-maintenance)' }}>
              <Wrench size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value" style={{ color: 'var(--status-maintenance)' }}>
              {stats.maintenance}
            </span>
            <span className="metric-subtitle">in workshop</span>
          </div>
          <div className="metric-footer-note">
            <span>Biomedical workshop B1 queue</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Decontamination Queue</span>
            <div className="metric-icon-box" style={{ background: 'var(--status-sanitization-bg)', color: 'var(--status-sanitization)' }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value" style={{ color: 'var(--status-sanitization)' }}>
              {stats.sanitization}
            </span>
            <span className="metric-subtitle">pending release</span>
          </div>
          <div className="metric-footer-note">
            <span>Infection control clearance required</span>
          </div>
        </div>
      </div>

      {/* Urgent Attention Table */}
      <div className="table-card">
        <div className="table-card-header">
          <div className="table-card-title">
            <Wrench size={18} color="var(--accent-cyan)" />
            <span>Biomedical Attention & Sanitization Queue</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Equipment ID & Model</th>
                <th>Current Status</th>
                <th>Current Room</th>
                <th>Reported Diagnosis / Condition</th>
                <th>Operating Hours</th>
                <th style={{ textAlign: 'right' }}>Biomedical Action</th>
              </tr>
            </thead>
            <tbody>
              {attentionItems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px 20px' }}>
                    <CheckCircle2 size={28} color="var(--status-ready)" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontWeight: 600 }}>All equipment currently cleared and operational</p>
                  </td>
                </tr>
              ) : (
                attentionItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                          {item.name}
                        </strong>
                        <span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {item.id} • {item.serialNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`status-badge ${
                          item.status === 'Sanitization Required'
                            ? 'sanitization'
                            : item.status === 'Under Maintenance'
                            ? 'maintenance'
                            : 'faulty'
                        }`}
                      >
                        <span className="status-badge-dot" />
                        {item.status}
                      </span>
                    </td>

                    <td>{item.currentRoom}</td>

                    <td>
                      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {item.notes}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                        {item.operatingHours} hrs
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        {item.status === 'Sanitization Required' && (
                          <button
                            type="button"
                            className="btn-clear-san"
                            onClick={() => clearSanitization(item.id)}
                          >
                            <Sparkles size={13} style={{ marginRight: 4, display: 'inline' }} />
                            Clear Decon
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-inspect"
                          onClick={() => setInspectingEquipment(item)}
                        >
                          Inspect Log
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
