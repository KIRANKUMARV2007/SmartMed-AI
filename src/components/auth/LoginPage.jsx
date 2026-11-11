import { useState } from 'react';
import {
  Shield,
  Stethoscope,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Activity,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Users,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEquipment } from '../../context/EquipmentContext';

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, setTheme } = useEquipment();

  // Portal selection: 'staff' (Hospital Staff) vs 'admin' (Administrator)
  const [portalType, setPortalType] = useState('admin');

  // Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Interaction states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Quick Demo Account Pre-fill helper
  const handlePreFill = (demoEmail, demoPassword, portal) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setPortalType(portal);
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your hospital email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const result = await login({
        email: email.trim(),
        password,
        portalType,
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Authentication service unreachable.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page-container">
      {/* Theme Toggle Button */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 20 }}>
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${theme === 'dark' ? 'Clinical Light' : 'Executive Dark'} Mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="login-card">
        {/* Brand Header */}
        <div className="login-header">
          <div className="login-logo-box">
            <Activity size={26} color="var(--accent-blue, #1D5FC1)" />
          </div>
          <h1 className="login-title">SmartMed</h1>
          <p className="login-subtitle">
            Hospital Equipment Geolocation & Governance System
          </p>
        </div>

        {/* Portal Access-Type Selector */}
        <div className="portal-selector" role="tablist" aria-label="Access portal selection">
          <button
            type="button"
            role="tab"
            aria-selected={portalType === 'admin'}
            className={`portal-tab ${portalType === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setPortalType('admin');
              setErrorMessage('');
            }}
          >
            <Shield size={15} />
            <span>Administrator</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={portalType === 'staff'}
            className={`portal-tab ${portalType === 'staff' ? 'active' : ''}`}
            onClick={() => {
              setPortalType('staff');
              setErrorMessage('');
            }}
          >
            <Stethoscope size={15} />
            <span>Hospital Staff</span>
          </button>
        </div>

        {/* Portal Description Banner */}
        <div className={`portal-banner ${portalType === 'admin' ? 'admin' : 'staff'}`}>
          <div className="portal-banner-icon">
            {portalType === 'admin' ? <Shield size={16} /> : <Users size={16} />}
          </div>
          <div className="portal-banner-content">
            <strong>{portalType === 'admin' ? 'Administrator Portal' : 'Hospital Staff Portal'}</strong>
            <span>
              {portalType === 'admin'
                ? 'Full hospital asset governance, user administration, and regulatory audit trail.'
                : 'Role-scoped clinical workflows for Doctors, Nurses, and Biomedical personnel.'}
            </span>
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="login-error-alert" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <div className="login-error-text">{errorMessage}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label className="login-label" htmlFor="login-email">
              Hospital Email Address
            </label>
            <div className="login-input-container">
              <Mail size={16} className="login-input-icon-left" />
              <input
                id="login-email"
                type="email"
                className="login-input"
                placeholder={
                  portalType === 'admin'
                    ? 'admin@smartmed.hospital'
                    : 'doctor@smartmed.hospital / nurse@smartmed.hospital'
                }
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">
              Secure Password
            </label>
            <div className="login-input-container">
              <Lock size={16} className="login-input-icon-left" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="login-input has-right-icon"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <RotateCcw size={16} className="animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>
                  {portalType === 'admin'
                    ? 'Sign In as Administrator'
                    : 'Sign In as Hospital Staff'}
                </span>
              </>
            )}
          </button>
        </form>

        {/* Quick Pre-Fill Demonstration Tool */}
        <div className="login-demo-wrapper">
          <div className="login-demo-divider">
            <span>Fast Clinical Role Evaluation</span>
          </div>
          <div className="login-demo-grid">
            <button
              type="button"
              className="login-demo-chip"
              onClick={() => handlePreFill('admin@smartmed.hospital', 'Admin@SmartMed2026!', 'admin')}
              title="Chief Operations Admin account"
            >
              <Shield size={13} color="var(--accent-blue, #1D5FC1)" />
              <div className="demo-chip-text">
                <strong>Admin</strong>
                <small>Chief Ops</small>
              </div>
            </button>
            <button
              type="button"
              className="login-demo-chip"
              onClick={() => handlePreFill('doctor@smartmed.hospital', 'Doctor@SmartMed2026!', 'staff')}
              title="Dr. Maya Lin (Emergency Medicine)"
            >
              <Stethoscope size={13} color="var(--status-ready, #0D7D4A)" />
              <div className="demo-chip-text">
                <strong>Doctor</strong>
                <small>Emergency</small>
              </div>
            </button>
            <button
              type="button"
              className="login-demo-chip"
              onClick={() => handlePreFill('nurse@smartmed.hospital', 'Nurse@SmartMed2026!', 'staff')}
              title="Nurse Sarah Jenkins (ICU Charge Nurse)"
            >
              <Activity size={13} color="var(--accent-blue, #1D5FC1)" />
              <div className="demo-chip-text">
                <strong>Nurse</strong>
                <small>ICU Ward</small>
              </div>
            </button>
            <button
              type="button"
              className="login-demo-chip"
              onClick={() => handlePreFill('staff@smartmed.hospital', 'Staff@SmartMed2026!', 'staff')}
              title="Mark Davis (Biomedical Engineering)"
            >
              <Users size={13} color="var(--status-reserved, #9B6B0E)" />
              <div className="demo-chip-text">
                <strong>Staff</strong>
                <small>BioMed</small>
              </div>
            </button>
          </div>
        </div>

        {/* Security & System Info Footer */}
        <div className="login-security-notice">
          <Lock size={12} />
          <span>Server-Verified RBAC • MongoDB Atlas Encrypted • Signed Sessions</span>
        </div>
      </div>
    </div>
  );
}
