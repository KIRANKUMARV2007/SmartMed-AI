import { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, RotateCcw } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function EditEquipmentModal() {
  const { editingEquipment, setEditingEquipment, updateEquipment, rooms } = useEquipment();

  const [formData, setFormData] = useState({
    name: '',
    category: 'Ventilator',
    model: '',
    serialNumber: '',
    currentRoom: '',
    hasBattery: false,
    batteryLevel: 100,
    condition: 'Optimal',
    status: 'Available',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingEquipment) {
      setFormData({
        name: editingEquipment.name || '',
        category: editingEquipment.category || 'Ventilator',
        model: editingEquipment.model || '',
        serialNumber: editingEquipment.serialNumber || '',
        currentRoom: editingEquipment.currentRoom || (rooms[0]?.name || ''),
        hasBattery: !!editingEquipment.hasBattery,
        batteryLevel: editingEquipment.batteryLevel !== null ? editingEquipment.batteryLevel : 100,
        condition: editingEquipment.condition || 'Optimal',
        status: editingEquipment.status || 'Available',
        notes: editingEquipment.notes || '',
      });
      setError('');
    }
  }, [editingEquipment, rooms]);

  if (!editingEquipment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Equipment name is required.');
      return;
    }
    if (!formData.model.trim()) {
      setError('Model is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const result = await updateEquipment(editingEquipment.id, {
        ...formData,
        batteryLevel: formData.hasBattery ? Number(formData.batteryLevel) : null,
      });

      if (result && result.success === false) {
        setError(result.error || 'Failed to update equipment specifications.');
        return;
      }

      setEditingEquipment(null);
    } catch (err) {
      setError(err?.message || 'Error updating equipment on backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !isSubmitting && setEditingEquipment(null)}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Save size={18} color="var(--accent-cyan)" />
            <span>Admin Edit: {editingEquipment.id}</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => !isSubmitting && setEditingEquipment(null)}
            disabled={isSubmitting}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--status-faulty-bg)',
                  border: '1px solid var(--status-faulty-border)',
                  color: 'var(--status-faulty)',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Equipment Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label className="form-label">Category *</label>
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
                <label className="form-label">Model *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label className="form-label">Serial Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Current Room Assignment</label>
                <select
                  className="form-select"
                  value={formData.currentRoom}
                  onChange={(e) => setFormData({ ...formData, currentRoom: e.target.value })}
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label className="form-label">Administrative Status</label>
                <select
                  className="form-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Available">Available (Ready for Use)</option>
                  <option value="Reserved">Reserved (Clinical Hold)</option>
                  <option value="In Use">In Use (Active Patient Care)</option>
                  <option value="Sanitization Required">Sanitization Required</option>
                  <option value="Under Maintenance">Under Maintenance (BioMed)</option>
                  <option value="Faulty">Faulty (Decommissioned/Broken)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Physical Condition</label>
                <select
                  className="form-select"
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                >
                  <option value="Optimal">Optimal</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                </select>
              </div>
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label className="form-label">Battery Powered</label>
                <select
                  className="form-select"
                  value={formData.hasBattery ? 'yes' : 'no'}
                  onChange={(e) =>
                    setFormData({ ...formData, hasBattery: e.target.value === 'yes' })
                  }
                >
                  <option value="yes">Internal Battery</option>
                  <option value="no">Wall AC / Non-Electric</option>
                </select>
              </div>

              {formData.hasBattery && (
                <div className="form-group">
                  <label className="form-label">Battery Level (%)</label>
                  <input
                    type="number"
                    min="0"
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
              <label className="form-label">Technical & Governance Notes</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Asset calibration records or biomedical inspection notes..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => !isSubmitting && setEditingEquipment(null)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <RotateCcw size={15} className="animate-spin" />
                  Saving Updates...
                </>
              ) : (
                <>
                  <Save size={15} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
