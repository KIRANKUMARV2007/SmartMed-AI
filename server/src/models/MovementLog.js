import mongoose from 'mongoose';

const movementLogSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    equipmentId: {
      type: String,
      required: true,
      ref: 'Equipment',
      index: true,
    },
    equipmentName: {
      type: String,
      required: true,
    },
    fromRoom: {
      type: String,
      required: true,
    },
    toRoom: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: -1,
    },
    staffId: {
      type: String,
      required: true,
    },
    staffName: {
      type: String,
      required: true,
    },
    staffRole: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'Dual-QR Verified Relocation',
        'Dual-QR Verified Transfer',
        'Physical Handover Verified (In Use)',
        'Equipment Returned (Sanitization Pending)',
        'Sanitization Clearance',
        'Reservation Placed (30m Expiry)',
        'Reservation Cancelled',
        'Reservation Auto-Released (Expired)',
        'AI-Recommended Emergency Allocation',
        'Biomedical Maintenance Cleared',
        'Asset Commissioning',
        'Maintenance Escalation Transfer',
        'Post-Sanitization Relocation',
      ],
    },
    details: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const MovementLog = mongoose.model('MovementLog', movementLogSchema);
