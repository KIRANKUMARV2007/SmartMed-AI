import { Equipment } from '../models/Equipment.js';
import { MovementLog } from '../models/MovementLog.js';
import { AuditLog } from '../models/AuditLog.js';

/**
 * Checks for and automatically releases any 30-minute reservation holds that have expired.
 * Restores equipment status to 'Available', clears reservation, and records permanent
 * audit ledger and movement log entries.
 *
 * @returns {Promise<Array>} List of equipment records that were released
 */
export async function releaseExpiredReservations() {
  const now = new Date();
  const expiredAssets = await Equipment.find({
    status: 'Reserved',
    'reservation.expiresAt': { $lte: now },
  });

  if (!expiredAssets || expiredAssets.length === 0) {
    return [];
  }

  const released = [];

  for (const asset of expiredAssets) {
    const prevReservedBy = asset.reservation?.reservedBy || 'Clinical Staff';
    const prevDepartment = asset.reservation?.department || 'Emergency Service';

    const updated = await Equipment.findOneAndUpdate(
      {
        id: asset.id,
        status: 'Reserved',
        'reservation.expiresAt': { $lte: now },
      },
      {
        $set: {
          status: 'Available',
          reservation: null,
        },
      },
      { new: true }
    );

    if (updated) {
      released.push(updated);

      try {
        await MovementLog.create({
          id: `MOV-EXP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          equipmentId: updated.id,
          equipmentName: updated.name,
          fromRoom: updated.currentRoom,
          toRoom: updated.currentRoom,
          timestamp: now,
          staffId: 'SYSTEM-CRON',
          staffName: 'SmartMed Automation Engine',
          staffRole: 'System Automation',
          type: 'Reservation Auto-Released (Expired)',
          details: `30-minute reservation hold by ${prevReservedBy} (${prevDepartment}) expired. Asset automatically returned to Available status.`,
        });

        await AuditLog.create({
          id: `AUD-EXP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          action: 'RESERVATION_EXPIRED_RELEASED',
          category: 'EQUIPMENT',
          performedBy: {
            id: 'SYSTEM',
            name: 'SmartMed Automation Engine',
            email: 'system@smartmed.hospital',
            role: 'system',
            department: 'Clinical Operations',
          },
          targetType: 'Equipment',
          targetId: updated.id,
          details: `30-minute emergency hold expired for ${updated.name} (${updated.id}). Automatically restored to Available status.`,
          changes: {
            previousStatus: 'Reserved',
            newStatus: 'Available',
            expiredHoldBy: prevReservedBy,
          },
          ipAddress: '127.0.0.1',
        });
      } catch (logErr) {
        console.warn('[Reservation Expiry Log Warning]', logErr.message);
      }
    }
  }

  return released;
}
