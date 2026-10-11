import { Wrench, Clock } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function MaintenanceAlerts() {
  const { maintenanceAlerts, getRelativeTime, setActiveTab } = useEquipment();

  return (
    <div className="panel-card">
      <div className="panel-title-row">
        <div className="panel-title">
          <Wrench size={18} color="var(--status-faulty)" />
          <span>Biomedical Maintenance & Faults</span>
        </div>
        <button
          type="button"
          className="btn-secondary"
          style={{ padding: '4px 10px', fontSize: 12 }}
          onClick={() => setActiveTab('maintenance')}
        >
          Manage Queue
        </button>
      </div>

      <div className="alerts-list">
        {maintenanceAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`alert-item ${
              alert.severity === 'CRITICAL'
                ? 'critical'
                : alert.severity === 'HIGH'
                ? 'high'
                : 'medium'
            }`}
          >
            <div className="alert-header">
              <span className="alert-title">{alert.title}</span>
              <span
                className={`alert-badge ${
                  alert.severity === 'CRITICAL'
                    ? 'critical'
                    : alert.severity === 'HIGH'
                    ? 'high'
                    : 'medium'
                }`}
              >
                {alert.severity}
              </span>
            </div>

            <div className="alert-description">{alert.description}</div>

            <div className="alert-footer">
              <span>
                <strong>Asset:</strong> {alert.equipmentName} ({alert.equipmentId})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} />
                {getRelativeTime(alert.reportedAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
