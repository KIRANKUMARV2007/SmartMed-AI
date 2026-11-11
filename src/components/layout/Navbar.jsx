import { Sun, Moon, Bell, QrCode, Menu, LogOut, Shield, Stethoscope, Activity, Users } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const {
    theme,
    setTheme,
    activeTab,
    setIsQRScannerOpen,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
  } = useEquipment();

  const { user, logout } = useAuth();

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return user?.role === 'admin' ? 'Administrative Governance' : 'Clinical Overview';
      case 'inventory':
        return 'Medical Equipment Inventory';
      case 'floormap':
        return 'Hospital Ward Floor Map';
      case 'movements':
        return 'Equipment Movement Ledger';
      case 'maintenance':
        return 'Biomedical Maintenance Tickets';
      case 'sanitization':
        return 'Infection Control & Sanitization';
      case 'emergency':
        return 'Emergency Asset Allocation';
      case 'reports':
        return 'Operational Reports & Data Export';
      case 'users':
        return 'Staff & User Access Control';
      case 'audit':
        return 'Regulatory & Operations Audit Trail';
      default:
        return 'SmartMed Management';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield size={14} color="var(--accent-cyan)" />;
      case 'doctor':
        return <Stethoscope size={14} color="var(--status-ready)" />;
      case 'nurse':
        return <Activity size={14} color="#93c5fd" />;
      default:
        return <Users size={14} color="#fde047" />;
    }
  };

  const getCleanUserName = (name) => {
    if (!name) return 'User';
    const cleaned = name.replace(/^(Dr\.|Nurse|Mr\.|Ms\.)\s+/i, '').trim();
    return cleaned.split(/[\s,]+/)[0] || name.split(' ')[0];
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          type="button"
          className="navbar-hamburger-btn"
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          aria-label="Toggle navigation menu"
        >
          <Menu size={22} />
        </button>

        <div className="page-title-group">
          <h1>{getTabTitle()}</h1>
          <span className="page-subtitle">
            SmartMed Hospital Asset Geolocation & Governance System
          </span>
        </div>
      </div>

      <div className="navbar-right">
        {/* Quick QR Scanner Launcher */}
        <button
          type="button"
          className="btn-primary navbar-qr-btn"
          onClick={() => setIsQRScannerOpen(true)}
          title="Open Camera QR Scanner or Simulator"
          aria-label="Open QR Scanner"
        >
          <QrCode size={16} />
          <span className="navbar-btn-text">Scan QR</span>
        </button>

        {/* Authenticated User Session Badge */}
        {user && (
          <div className="user-session-badge" title={`${user.name} (${user.role})`}>
            {getRoleIcon(user.role)}
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {getCleanUserName(user.name)}
            </span>
            <span className={`user-session-badge-role ${user.role}`}>
              {user.role}
            </span>
          </div>
        )}

        {/* Theme Toggle Button */}
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${theme === 'dark' ? 'Clinical Light' : 'Executive Dark'} Mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* System Notification Bell */}
        <button
          type="button"
          className="theme-toggle-btn"
          title="System notifications"
          style={{ position: 'relative' }}
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--status-faulty)',
              boxShadow: '0 0 6px var(--status-faulty)',
            }}
          />
        </button>

        {/* Sign Out Button */}
        {user && (
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={logout}
            title="Sign Out of Session"
            aria-label="Sign Out"
            style={{ color: '#fda4af' }}
          >
            <LogOut size={17} />
          </button>
        )}
      </div>
    </header>
  );
}
