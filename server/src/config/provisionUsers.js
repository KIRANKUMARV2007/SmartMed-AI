import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';

/**
 * Non-destructive initial account provisioner.
 * Automatically ensures default administrative and clinical accounts exist in MongoDB
 * without altering or resetting any existing data or equipment.
 */
export async function provisionInitialAccounts() {
  try {
    const adminExists = await User.findOne({ role: 'admin' });

    if (!adminExists) {
      const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@smartmed.hospital';
      const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@SmartMed2026!';
      const adminName = process.env.INITIAL_ADMIN_NAME || 'Elena Rostova, Chief Operations Admin';

      const initialAdmin = await User.create({
        id: 'ADM-1001',
        name: adminName,
        email: adminEmail.toLowerCase().trim(),
        password: adminPassword,
        role: 'admin',
        department: 'Operations & Asset Governance',
        badge: 'System Administrator',
        status: 'active',
      });

      await AuditLog.create({
        id: `AUD-SYS-${Date.now()}`,
        action: 'INITIAL_ADMIN_PROVISIONED',
        category: 'SYSTEM',
        performedBy: { id: 'SYSTEM', name: 'SmartMed Provisioner', email: 'system@smartmed.local', role: 'system' },
        targetType: 'User',
        targetId: initialAdmin.id,
        details: `Initial administrator provisioned for email ${adminEmail}.`,
      });

      console.log(`[SmartMed Provisioner] Default administrator provisioned: ${adminEmail}`);
    }

    // Baseline clinical staff accounts for testing role differences
    const baselineStaff = [
      {
        id: 'DOC-8491',
        name: 'Dr. Maya Lin',
        email: 'doctor@smartmed.hospital',
        password: process.env.INITIAL_DOCTOR_PASSWORD || 'Doctor@SmartMed2026!',
        role: 'doctor',
        department: 'Emergency Medicine',
        badge: 'Staff Physician',
      },
      {
        id: 'NUR-2305',
        name: 'Nurse Sarah Jenkins, RN',
        email: 'nurse@smartmed.hospital',
        password: process.env.INITIAL_NURSE_PASSWORD || 'Nurse@SmartMed2026!',
        role: 'nurse',
        department: 'Intensive Care Unit (ICU)',
        badge: 'Charge Nurse',
      },
      {
        id: 'STF-4412',
        name: 'Mark Davis, CBET',
        email: 'staff@smartmed.hospital',
        password: process.env.INITIAL_STAFF_PASSWORD || 'Staff@SmartMed2026!',
        role: 'staff',
        department: 'Biomedical Engineering',
        badge: 'Biomedical Technician',
      },
    ];

    for (const staff of baselineStaff) {
      const exists = await User.findOne({ email: staff.email.toLowerCase() });
      if (!exists) {
        await User.create({
          id: staff.id,
          name: staff.name,
          email: staff.email.toLowerCase(),
          password: staff.password,
          role: staff.role,
          department: staff.department,
          badge: staff.badge,
          status: 'active',
        });
        console.log(`[SmartMed Provisioner] Baseline ${staff.role} provisioned: ${staff.email}`);
      }
    }
  } catch (err) {
    console.warn(`[SmartMed Provisioner] Initial user check skipped or failed: ${err.message}`);
  }
}
