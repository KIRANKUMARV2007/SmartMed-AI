import {
  Activity,
  LayoutDashboard,
  Boxes,
  MapPin,
  ArrowRightLeft,
  Wrench,
  Siren,
  QrCode,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function Sidebar() {
  const {
    activeTab,
    setActiveTab,
    activePersona,
    stats,
    setIsQRScannerOpen,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
  } = useEquipment();

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setIsMobileSidebarOpen(false);
  };

  const handleQRClick = () => {
    setIsQRScannerOpen(true);
    setIsMobileSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      <aside className={`sidebar ${isMobileSidebarOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-header">
          <div className="brand-icon-wrapper">
            <Activity size={24} strokeWidth={2.5} />
          </div>
          <div className="brand-title-group" style={{ flex: 1 }}>
            <h2>SmartMed AI</h2>
            <span className="brand-badge">HOSPITAL ASSET SUITE</span>
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            className="sidebar-mobile-close-btn"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Close navigation sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="sidebar-nav">
          <div className="nav-section-title">Core Operations</div>

          <button
            type="button"
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavClick('dashboard')}
          >
            <div className="nav-item-left">
              <LayoutDashboard size={18} />
              <span>Overview Dashboard</span>
            </div>
            <span className="nav-badge" style={{ background: 'rgba(255,255,255,0.1)' }}>
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => handleNavClick('inventory')}
          >
            <div className="nav-item-left">
              <Boxes size={18} />
              <span>Equipment Inventory</span>
            </div>
            <span className="nav-badge" style={{ background: 'var(--status-ready-bg)', color: 'var(--status-ready)' }}>
              {stats.available} Ready
            </span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'floormap' ? 'active' : ''}`}
            onClick={() => handleNavClick('floormap')}
          >
            <div className="nav-item-left">
              <MapPin size={18} />
              <span>Ward Floor Map</span>
            </div>
            <span className="nav-badge phase-tag">Floor 1-3</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'movements' ? 'active' : ''}`}
            onClick={() => handleNavClick('movements')}
          >
            <div className="nav-item-left">
              <ArrowRightLeft size={18} />
              <span>Movement Audit</span>
            </div>
            {stats.reserved > 0 && (
              <span className="nav-badge warning">
                {stats.reserved} Hold
              </span>
            )}
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'maintenance' ? 'active' : ''}`}
            onClick={() => handleNavClick('maintenance')}
          >
            <div className="nav-item-left">
              <Wrench size={18} />
              <span>Biomed Maintenance</span>
            </div>
            {stats.faulty > 0 && (
              <span className="nav-badge danger">
                {stats.faulty} Faulty
              </span>
            )}
          </button>

          <div className="nav-section-title" style={{ marginTop: 16 }}>
            Field Operations
          </div>

          <button
            type="button"
            className="nav-item"
            onClick={handleQRClick}
            style={{ background: 'rgba(0, 180, 216, 0.12)', color: '#38bdf8' }}
          >
            <div className="nav-item-left">
              <QrCode size={18} color="var(--accent-cyan)" />
              <span>QR Scanner & Transfer</span>
            </div>
            <span className="nav-badge" style={{ background: 'var(--accent-cyan)', color: '#0b132b', fontWeight: 800 }}>
              Active
            </span>
          </button>

          <div
            className="nav-item"
            style={{ opacity: 0.7, cursor: 'default' }}
            title="Phase 3 will integrate Dijkstra shortest-path routing and multi-criteria AI allocation"
          >
            <div className="nav-item-left">
              <Siren size={18} color="#f43f5e" />
              <span style={{ color: '#fca5a5' }}>Emergency / OT Mode</span>
            </div>
            <span className="nav-badge phase-tag">Phase 3</span>
          </div>

          {stats.stale > 0 && (
            <div
              style={{
                marginTop: 'auto',
                marginBottom: 10,
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
                color: '#fbbf24',
              }}
            >
              <ShieldAlert size={20} flexShrink={0} />
              <div>
                <strong>{stats.stale} Assets Stale</strong>
                <div style={{ fontSize: 10.5, opacity: 0.85 }}>Unverified for &gt;6 hours</div>
              </div>
            </div>
          )}
        </nav>

        {/* Active Persona Footer */}
        <div className="sidebar-footer">
          <div className="user-profile-card">
            <div className="user-avatar">{activePersona.avatar}</div>
            <div className="user-info">
              <div className="user-name" title={activePersona.name}>
                {activePersona.name}
              </div>
              <span className="user-role-badge">
                {activePersona.role}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
