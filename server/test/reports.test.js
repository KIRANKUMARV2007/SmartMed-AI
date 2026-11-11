import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { JWT_SECRET } from '../src/middleware/auth.js';

function createToken(role = 'admin', id = 'ADM-01', name = 'Test Admin') {
  return jwt.sign(
    {
      id,
      email: `${role}@smartmed.hospital`,
      role,
      name,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

test('SmartMed Centralized Report Generation & Export Suite', async (t) => {
  const adminToken = createToken('admin', 'ADM-01', 'Elena Rostova');
  const doctorToken = createToken('doctor', 'DOC-01', 'Dr. Maya Lin');
  const nurseToken = createToken('nurse', 'NUR-01', 'Nurse Sarah Jenkins');
  const staffToken = createToken('staff', 'STF-01', 'Mark Davis');

  await t.test('1. Security & Authentication Guardrails', async (t2) => {
    await t2.test('GET /api/reports/types rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/reports/types');
      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'UNAUTHENTICATED');
    });

    await t2.test('GET /api/reports/preview rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/reports/preview?type=inventory');
      assert.equal(res.status, 401);
    });

    await t2.test('GET /api/reports/export rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/reports/export?type=inventory&format=csv');
      assert.equal(res.status, 401);
    });
  });

  await t.test('2. Report Catalog & Role Metadata', async (t2) => {
    await t2.test('GET /api/reports/types returns all 8 report types', async () => {
      const res = await request(app)
        .get('/api/reports/types')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.reportTypes));
      assert.equal(res.body.reportTypes.length, 8);

      const typeIds = res.body.reportTypes.map((r) => r.id);
      assert.ok(typeIds.includes('inventory'));
      assert.ok(typeIds.includes('movements'));
      assert.ok(typeIds.includes('reservations'));
      assert.ok(typeIds.includes('maintenance'));
      assert.ok(typeIds.includes('sanitization'));
      assert.ok(typeIds.includes('utilization'));
      assert.ok(typeIds.includes('emergency'));
      assert.ok(typeIds.includes('audit'));
    });

    await t2.test('Audit report accessibility flag respects role tiers', async () => {
      // Nurse view
      const nurseRes = await request(app)
        .get('/api/reports/types')
        .set('Authorization', `Bearer ${nurseToken}`);

      const nurseAudit = nurseRes.body.reportTypes.find((r) => r.id === 'audit');
      assert.equal(nurseAudit.isAccessible, false, 'Nurse should not have audit report accessibility');

      // Admin view
      const adminRes = await request(app)
        .get('/api/reports/types')
        .set('Authorization', `Bearer ${adminToken}`);

      const adminAudit = adminRes.body.reportTypes.find((r) => r.id === 'audit');
      assert.equal(adminAudit.isAccessible, true, 'Admin must have audit report accessibility');
    });
  });

  await t.test('3. Query Validation & Parameter Guardrails', async (t2) => {
    await t2.test('Rejects invalid report type with 400 INVALID_REPORT_TYPE', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=non_existent_type')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_REPORT_TYPE');
    });

    await t2.test('Rejects invalid date format with 400 INVALID_DATE_FORMAT', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=inventory&startDate=invalid-date')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_DATE_FORMAT');
    });

    await t2.test('Rejects startDate > endDate with 400 INVALID_DATE_RANGE', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=inventory&startDate=2026-12-31&endDate=2026-01-01')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_DATE_RANGE');
    });

    await t2.test('Rejects unsupported export format with 400 INVALID_EXPORT_FORMAT', async () => {
      const res = await request(app)
        .get('/api/reports/export?type=inventory&format=docx')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_EXPORT_FORMAT');
    });
  });

  await t.test('4. All 8 Report Preview Implementations', async (t2) => {
    // 1. Inventory Report
    await t2.test('Inventory Report: Returns KPI summary and tabular columns', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=inventory')
        .set('Authorization', `Bearer ${nurseToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.report.reportType, 'inventory');
      assert.ok(res.body.report.summary.totalEquipment > 0);
      assert.ok(Array.isArray(res.body.report.rows));
      assert.ok(res.body.report.columns.some((c) => c.key === 'equipmentId'));
      assert.ok(res.body.report.columns.some((c) => c.key === 'currentRoom'));
    });

    // 2. Movements Report
    await t2.test('Movements Report: Returns chain of custody and transfer logs', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=movements')
        .set('Authorization', `Bearer ${nurseToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.report.reportType, 'movements');
      assert.ok(Array.isArray(res.body.report.rows));
      assert.ok(res.body.report.columns.some((c) => c.key === 'fromRoom'));
      assert.ok(res.body.report.columns.some((c) => c.key === 'toRoom'));
    });

    // 3. Reservations Report
    await t2.test('Reservations Report: Returns active holds and historical releases', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=reservations')
        .set('Authorization', `Bearer ${doctorToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.report.reportType, 'reservations');
      assert.ok(Array.isArray(res.body.report.rows));
      assert.ok(res.body.report.columns.some((c) => c.key === 'reservationId'));
      assert.ok(res.body.report.columns.some((c) => c.key === 'status'));
    });

    // 4. Maintenance Report
    await t2.test('Maintenance Report: Returns hardware tickets and AI failure risk score', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=maintenance')
        .set('Authorization', `Bearer ${staffToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.report.reportType, 'maintenance');
      assert.ok(Array.isArray(res.body.report.rows));
      assert.ok(res.body.report.columns.some((c) => c.key === 'severity'));
      assert.ok(res.body.report.columns.some((c) => c.key === 'aiFailureRiskScore'));
    });

    // 5. Sanitization Report
    await t2.test('Sanitization Report: Returns terminal decontamination and readiness', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=sanitization')
        .set('Authorization', `Bearer ${nurseToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.report.reportType, 'sanitization');
      assert.ok(Array.isArray(res.body.report.rows));
      assert.ok(res.body.report.summary.clinicalReadinessIndex !== undefined);
      assert.ok(res.body.report.columns.some((c) => c.key === 'clinicalReadiness'));
    });

    // 6. Utilization Report
    await t2.test('Utilization Report: Returns operating hours and duty cycle profiles', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=utilization')
        .set('Authorization', `Bearer ${staffToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.report.reportType, 'utilization');
      assert.ok(Array.isArray(res.body.report.rows));
      assert.ok(res.body.report.summary.totalFleetOperatingHours > 0);
      assert.ok(res.body.report.columns.some((c) => c.key === 'operatingHours'));
      assert.ok(res.body.report.columns.some((c) => c.key === 'utilizationProfile'));
    });

    // 7. Emergency Allocation Report
    await t2.test('Emergency Allocation Report: Returns STAT dispatch records', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=emergency')
        .set('Authorization', `Bearer ${nurseToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.report.reportType, 'emergency');
      assert.ok(Array.isArray(res.body.report.rows));
      assert.ok(res.body.report.columns.some((c) => c.key === 'targetRoom'));
    });

    // 8. Audit Report (RBAC Security)
    await t2.test('Audit Report: Rejects Nurse role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=audit')
        .set('Authorization', `Bearer ${nurseToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /require Administrator or Physician clearance/i);
    });

    await t2.test('Audit Report: Rejects Staff role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=audit')
        .set('Authorization', `Bearer ${staffToken}`);

      assert.equal(res.status, 403);
    });

    await t2.test('Audit Report: Authorizes Doctor role with 200 OK', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=audit')
        .set('Authorization', `Bearer ${doctorToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.report.reportType, 'audit');
    });

    await t2.test('Audit Report: Authorizes Admin role with 200 OK', async () => {
      const res = await request(app)
        .get('/api/reports/preview?type=audit')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.report.reportType, 'audit');
      assert.ok(Array.isArray(res.body.report.rows));
      assert.ok(res.body.report.columns.some((c) => c.key === 'auditId'));
    });
  });

  await t.test('5. Multi-Format Export Downloads (CSV, Excel, PDF)', async (t2) => {
    // CSV Export
    await t2.test('GET /api/reports/export?format=csv returns text/csv with attachment header', async () => {
      const res = await request(app)
        .get('/api/reports/export?type=inventory&format=csv')
        .set('Authorization', `Bearer ${nurseToken}`);

      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /text\/csv/);
      assert.match(res.headers['content-disposition'], /attachment;\s*filename="SmartMed_inventory_report/);
      assert.match(res.text, /SMARTMED AI CLINICAL FLEET OPERATIONS REPORT/);
      assert.match(res.text, /Asset ID/);
    });

    // Excel (.xlsx) Export
    await t2.test('GET /api/reports/export?format=xlsx returns valid binary spreadsheet', async () => {
      const res = await request(app)
        .get('/api/reports/export?type=inventory&format=xlsx')
        .set('Authorization', `Bearer ${adminToken}`)
        .responseType('blob');

      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /openxmlformats-officedocument\.spreadsheetml\.sheet/);
      assert.match(res.headers['content-disposition'], /\.xlsx/);
      assert.ok(res.body && res.body.length > 500, 'Excel buffer must contain valid binary workbook');
      // Verify PK zip signature (0x50 0x4B)
      assert.equal(res.body[0], 0x50);
      assert.equal(res.body[1], 0x4b);
    });

    // PDF Export
    await t2.test('GET /api/reports/export?format=pdf returns valid printable PDF document', async () => {
      const res = await request(app)
        .get('/api/reports/export?type=inventory&format=pdf')
        .set('Authorization', `Bearer ${adminToken}`)
        .responseType('blob');

      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /application\/pdf/);
      assert.match(res.headers['content-disposition'], /\.pdf/);
      assert.ok(res.body && res.body.length > 1000, 'PDF buffer must contain binary document stream');
      // Verify %PDF signature
      const headerStr = res.body.slice(0, 5).toString('ascii');
      assert.equal(headerStr, '%PDF-');
    });

    // Export with Filters
    await t2.test('Export applies category and room filters accurately', async () => {
      const res = await request(app)
        .get('/api/reports/export?type=inventory&format=csv&category=Ventilator')
        .set('Authorization', `Bearer ${doctorToken}`);

      assert.equal(res.status, 200);
      assert.match(res.text, /Ventilator/);
    });
  });
});
