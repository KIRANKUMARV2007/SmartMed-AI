import {
  LayoutDashboard,
  Boxes,
  MapPin,
  ArrowRightLeft,
  QrCode,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function MobileBottomNav() {
  const { activeTab, setActiveTab, setIsQRScannerOpen } = useEquipment();

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <button
        type="button"
        className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => setActiveTab('dashboard')}
      >
        <LayoutDashboard size={20} />
        <span>Overview</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}
        onClick={() => setActiveTab('inventory')}
      >
        <Boxes size={20} />
        <span>Inventory</span>
      </button>

      {/* Floating Center QR Scan Action */}
      <button
        type="button"
        className="mobile-nav-qr-btn"
        onClick={() => setIsQRScannerOpen(true)}
        title="Open QR Scanner"
        aria-label="Open Camera QR Scanner"
      >
        <QrCode size={22} color="#ffffff" />
        <span>Scan QR</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-btn ${activeTab === 'floormap' ? 'active' : ''}`}
        onClick={() => setActiveTab('floormap')}
      >
        <MapPin size={20} />
        <span>Map</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-btn ${activeTab === 'movements' ? 'active' : ''}`}
        onClick={() => setActiveTab('movements')}
      >
        <ArrowRightLeft size={20} />
        <span>Audit</span>
      </button>
    </nav>
  );
}
