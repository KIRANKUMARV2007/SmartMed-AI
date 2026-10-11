import { ArrowRightLeft, ArrowRight, UserCheck, Clock, ShieldCheck } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function RecentMovements() {
  const { movements, getRelativeTime, setActiveTab } = useEquipment();

  return (
    <div className="panel-card">
      <div className="panel-title-row">
        <div className="panel-title">
          <ArrowRightLeft size={18} color="var(--accent-cyan)" />
          <span>Recent Equipment Movements</span>
        </div>
        <button
          type="button"
          className="btn-secondary"
          style={{ padding: '4px 10px', fontSize: 12 }}
          onClick={() => setActiveTab('movements')}
        >
          View Full Audit
        </button>
      </div>

      <div className="movement-feed">
        {movements.slice(0, 4).map((mov) => (
          <div key={mov.id} className="movement-item">
            <div className="movement-icon-box">
              <ArrowRightLeft size={16} />
            </div>
            <div className="movement-details">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="movement-equip-title">{mov.equipmentName}</span>
                <span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {mov.equipmentId}
                </span>
              </div>

              <div className="movement-route">
                <span style={{ color: 'var(--text-muted)' }}>{mov.fromRoom}</span>
                <ArrowRight size={13} color="var(--accent-cyan)" />
                <strong style={{ color: 'var(--text-primary)' }}>{mov.toRoom}</strong>
              </div>

              <div className="movement-meta">
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <UserCheck size={12} color="var(--accent-cyan)" />
                  {mov.staffName} ({mov.staffRole})
                </span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} />
                  {getRelativeTime(mov.timestamp)}
                </span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--status-ready)' }}>
                  <ShieldCheck size={12} />
                  Dual-Scan Confirmed
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
