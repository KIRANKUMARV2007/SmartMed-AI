import { EquipmentProvider, useEquipment } from './context/EquipmentContext';
import DemoBanner from './components/common/DemoBanner';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import MetricCards from './components/dashboard/MetricCards';
import FilterToolbar from './components/dashboard/FilterToolbar';
import EquipmentTable from './components/dashboard/EquipmentTable';
import RecentMovements from './components/dashboard/RecentMovements';
import MaintenanceAlerts from './components/dashboard/MaintenanceAlerts';
import FloorMapPreview from './components/dashboard/FloorMapPreview';
import FloorMapView from './components/views/FloorMapView';
import MovementAuditView from './components/views/MovementAuditView';
import MaintenanceView from './components/views/MaintenanceView';
import EquipmentDetailModal from './components/equipment/EquipmentDetailModal';
import RegisterModal from './components/equipment/RegisterModal';
import BookingModal from './components/booking/BookingModal';
import HandoverModal from './components/booking/HandoverModal';
import QRScannerModal from './components/qr/QRScannerModal';
import QRCardModal from './components/qr/QRCardModal';
import MobileBottomNav from './components/layout/MobileBottomNav';
import './App.css';

function AppContent() {
  const { activeTab } = useEquipment();

  return (
    <div className="app-container">
      <Sidebar />

      <main className="main-content">
        <DemoBanner />
        <Navbar />

        <div className="content-body">
          {activeTab === 'dashboard' && (
            <div className="dashboard-view-wrapper">
              <MetricCards />
              <FilterToolbar />
              <EquipmentTable />

              <div className="dashboard-lower-grid">
                <RecentMovements />
                <MaintenanceAlerts />
                <FloorMapPreview />
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="dashboard-view-wrapper">
              <FilterToolbar />
              <EquipmentTable />
            </div>
          )}

          {activeTab === 'floormap' && <FloorMapView />}

          {activeTab === 'movements' && <MovementAuditView />}

          {activeTab === 'maintenance' && <MaintenanceView />}
        </div>
      </main>

      {/* Global Interactive Modals & Workflows */}
      <EquipmentDetailModal />
      <RegisterModal />
      <BookingModal />
      <HandoverModal />
      <QRScannerModal />
      <QRCardModal />
      {/* Mobile Navigation Bar */}
      <MobileBottomNav />
    </div>
  );
}

export default function App() {
  return (
    <EquipmentProvider>
      <AppContent />
    </EquipmentProvider>
  );
}
