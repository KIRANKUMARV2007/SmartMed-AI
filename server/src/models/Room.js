import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
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
    department: {
      type: String,
      required: true,
      trim: true,
    },
    floor: {
      type: String,
      required: true,
      trim: true,
    },
    wing: {
      type: String,
      required: true,
      trim: true,
    },
    capacity: {
      type: Number,
      default: 1,
      min: 0,
    },
    type: {
      type: String,
      enum: [
        'Emergency',
        'Critical Care',
        'Operating Theatre',
        'General Ward',
        'Maintenance Bay',
        'Sanitization',
      ],
      default: 'General Ward',
    },
  },
  {
    timestamps: true,
  }
);

export const Room = mongoose.model('Room', roomSchema);
