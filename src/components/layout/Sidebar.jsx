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
  Sparkles,
  X,
  Users,
  FileText,
  FileSpreadsheet,
  LogOut,
  BrainCircuit,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar() {
  const {
    activeTab,
    setActiveTab,
    stats,
    setIsQRScannerOpen,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
  } = useEquipment();

  const { user, isAdmin, isDoctor, isNurse, isStaff, logout } = useAuth();

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setIsMobileSidebarOpen(false);
  };

  const handleQRClick = () => {
    setIsQRScannerOpen(true);
    setIsMobileSidebarOpen(false);
  };

  const getUserInitials = (name) => {
    if (!name) return 'SM';
    const clean = name.replace(/^(Dr\.|Nurse|Mr\.|Ms\.)\s+/i, '').replace(/\([^)]*\)/g, '').trim();
    const parts = clean.split(/[,\s]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0] ? parts[0].slice(0, 2).toUpperCase() : 'SM';
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'doctor':
        return 'Staff Physician';
      case 'nurse':
        return 'Charge Nurse';
      default:
        return 'Biomedical Staff';
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="sidebar-backdrop active"
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
          <div className="nav-section-title">
            {isAdmin ? 'System & Operations' : 'Clinical Operations'}
          </div>

          {/* Overview Dashboard (All roles) */}
          <button
            type="button"
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavClick('dashboard')}
          >
            <div className="nav-item-left">
              <LayoutDashboard size={18} />
              <span>{isAdmin ? 'Admin Overview' : 'Staff Dashboard'}</span>
            </div>
            <span className="nav-badge" style={{ background: 'rgba(255,255,255,0.1)' }}>
              {stats.total}
            </span>
          </button>

          {/* Equipment Inventory (All roles) */}
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

          {/* SmartMed AI Recommender (All roles) */}
          <button
            type="button"
            className={`nav-item ${activeTab === 'ai-recommend' ? 'active' : ''}`}
            onClick={() => handleNavClick('ai-recommend')}
            style={
              activeTab === 'ai-recommend'
                ? {}
                : { background: 'rgba(56, 189, 248, 0.08)', color: 'var(--accent-cyan)' }
            }
          >
            <div className="nav-item-left">
              <BrainCircuit size={18} color="var(--accent-cyan)" />
              <span>AI Recommender</span>
            </div>
            <span
              className="nav-badge"
              style={{
                background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 10,
              }}
            >
              SMART AI
            </span>
          </button>

          {/* Ward Floor Map (All roles) */}
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

          {/* Movement Audit (Admin, Doctor, Nurse, Staff) */}
          <button
            type="button"
            className={`nav-item ${activeTab === 'movements' ? 'active' : ''}`}
            onClick={() => handleNavClick('movements')}
          >
            <div className="nav-item-left">
              <ArrowRightLeft size={18} />
              <span>Movement History</span>
            </div>
            {stats.reserved > 0 && (
              <span className="nav-badge warning">
                {stats.reserved} Hold
              </span>
            )}
          </button>

          {/* Biomed Maintenance (Admin, Staff, or requestable by Nurse/Doctor) */}
          {(isAdmin || isStaff) && (
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
          )}

          {/* Sanitization Protocol (Admin, Nurse) */}
          {(isAdmin || isNurse) && (
            <button
              type="button"
              className={`nav-item ${activeTab === 'sanitization' ? 'active' : ''}`}
              onClick={() => handleNavClick('sanitization')}
            >
              <div className="nav-item-left">
                <Sparkles size={18} />
                <span>Sanitization & Decon</span>
              </div>
              {stats.sanitization > 0 && (
                <span
                  className="nav-badge"
                  style={{
                    background: 'var(--status-sanitization-bg)',
                    color: 'var(--status-sanitization)',
                    fontWeight: 700,
                  }}
                >
                  {stats.sanitization} Pending
                </span>
              )}
            </button>
          )}

          {/* Emergency / OT Mode (Admin, Doctor, Nurse) */}
          {(isAdmin || isDoctor || isNurse) && (
            <button
              type="button"
              className={`nav-item ${activeTab === 'emergency' ? 'active' : ''}`}
              onClick={() => handleNavClick('emergency')}
              style={
                activeTab === 'emergency'
                  ? {}
                  : { background: 'rgba(225, 29, 72, 0.12)', color: '#fda4af' }
              }
            >
              <div className="nav-item-left">
                <Siren size={18} color="#f43f5e" />
                <span>Emergency Allocation</span>
              </div>
              <span
                className="nav-badge"
                style={{
                  background: '#E11D48',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 10.5,
                }}
              >
                Critical
              </span>
            </button>
          )}

          {/* Operational Reports & Data Export (All roles) */}
          <button
            type="button"
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => handleNavClick('reports')}
          >
            <div className="nav-item-left">
              <FileSpreadsheet size={18} color="var(--accent-blue)" />
              <span>Reports & Export</span>
            </div>
            <span
              className="nav-badge"
              style={{
                background: 'rgba(29, 95, 193, 0.12)',
                color: 'var(--accent-blue)',
                fontWeight: 700,
                fontSize: 10,
              }}
            >
              8 Reports
            </span>
          </button>

          {/* Administrative Sections (Admin Only) */}
          {isAdmin && (
            <>
              <div className="nav-section-title" style={{ marginTop: 16 }}>
                Governance & Security
              </div>

              <button
                type="button"
                className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => handleNavClick('users')}
              >
                <div className="nav-item-left">
                  <Users size={18} color="var(--accent-cyan)" />
                  <span>User & Staff Control</span>
                </div>
              </button>

              <button
                type="button"
                className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`}
                onClick={() => handleNavClick('audit')}
              >
                <div className="nav-item-left">
                  <FileText size={18} color="var(--accent-cyan)" />
                  <span>Audit Trail</span>
                </div>
              </button>
            </>
          )}

          {/* Field Operations for QR Scanner (Nurse, Staff, Admin) */}
          {(isAdmin || isNurse || isStaff) && (
            <>
              <div className="nav-section-title" style={{ marginTop: 16 }}>
                Field Relocation
              </div>

              <button
                type="button"
                className="nav-item"
                onClick={handleQRClick}
                style={{ background: 'rgba(0, 180, 216, 0.12)', color: '#38bdf8' }}
              >
                <div className="nav-item-left">
                  <QrCode size={18} color="var(--accent-cyan)" />
                  <span>QR Dual-Scan Transfer</span>
                </div>
                <span className="nav-badge" style={{ background: 'var(--accent-cyan)', color: '#0b132b', fontWeight: 800 }}>
                  Active
                </span>
              </button>
            </>
          )}

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

        {/* Authenticated User Profile & Logout */}
        <div className="sidebar-footer">
          <div className="user-profile-card">
            <div className={`user-avatar ${user?.role || 'staff'}`} title={`${user?.name || 'Staff'} (${getRoleDisplayName(user?.role)})`}>
              {getUserInitials(user?.name)}
            </div>
            <div className="user-info">
              <div className="user-name" title={user?.name}>
                {user?.name || 'Authorized Staff'}
              </div>
              <span className={`user-role-badge ${user?.role || 'staff'}`}>
                {getRoleDisplayName(user?.role)}
              </span>
            </div>
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={logout}
              title="Sign Out of Session"
              aria-label="Sign Out of Session"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
