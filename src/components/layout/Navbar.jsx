import { Sun, Moon, Bell, UserCheck, QrCode, Menu } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function Navbar() {
  const {
    activePersona,
    setActivePersona,
    demoPersonas,
    theme,
    setTheme,
    activeTab,
    setIsQRScannerOpen,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
  } = useEquipment();

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Executive Overview';
      case 'inventory':
        return 'Medical Assets';
      case 'floormap':
        return 'Ward Floor Map';
      case 'movements':
        return 'Movement Audit';
      case 'maintenance':
        return 'Biomed Maintenance';
      default:
        return 'Hospital Management';
    }
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
            SmartMed AI Hospital Asset Geolocation System
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

        {/* Prototype Staff Persona Switcher */}
        <div className="persona-switcher-container" title="Switch between simulated clinical staff and engineer profiles">
          <UserCheck size={16} color="var(--accent-cyan)" flexShrink={0} />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className="persona-label">Staff Profile:</span>
            <select
              className="persona-select"
              value={activePersona.id}
              onChange={(e) => {
                const found = demoPersonas.find((p) => p.id === e.target.value);
                if (found) setActivePersona(found);
              }}
              aria-label="Select Demo Staff Profile"
            >
              {demoPersonas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name.split(' ')[0]} ({p.role.split(' ')[0]} — {p.department.split(' ')[0]})
                </option>
              ))}
            </select>
          </div>
        </div>

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
          title="3 active system notifications"
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
      </div>
    </header>
  );
}
