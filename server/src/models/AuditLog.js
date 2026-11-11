import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['AUTH', 'EQUIPMENT', 'USER_MANAGEMENT', 'CLINICAL_OPERATION', 'SYSTEM'],
      default: 'SYSTEM',
    },
    performedBy: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      email: { type: String, default: '' },
      role: { type: String, required: true },
      department: { type: String, default: '' },
    },
    targetType: {
      type: String,
      required: true,
      enum: ['Equipment', 'User', 'Room', 'Maintenance', 'Session', 'System', 'EquipmentRecommendation'],
    },
    targetId: {
      type: String,
      default: '',
    },
    details: {
      type: String,
      default: '',
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: -1,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ 'performedBy.id': 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ category: 1, timestamp: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
