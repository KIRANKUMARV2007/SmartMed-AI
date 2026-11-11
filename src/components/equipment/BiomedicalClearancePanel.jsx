import { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function BiomedicalClearancePanel({
  selectedItem = null,
  itemsList = [],
  onSelectItem = null,
  onClear = null,
  canClear = false,
  contextType = 'maintenance',
  title = 'Biomedical Clearance',
  subtitle = 'Equipment safety verification and release approval',
}) {
  const { movements, activePersona } = useEquipment();

  // Active item resolution
  const activeItem =
    selectedItem ||
    (itemsList.length > 0 ? itemsList[0] : null);

  const [selectorOpen, setSelectorOpen] = useState(false);

  // 1. Verification Status Calculation based on real application data
  let verificationStatus = 'Pending';
  let statusTone = 'amber'; // 'green' | 'amber' | 'red'

  if (activeItem) {
    if (activeItem.status === 'Available') {
      verificationStatus = 'Approved';
      statusTone = 'green';
    } else if (activeItem.status === 'Faulty') {
      if (activeItem.risk?.level === 'HIGH') {
        verificationStatus = 'Rejected';
        statusTone = 'red';
      } else {
        verificationStatus = 'Pending';
        statusTone = 'amber';
      }
    } else {
      verificationStatus = 'Pending';
      statusTone = 'amber';
    }
  }

  const isApproved = verificationStatus === 'Approved';
  const isRejected = verificationStatus === 'Rejected';

  // 2. Assigned Biomedical Engineer: Real assigned person or "Not assigned"
  const assignedEngineer =
    activeItem?.lastConfirmedBy && activeItem.lastConfirmedBy.trim().length > 0
      ? activeItem.lastConfirmedBy
      : 'Not assigned';

  // 3. Last Inspection: Actual recorded inspection date or "Not recorded"
  let formattedInspectionDate = 'Not recorded';
  if (activeItem?.lastConfirmedAt) {
    try {
      const date = new Date(activeItem.lastConfirmedAt);
      if (!isNaN(date.getTime())) {
        formattedInspectionDate = date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch {
      formattedInspectionDate = 'Not recorded';
    }
  }

  // 4. Approval Record: Existing approval or audit reference if available, or "Not recorded"
  let approvalRecord = 'Not recorded';
  if (activeItem) {
    const matchingAudit = movements.find(
      (m) =>
        m.equipmentId === activeItem.id &&
        (m.type?.toLowerCase().includes('clearance') ||
          m.type?.toLowerCase().includes('maintenance') ||
          m.type?.toLowerCase().includes('sanitization') ||
          m.type?.toLowerCase().includes('handover') ||
          m.id)
    );
    if (matchingAudit?.id) {
      approvalRecord = matchingAudit.id;
    }
  }

  // 5. Three-Step Workflow State Derivation:
  // Step 1: Equipment Inspection
  // Step 2: Biomedical Verification
  // Step 3: Equipment Release
  let step1State = 'pending'; // 'completed' | 'current' | 'pending'
  let step2State = 'pending';
  let step3State = 'pending';

  if (isApproved) {
    step1State = 'completed';
    step2State = 'completed';
    step3State = 'completed';
  } else if (activeItem) {
    if (activeItem.status === 'Under Maintenance') {
      step1State = 'completed'; // Diagnostic inspection done
      step2State = 'current'; // Hardware verification in progress
      step3State = 'pending';
    } else if (activeItem.status === 'Faulty') {
      step1State = activeItem.lastConfirmedAt ? 'completed' : 'current';
      step2State = step1State === 'completed' ? 'current' : 'pending';
      step3State = 'pending';
    } else if (activeItem.status === 'Sanitization Required') {
      step1State = 'completed';
      step2State = 'current';
      step3State = 'pending';
    } else {
      step1State = 'completed';
      step2State = 'current';
      step3State = 'pending';
    }
  }

  return (
    <div className="biomedical-clearance-panel">
      {/* Panel Header */}
      <div className="biomedical-header-row">
        <div className="biomedical-title-group">
          <h3 className="biomedical-title">
            <ShieldCheck size={20} color={isApproved ? 'var(--status-ready)' : 'var(--accent-blue)'} />
            <span>{title}</span>
          </h3>
          <p className="biomedical-subtitle">{subtitle}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Equipment Selector (if multiple items in queue) */}
          {itemsList.length > 1 && onSelectItem && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="biomedical-selector-btn"
                onClick={() => setSelectorOpen((prev) => !prev)}
                title="Select equipment to inspect"
              >
                <span>
                  Asset: <strong>{activeItem ? `${activeItem.name} (${activeItem.id})` : 'Select equipment'}</strong>
                </span>
                <ChevronDown size={14} />
              </button>

              {selectorOpen && (
                <div className="biomedical-selector-dropdown">
                  {itemsList.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`biomedical-selector-option ${item.id === activeItem?.id ? 'active' : ''}`}
                      onClick={() => {
                        onSelectItem(item);
                        setSelectorOpen(false);
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {item.id} • {item.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active Verifier Badge */}
          {activePersona && (
            <div className="biomedical-verifier-pill">
              <UserCheck size={14} color="var(--accent-blue)" />
              <span>
                Authorized Verifier: <strong>{activePersona.name}</strong> ({activePersona.role})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Status & Workflow Card (Left) + Approval Details Card (Right) */}
      <div className="biomedical-main-grid">
        {/* Left: Status Card & 3-Step Clearance Workflow */}
        <div className={`biomedical-status-card ${statusTone}`}>
          {/* Status Header */}
          <div className="biomedical-status-top">
            <div className="biomedical-status-identity">
              <div
                className="biomedical-status-icon-wrap"
                style={{
                  background:
                    isApproved
                      ? 'var(--status-ready-bg)'
                      : isRejected
                      ? 'var(--status-faulty-bg)'
                      : 'rgba(217, 119, 6, 0.12)',
                  color:
                    isApproved
                      ? 'var(--status-ready)'
                      : isRejected
                      ? 'var(--status-faulty)'
                      : 'var(--status-maintenance)',
                }}
              >
                {isApproved ? (
                  <ShieldCheck size={22} />
                ) : isRejected ? (
                  <AlertTriangle size={22} />
                ) : (
                  <ShieldCheck size={22} />
                )}
              </div>
              <div>
                <span className="biomedical-status-label">
                  {isApproved
                    ? 'Approved for Use'
                    : isRejected
                    ? 'Verification Rejected'
                    : 'Awaiting Final Approval'}
                </span>
                {activeItem && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Asset: {activeItem.name} ({activeItem.id})
                  </div>
                )}
              </div>
            </div>

            {/* Badge */}
            {isApproved ? (
              <span className="biomedical-badge-approved">Approved for Use</span>
            ) : isRejected ? (
              <span className="biomedical-badge-rejected">Release Blocked</span>
            ) : (
              <span className="biomedical-badge-restricted">Release Restricted</span>
            )}
          </div>

          {/* Supporting Text */}
          <p className="biomedical-supporting-text">
            {isApproved
              ? activeItem?.notes ||
                'This equipment has passed biomedical verification and is authorized for active clinical deployment.'
              : 'This equipment is awaiting verification by an authorized biomedical engineer.'}
          </p>

          {/* 3-Step Clearance Workflow Progress Indicator */}
          <div className="biomedical-workflow-stepper">
            {/* Step 1: Equipment Inspection */}
            <div className={`workflow-step ${step1State}`}>
              <div className={`workflow-step-circle ${step1State}`}>
                {step1State === 'completed' ? (
                  <Check size={14} />
                ) : step1State === 'current' ? (
                  <Clock size={13} />
                ) : (
                  '1'
                )}
              </div>
              <span className="workflow-step-title">1. Equipment Inspection</span>
              <span className="workflow-step-state">
                {step1State === 'completed'
                  ? 'Completed'
                  : step1State === 'current'
                  ? 'In Progress'
                  : 'Pending'}
              </span>
            </div>

            <div className={`workflow-step-connector ${step1State === 'completed' ? 'active' : ''}`} />

            {/* Step 2: Biomedical Verification */}
            <div className={`workflow-step ${step2State}`}>
              <div className={`workflow-step-circle ${step2State}`}>
                {step2State === 'completed' ? (
                  <Check size={14} />
                ) : step2State === 'current' ? (
                  <Clock size={13} />
                ) : (
                  '2'
                )}
              </div>
              <span className="workflow-step-title">2. Biomedical Verification</span>
              <span className="workflow-step-state">
                {step2State === 'completed'
                  ? 'Verified'
                  : step2State === 'current'
                  ? 'In Progress'
                  : 'Pending'}
              </span>
            </div>

            <div className={`workflow-step-connector ${step2State === 'completed' ? 'active' : ''}`} />

            {/* Step 3: Equipment Release */}
            <div className={`workflow-step ${step3State}`}>
              <div className={`workflow-step-circle ${step3State}`}>
                {step3State === 'completed' ? (
                  <Check size={14} />
                ) : (
                  '3'
                )}
              </div>
              <span className="workflow-step-title">3. Equipment Release</span>
              <span className="workflow-step-state">
                {step3State === 'completed' ? 'Approved' : 'Pending'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Premium Approval Card */}
        <div className="biomedical-approval-card">
          <div className="biomedical-meta-grid">
            {/* Field 1: Verification Status */}
            <div className="biomedical-meta-item">
              <span className="biomedical-meta-label">Verification Status</span>
              <div style={{ marginTop: 2 }}>
                <span
                  className={`status-pill ${
                    verificationStatus === 'Approved'
                      ? 'available'
                      : verificationStatus === 'Rejected'
                      ? 'faulty'
                      : 'maintenance'
                  }`}
                  style={{ display: 'inline-flex', padding: '3px 10px', fontSize: 12 }}
                >
                  {verificationStatus}
                </span>
              </div>
            </div>

            {/* Field 2: Assigned Biomedical Engineer */}
            <div className="biomedical-meta-item">
              <span className="biomedical-meta-label">Assigned Biomedical Engineer</span>
              <span className="biomedical-meta-value">
                {assignedEngineer}
              </span>
            </div>

            {/* Field 3: Last Inspection */}
            <div className="biomedical-meta-item">
              <span className="biomedical-meta-label">Last Inspection</span>
              <span className="biomedical-meta-value">
                {formattedInspectionDate}
              </span>
            </div>

            {/* Field 4: Approval Record */}
            <div className="biomedical-meta-item">
              <span className="biomedical-meta-label">Approval Record</span>
              <span
                className="biomedical-meta-value"
                style={{
                  fontFamily: approvalRecord !== 'Not recorded' ? 'JetBrains Mono, monospace' : 'inherit',
                  fontSize: 12.5,
                }}
              >
                {approvalRecord}
              </span>
            </div>
          </div>

          {/* Card Footer: Action button & safety note */}
          <div className="biomedical-actions-row">
            {canClear && onClear && activeItem && (
              <button
                type="button"
                className="btn-primary biomedical-clear-btn"
                onClick={() => onClear(activeItem)}
                title={`Authorize release as ${activePersona?.name || 'Biomedical Engineer'}`}
              >
                <Check size={15} />
                <span>
                  {contextType === 'sanitization'
                    ? 'Clear Decontamination & Release'
                    : 'Authorize & Release Equipment'}
                </span>
              </button>
            )}

            {isApproved && (
              <div className="biomedical-cleared-notice">
                <CheckCircle2 size={16} color="var(--status-ready)" />
                <span>Equipment cleared for patient care</span>
              </div>
            )}

            {/* Secondary safety note */}
            <span className="biomedical-secondary-note">
              Equipment release requires verified biomedical approval.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
