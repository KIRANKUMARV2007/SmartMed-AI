import { MapPin, ArrowRight, Info } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function FloorMapPreview() {
  const { rooms, equipment, setSelectedRoom, setActiveTab } = useEquipment();

  // Compute last-confirmed equipment count for each room
  const getRoomEquipCount = (roomName) => {
    return equipment.filter((e) => e.currentRoom === roomName).length;
  };

  const handleRoomClick = (roomName) => {
    setSelectedRoom(roomName);
    // Smooth scroll down to table or switch to inventory
    const tableEl = document.querySelector('.table-card');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="panel-card" style={{ gridColumn: '1 / -1' }}>
      <div className="panel-title-row">
        <div className="panel-title">
          <MapPin size={18} color="var(--accent-cyan)" />
          <span>Modeled Hospital Ward Distribution (Floorplan Preview)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="panel-helper-text" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Info size={12} />
            Counts show last-confirmed items, not live physical tracking
          </span>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={() => setActiveTab('floormap')}
          >
            Full Map View <ArrowRight size={12} style={{ display: 'inline', marginLeft: 2 }} />
          </button>
        </div>
      </div>

      <div className="floor-preview-grid">
        {rooms.map((room) => {
          const count = getRoomEquipCount(room.name);
          return (
            <div
              key={room.id}
              className="floor-room-card"
              onClick={() => handleRoomClick(room.name)}
              style={{ cursor: 'pointer' }}
              title={`Click to filter equipment in ${room.name}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="floor-room-name">{room.name.split(' ')[0]}</span>
                <span style={{ fontSize: 10, color: 'var(--accent-cyan)' }}>{room.floor}</span>
              </div>
              <span className="floor-room-dept">{room.department}</span>
              <div className="floor-room-count">
                {count}{' '}
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                  units
                </span>
              </div>
              <span className="floor-room-subtext">Last-Confirmed</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
