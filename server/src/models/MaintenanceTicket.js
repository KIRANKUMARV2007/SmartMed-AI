import mongoose from 'mongoose';

const maintenanceTicketSchema = new mongoose.Schema(
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
    severity: {
      type: String,
      required: true,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    currentRoom: {
      type: String,
      required: true,
    },
    reportedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE_FAULT', 'IN_PROGRESS', 'ATTENTION_NEEDED', 'RESOLVED'],
      default: 'ACTIVE_FAULT',
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: String,
      default: null,
    },
    resolutionNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

maintenanceTicketSchema.index({ status: 1, severity: 1 });

export const MaintenanceTicket = mongoose.model(
  'MaintenanceTicket',
  maintenanceTicketSchema
);
