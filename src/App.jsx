import { AuthProvider, useAuth } from './context/AuthContext';
import { EquipmentProvider, useEquipment } from './context/EquipmentContext';
import LoginPage from './components/auth/LoginPage';
import ErrorBoundary from './components/common/ErrorBoundary';
import DemoBanner from './components/common/DemoBanner';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import MetricCards from './components/dashboard/MetricCards';
import FilterToolbar from './components/dashboard/FilterToolbar';
import EquipmentTable from './components/dashboard/EquipmentTable';
import RecentMovements from './components/dashboard/RecentMovements';
import MaintenanceAlerts from './components/dashboard/MaintenanceAlerts';
import FloorMapPreview from './components/dashboard/FloorMapPreview';
import AdminDashboard from './components/admin/AdminDashboard';
import UserManagementView from './components/admin/UserManagementView';
import AuditLogsView from './components/admin/AuditLogsView';
import FloorMapView from './components/views/FloorMapView';
import MovementAuditView from './components/views/MovementAuditView';
import MaintenanceView from './components/views/MaintenanceView';
import SanitizationView from './components/views/SanitizationView';
import EmergencyAllocationView from './components/views/EmergencyAllocationView';
import AIRecommendationView from './components/views/AIRecommendationView';
import ReportsView from './components/views/ReportsView';
import EquipmentDetailModal from './components/equipment/EquipmentDetailModal';
import RegisterModal from './components/equipment/RegisterModal';
import EditEquipmentModal from './components/equipment/EditEquipmentModal';
import BookingModal from './components/booking/BookingModal';
import HandoverModal from './components/booking/HandoverModal';
import QRScannerModal from './components/qr/QRScannerModal';
import QRCardModal from './components/qr/QRCardModal';
import MobileBottomNav from './components/layout/MobileBottomNav';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import './App.css';

function AccessDeniedView({ requiredRole = 'Administrator', onReturn }) {
  return (
    <div
      style={{
        margin: '40px auto',
        maxWidth: 520,
        padding: '36px 28px',
        background: 'var(--bg-card, #0f172a)',
        border: '1px solid var(--border-card, #1e293b)',
        borderRadius: 'var(--radius-xl, 12px)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        boxShadow: 'var(--shadow-card, 0 4px 16px rgba(0,0,0,0.15))',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--status-faulty, #ef4444)',
        }}
      >
        <ShieldAlert size={28} />
      </div>
      <div>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
          Access Restricted
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5 }}>
          This administrative resource requires <strong>{requiredRole}</strong> privileges. Your account does not have sufficient security clearance to view this module.
        </p>
      </div>
      <button
        type="button"
        className="btn-primary"
        onClick={onReturn}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', fontSize: 13, marginTop: 4 }}
      >
        <ArrowLeft size={15} />
        <span>Return to Clinical Dashboard</span>
      </button>
    </div>
  );
}

function AppContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { activeTab, setActiveTab } = useEquipment();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-canvas, #090d16)',
          color: 'var(--text-primary, #f1f5f9)',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            border: '3px solid rgba(29, 95, 193, 0.2)',
            borderTopColor: 'var(--accent-blue, #1d5fc1)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>SmartMed Clinical Operating System</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted, #94a3b8)' }}>
            Verifying cryptographic credentials and session tokens...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const isAdmin = user?.role === 'admin';
  const isDoctor = user?.role === 'doctor';

  return (
    <div className="app-container">
      <Sidebar />

      <main className="main-content">
        <DemoBanner />
        <Navbar />

        <div className="content-body">
          {activeTab === 'dashboard' && (
            isAdmin ? (
              <ErrorBoundary moduleName="Administrative Overview" onReset={() => setActiveTab('dashboard')}>
                <AdminDashboard />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary moduleName="Clinical Dashboard" onReset={() => setActiveTab('dashboard')}>
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
              </ErrorBoundary>
            )
          )}

          {activeTab === 'inventory' && (
            <ErrorBoundary moduleName="Equipment Inventory" onReset={() => setActiveTab('inventory')}>
              <div className="dashboard-view-wrapper">
                <FilterToolbar />
                <EquipmentTable />
              </div>
            </ErrorBoundary>
          )}

          {activeTab === 'ai-recommend' && (
            <ErrorBoundary moduleName="SmartMed AI Recommender" onReset={() => setActiveTab('ai-recommend')}>
              <AIRecommendationView />
            </ErrorBoundary>
          )}

          {activeTab === 'floormap' && (
            <ErrorBoundary moduleName="Ward Floor Map" onReset={() => setActiveTab('floormap')}>
              <FloorMapView />
            </ErrorBoundary>
          )}

          {activeTab === 'movements' && (
            <ErrorBoundary moduleName="Movement History" onReset={() => setActiveTab('movements')}>
              <MovementAuditView />
            </ErrorBoundary>
          )}

          {activeTab === 'maintenance' && (
            <ErrorBoundary moduleName="Biomedical Maintenance" onReset={() => setActiveTab('maintenance')}>
              <MaintenanceView />
            </ErrorBoundary>
          )}

          {activeTab === 'sanitization' && (
            <ErrorBoundary moduleName="Sanitization Protocol" onReset={() => setActiveTab('sanitization')}>
              <SanitizationView />
            </ErrorBoundary>
          )}

          {activeTab === 'emergency' && (
            <ErrorBoundary moduleName="Emergency Allocation" onReset={() => setActiveTab('emergency')}>
              <EmergencyAllocationView />
            </ErrorBoundary>
          )}

          {activeTab === 'reports' && (
            <ErrorBoundary moduleName="Reports & Data Export" onReset={() => setActiveTab('reports')}>
              <ReportsView />
            </ErrorBoundary>
          )}

          {/* Admin Protected Views with Access Denied Fallback */}
          {activeTab === 'users' && (
            isAdmin ? (
              <ErrorBoundary moduleName="User Management" onReset={() => setActiveTab('users')}>
                <UserManagementView />
              </ErrorBoundary>
            ) : (
              <AccessDeniedView requiredRole="Administrator" onReturn={() => setActiveTab('dashboard')} />
            )
          )}

          {activeTab === 'audit' && (
            isAdmin || isDoctor ? (
              <ErrorBoundary moduleName="Audit Trail" onReset={() => setActiveTab('audit')}>
                <AuditLogsView />
              </ErrorBoundary>
            ) : (
              <AccessDeniedView requiredRole="Administrator or Physician" onReturn={() => setActiveTab('dashboard')} />
            )
          )}
        </div>
      </main>

      {/* Global Interactive Modals & Workflows */}
      <EquipmentDetailModal />
      <RegisterModal />
      <EditEquipmentModal />
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
    <ErrorBoundary moduleName="SmartMed Application Root">
      <AuthProvider>
        <EquipmentProvider>
          <AppContent />
        </EquipmentProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
