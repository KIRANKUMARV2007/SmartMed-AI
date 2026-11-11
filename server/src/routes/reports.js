import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  generateReportData,
  REPORT_TYPES,
  REPORT_METADATA,
} from '../services/reportService.js';
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
} from '../services/reportExporter.js';

const router = express.Router();

// Require authentication for all reporting endpoints
router.use(authenticate);

/**
 * Validate ISO/YYYY-MM-DD date format
 */
function isValidDate(dateStr) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/**
 * Sanitize filename to prevent header injection or unsafe characters
 */
function sanitizeFilename(name) {
  return String(name).replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * GET /api/reports/types
 * Returns the catalog of supported clinical and operational report types
 */
router.get('/types', (req, res) => {
  const userRole = req.user?.role || 'staff';

  const types = Object.values(REPORT_METADATA).map((meta) => ({
    ...meta,
    isAccessible: meta.allowedRoles.includes(userRole),
  }));

  res.json({
    success: true,
    reportTypes: types,
    userRole,
  });
});

/**
 * GET /api/reports/preview
 * Generates structured report preview with KPIs, breakdown metrics, and tabular rows
 */
router.get('/preview', async (req, res, next) => {
  try {
    const {
      type = 'inventory',
      startDate,
      endDate,
      category,
      status,
      room,
      floor,
      department,
      severity,
      user,
    } = req.query;

    const reportType = String(type).toLowerCase().trim();

    if (!REPORT_TYPES.includes(reportType)) {
      return res.status(400).json({
        error: `Invalid report type '${type}'. Supported types: ${REPORT_TYPES.join(', ')}`,
        code: 'INVALID_REPORT_TYPE',
      });
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        error: 'Invalid date parameter. Please provide valid ISO dates (e.g. YYYY-MM-DD).',
        code: 'INVALID_DATE_FORMAT',
      });
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        error: 'Start date cannot be after end date.',
        code: 'INVALID_DATE_RANGE',
      });
    }

    const filters = {
      startDate,
      endDate,
      category,
      status,
      room,
      floor,
      department,
      severity,
      user,
    };

    const reportData = await generateReportData(reportType, filters, req.user);

    res.json({
      success: true,
      report: reportData,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/export
 * Exports report into PDF, Excel (.xlsx), or CSV format with safe download headers
 */
router.get('/export', async (req, res, next) => {
  try {
    const {
      type = 'inventory',
      format = 'csv',
      startDate,
      endDate,
      category,
      status,
      room,
      floor,
      department,
      severity,
      user,
    } = req.query;

    const reportType = String(type).toLowerCase().trim();
    const exportFormat = String(format).toLowerCase().trim();

    if (!REPORT_TYPES.includes(reportType)) {
      return res.status(400).json({
        error: `Invalid report type '${type}'. Supported types: ${REPORT_TYPES.join(', ')}`,
        code: 'INVALID_REPORT_TYPE',
      });
    }

    if (!['pdf', 'xlsx', 'csv'].includes(exportFormat)) {
      return res.status(400).json({
        error: `Invalid export format '${format}'. Supported formats: pdf, xlsx, csv`,
        code: 'INVALID_EXPORT_FORMAT',
      });
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        error: 'Invalid date parameter. Please provide valid ISO dates.',
        code: 'INVALID_DATE_FORMAT',
      });
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        error: 'Start date cannot be after end date.',
        code: 'INVALID_DATE_RANGE',
      });
    }

    const filters = {
      startDate,
      endDate,
      category,
      status,
      room,
      floor,
      department,
      severity,
      user,
    };

    const reportData = await generateReportData(reportType, filters, req.user);

    const safeDate = new Date().toISOString().slice(0, 10);
    const safeBaseName = sanitizeFilename(`SmartMed_${reportType}_report_${safeDate}`);

    if (exportFormat === 'csv') {
      const csvContent = exportToCSV(reportData);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeBaseName}.csv"`);
      return res.send(csvContent);
    }

    if (exportFormat === 'xlsx') {
      const xlsxBuffer = await exportToExcel(reportData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${safeBaseName}.xlsx"`);
      return res.send(xlsxBuffer);
    }

    if (exportFormat === 'pdf') {
      const pdfBuffer = await exportToPDF(reportData);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeBaseName}.pdf"`);
      return res.send(pdfBuffer);
    }
  } catch (err) {
    next(err);
  }
});

export default router;
