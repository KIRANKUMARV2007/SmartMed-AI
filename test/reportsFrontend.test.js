import test from 'node:test';
import assert from 'node:assert/strict';
import { reportsApi } from '../src/api/reportsApi.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('SmartMed Frontend Reports Module - Contract & Guardrails Tests', async (t) => {
  await t.test('reportsApi exposes required methods', () => {
    assert.equal(typeof reportsApi.getReportTypes, 'function');
    assert.equal(typeof reportsApi.getReportPreview, 'function');
    assert.equal(typeof reportsApi.downloadReport, 'function');
    assert.equal(typeof reportsApi.getExportUrl, 'function');
  });

  await t.test('reportsApi.getExportUrl builds valid URL with format and query params', () => {
    const url = reportsApi.getExportUrl('inventory', 'xlsx', {
      startDate: '2026-01-01',
      endDate: '2026-10-31',
      category: 'Ventilator',
      room: 'ER-101',
    });

    assert.ok(url.includes('/api/reports/export'));
    assert.ok(url.includes('type=inventory'));
    assert.ok(url.includes('format=xlsx'));
    assert.ok(url.includes('startDate=2026-01-01'));
    assert.ok(url.includes('category=Ventilator'));
  });

  await t.test('reportsApi.getReportPreview rejects missing or empty report type', async () => {
    await assert.rejects(
      async () => {
        await reportsApi.getReportPreview('');
      },
      /Report type is required/
    );
  });

  await t.test('reportsApi.downloadReport rejects unsupported export formats', async () => {
    await assert.rejects(
      async () => {
        await reportsApi.downloadReport('inventory', 'docx');
      },
      /Unsupported export format/
    );
  });

  await t.test('Sidebar.jsx includes Reports navigation item with FileSpreadsheet icon', () => {
    const sidebarCode = fs.readFileSync(path.resolve(__dirname, '../src/components/layout/Sidebar.jsx'), 'utf8');
    assert.ok(sidebarCode.includes("handleNavClick('reports')"), 'Sidebar contains reports navigation handler');
    assert.ok(sidebarCode.includes("Reports & Export"), 'Sidebar contains Reports & Export label');
    assert.ok(sidebarCode.includes('FileSpreadsheet'), 'Sidebar uses FileSpreadsheet lucide icon');
  });

  await t.test('AuthContext.jsx grants REPORTS_VIEW permission to all active roles', () => {
    const authCode = fs.readFileSync(path.resolve(__dirname, '../src/context/AuthContext.jsx'), 'utf8');
    assert.ok(authCode.includes('REPORTS_VIEW:'), 'Permission matrix includes REPORTS_VIEW');
    assert.ok(authCode.includes("'admin'"), 'Admin authorized for reports');
    assert.ok(authCode.includes("'doctor'"), 'Doctor authorized for reports');
    assert.ok(authCode.includes("'nurse'"), 'Nurse authorized for reports');
    assert.ok(authCode.includes("'staff'"), 'Staff authorized for reports');
  });

  await t.test('App.jsx mounts ReportsView when activeTab is reports', () => {
    const appCode = fs.readFileSync(path.resolve(__dirname, '../src/App.jsx'), 'utf8');
    assert.ok(appCode.includes("import ReportsView from './components/views/ReportsView';"), 'App imports ReportsView');
    assert.ok(appCode.includes("activeTab === 'reports'"), 'App checks activeTab for reports');
    assert.ok(appCode.includes('<ReportsView'), 'App renders ReportsView');
  });

  await t.test('ReportsView.jsx implements all 8 required report categories and 3 formats', () => {
    const reportsViewCode = fs.readFileSync(path.resolve(__dirname, '../src/components/views/ReportsView.jsx'), 'utf8');
    
    // Check 8 report categories
    assert.ok(reportsViewCode.includes("'inventory'"), 'Includes Inventory Report');
    assert.ok(reportsViewCode.includes("'movements'"), 'Includes Movements Report');
    assert.ok(reportsViewCode.includes("'reservations'"), 'Includes Reservations Report');
    assert.ok(reportsViewCode.includes("'maintenance'"), 'Includes Maintenance Report');
    assert.ok(reportsViewCode.includes("'sanitization'"), 'Includes Sanitization Report');
    assert.ok(reportsViewCode.includes("'utilization'"), 'Includes Utilization Report');
    assert.ok(reportsViewCode.includes("'emergency'"), 'Includes Emergency Allocation Report');
    assert.ok(reportsViewCode.includes("'audit'"), 'Includes Audit Report');

    // Check 3 export formats
    assert.ok(reportsViewCode.includes("'pdf'"), 'Supports PDF export');
    assert.ok(reportsViewCode.includes("'xlsx'"), 'Supports Excel export');
    assert.ok(reportsViewCode.includes("'csv'"), 'Supports CSV export');

    // Check key UI capabilities
    assert.ok(reportsViewCode.includes('downloadReport'), 'Wires to downloadReport API');
    assert.ok(reportsViewCode.includes('getReportPreview'), 'Wires to getReportPreview API');
    assert.ok(reportsViewCode.includes('reportData.summary'), 'Renders KPI summary metrics');
  });
});
