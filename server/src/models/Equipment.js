import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema(
  {
    reservedBy: { type: String, required: true },
    staffId: { type: String, required: true },
    department: { type: String, required: true },
    reservedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    purpose: { type: String, required: true },
    handedOverAt: { type: Date, default: null },
    handedOverBy: { type: String, default: null },
  },
  { _id: false }
);

const equipmentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Ventilator',
        'Defibrillator',
        'Infusion Pump',
        'Portable Ultrasound',
        'ECG Machine',
        'Patient Monitor',
        'Transport Wheelchair',
      ],
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    serialNumber: {
      type: String,
      required: true,
      trim: true,
    },
    currentRoom: {
      type: String,
      required: true,
      trim: true,
    },
    roomId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: [
        'Available',
        'Reserved',
        'In Use',
        'Sanitization Required',
        'Under Maintenance',
        'Faulty',
      ],
      default: 'Available',
    },
    sanitizationStatus: {
      type: String,
      enum: ['CLEARED', 'PENDING'],
      default: 'CLEARED',
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    hasBattery: {
      type: Boolean,
      default: false,
    },
    condition: {
      type: String,
      enum: ['Optimal', 'Good', 'Fair'],
      default: 'Optimal',
    },
    lastConfirmedAt: {
      type: Date,
      default: Date.now,
    },
    lastConfirmedBy: {
      type: String,
      default: 'System Registry',
    },
    lastSanitizedAt: {
      type: Date,
      default: null,
    },
    nextMaintenanceDate: {
      type: String,
      default: null,
    },
    operatingHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalUsageSessions: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: '',
    },
    reservation: {
      type: reservationSchema,
      default: null,
    },
    // Optional clinical capabilities & runtime benchmarks for AI Decision Support
    verifiedRuntimeMinutes: {
      type: Number,
      default: null,
      min: 0,
    },
    // Battery Runtime Intelligence & Measurement Telemetry Metadata
    batteryRuntime: {
      verifiedMinutes: {
        type: Number,
        default: null,
        min: 0,
      },
      verificationStatus: {
        type: String,
        enum: ['VERIFIED', 'ESTIMATED', 'UNVERIFIED', 'STALE', 'NOT_APPLICABLE'],
        default: 'UNVERIFIED',
      },
      source: {
        type: String,
        enum: [
          'BIOMEDICAL_BENCHMARK',
          'DISCHARGE_CYCLE_TEST',
          'BATTERY_CALIBRATION',
          'MANUFACTURER_RATING',
          'TELEMETRY_ESTIMATE',
          'UNSPECIFIED',
        ],
        default: 'UNSPECIFIED',
      },
      lastMeasuredAt: {
        type: Date,
        default: null,
      },
      verifiedBy: {
        type: String,
        default: null,
      },
      testLoadProfile: {
        type: String,
        default: null,
      },
    },
    clinicalCapabilities: {
      type: [String],
      default: [],
    },
    compatibilitySpecs: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to ensure synchronization between verifiedRuntimeMinutes and batteryRuntime.verifiedMinutes
equipmentSchema.pre('save', function (next) {
  if (this.verifiedRuntimeMinutes !== null && this.verifiedRuntimeMinutes !== undefined) {
    if (!this.batteryRuntime) {
      this.batteryRuntime = {};
    }
    if (this.batteryRuntime.verifiedMinutes === null || this.batteryRuntime.verifiedMinutes === undefined) {
      this.batteryRuntime.verifiedMinutes = this.verifiedRuntimeMinutes;
    }
  } else if (this.batteryRuntime?.verifiedMinutes !== null && this.batteryRuntime?.verifiedMinutes !== undefined) {
    this.verifiedRuntimeMinutes = this.batteryRuntime.verifiedMinutes;
  }
  next();
});

// Helpful compound indexes for queries & atomic availability checking
equipmentSchema.index({ status: 1, category: 1 });
equipmentSchema.index({ currentRoom: 1 });

export const Equipment = mongoose.model('Equipment', equipmentSchema);
