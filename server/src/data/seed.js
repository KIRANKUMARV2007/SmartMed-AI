import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Equipment } from '../models/Equipment.js';
import { Room } from '../models/Room.js';
import { MovementLog } from '../models/MovementLog.js';
import { MaintenanceTicket } from '../models/MaintenanceTicket.js';
import { SEED_EQUIPMENT, SEED_ROOMS, SEED_MOVEMENTS, SEED_MAINTENANCE_TICKETS } from './seedData.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartmed';

async function seed() {
  try {
    console.log(`[Seed] Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('[Seed] Connected.');

    console.log('[Seed] Clearing existing collections...');
    await Promise.all([
      Equipment.deleteMany({}),
      Room.deleteMany({}),
      MovementLog.deleteMany({}),
      MaintenanceTicket.deleteMany({}),
    ]);

    console.log('[Seed] Seeding rooms...');
    await Room.insertMany(SEED_ROOMS);

    console.log('[Seed] Seeding equipment...');
    await Equipment.insertMany(SEED_EQUIPMENT);

    console.log('[Seed] Seeding maintenance tickets...');
    await MaintenanceTicket.insertMany(SEED_MAINTENANCE_TICKETS);

    console.log('[Seed] Seeding movement audit ledger...');
    await MovementLog.insertMany(SEED_MOVEMENTS);

    console.log('✅ [Seed] Successfully seeded all SmartMed hospital collections.');
  } catch (err) {
    console.error(`❌ [Seed] Failed to seed database: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[Seed] Disconnected from MongoDB.');
  }
}

seed();
