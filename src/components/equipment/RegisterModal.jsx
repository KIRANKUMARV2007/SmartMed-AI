import { useState } from 'react';
import { X, Plus, CheckCircle } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function RegisterModal() {
  const { isRegisterOpen, setIsRegisterOpen, registerEquipment, rooms, activePersona } =
    useEquipment();

  const [formData, setFormData] = useState({
    name: '',
    category: 'Ventilator',
    model: '',
    serialNumber: '',
    currentRoom: rooms[0]?.name || 'ER-101 (Trauma Bay 1)',
    hasBattery: true,
    batteryLevel: 95,
    condition: 'Optimal',
    notes: '',
  });

  const [error, setError] = useState('');

  if (!isRegisterOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please provide an equipment name.');
      return;
    }
    if (!formData.model.trim()) {
      setError('Please specify the equipment model.');
      return;
    }
    if (!formData.serialNumber.trim()) {
      setError('Serial number is required.');
      return;
    }

    registerEquipment({
      ...formData,
      batteryLevel: formData.hasBattery ? Number(formData.batteryLevel) : null,
    });

    setIsRegisterOpen(false);
    setError('');
  };

  return (
    <div className="modal-backdrop" onClick={() => setIsRegisterOpen(false)}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Plus size={20} color="var(--accent-cyan)" />
            <span>Register New Medical Equipment</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setIsRegisterOpen(false)}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Onboarding as{' '}
              <strong style={{ color: 'var(--accent-cyan)' }}>
                {activePersona.name} ({activePersona.role})
              </strong>
              . A unique equipment ID and initial movement record will be generated automatically.
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Equipment Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Servo-u Intensive Care Ventilator"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label className="form-label">Equipment Category *</label>
                <select
                  className="form-select"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="Ventilator">Ventilator</option>
                  <option value="Defibrillator">Defibrillator</option>
                  <option value="Infusion Pump">Infusion Pump</option>
                  <option value="Portable Ultrasound">Portable Ultrasound</option>
                  <option value="ECG Machine">ECG Machine</option>
                  <option value="Patient Monitor">Patient Monitor</option>
                  <option value="Transport Wheelchair">Transport Wheelchair</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Manufacturer & Model *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Getinge Servo-u v4.2"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label className="form-label">Serial Number *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. SN-89421-VX"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Initial Commissioning Room *</label>
                <select
                  className="form-select"
                  value={formData.currentRoom}
                  onChange={(e) => setFormData({ ...formData, currentRoom: e.target.value })}
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} ({r.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label className="form-label">Power & Battery Source</label>
                <select
                  className="form-select"
                  value={formData.hasBattery ? 'battery' : 'ac'}
                  onChange={(e) =>
                    setFormData({ ...formData, hasBattery: e.target.value === 'battery' })
                  }
                >
                  <option value="battery">Internal Battery Powered</option>
                  <option value="ac">Wall AC Only / Non-Electric</option>
                </select>
              </div>

              {formData.hasBattery && (
                <div className="form-group">
                  <label className="form-label">Initial Battery Charge (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="form-input"
                    value={formData.batteryLevel}
                    onChange={(e) =>
                      setFormData({ ...formData, batteryLevel: Number(e.target.value) })
                    }
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Clinical Notes / Initial Commissioning Check</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Initial calibration verified. Safety test passed."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsRegisterOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <CheckCircle size={16} />
              Commission Asset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
