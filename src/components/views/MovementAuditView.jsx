import { useState } from 'react';
import { ArrowRightLeft, ArrowRight, ShieldCheck, Search } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function MovementAuditView() {
  const { movements, getRelativeTime } = useEquipment();
  const [filterQuery, setFilterQuery] = useState('');

  const filteredMovements = movements.filter((mov) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      mov.equipmentName.toLowerCase().includes(q) ||
      mov.equipmentId.toLowerCase().includes(q) ||
      mov.fromRoom.toLowerCase().includes(q) ||
      mov.toRoom.toLowerCase().includes(q) ||
      mov.staffName.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Search Header */}
      <div className="toolbar-container">
        <div className="toolbar-primary-row">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Filter audit log by equipment, room, or staff name..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Total Recorded Transfers: <strong>{movements.length}</strong>
          </span>
        </div>
      </div>

      {/* Movement Table */}
      <div className="table-card">
        <div className="table-card-header">
          <div className="table-card-title">
            <ArrowRightLeft size={18} color="var(--accent-cyan)" />
            <span>Complete Custody & Relocation Audit Trail</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Audit ID</th>
                <th>Equipment Asset</th>
                <th>From Location</th>
                <th>Destination Location</th>
                <th>Authorized Staff</th>
                <th>Verification Protocol</th>
                <th style={{ textAlign: 'right' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((mov) => (
                <tr key={mov.id}>
                  <td>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                      {mov.id}
                    </span>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                        {mov.equipmentName}
                      </strong>
                      <span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {mov.equipmentId}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{mov.fromRoom}</span>
                  </td>

                  <td>
                    <strong style={{ color: 'var(--text-primary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ArrowRight size={13} color="var(--accent-cyan)" />
                      {mov.toRoom}
                    </strong>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {mov.staffName}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {mov.staffRole} ({mov.staffId})
                      </span>
                    </div>
                  </td>

                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: 'var(--status-ready)',
                        fontSize: 11.5,
                        fontWeight: 600,
                      }}
                    >
                      <ShieldCheck size={13} />
                      {mov.type}
                    </span>
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {getRelativeTime(mov.timestamp)}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(mov.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
