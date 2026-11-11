/**
 * SmartMed AI - Report Exporter Engine
 * Supports 3 high-fidelity export formats:
 * 1. CSV (RFC-4180 compliant with escaped characters)
 * 2. Excel (.xlsx via ExcelJS with styled headers, auto-fit, and summary blocks)
 * 3. PDF (via PDFKit with header, summary cards, data table, page numbering, and footer)
 */

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * Generate CSV string with RFC-4180 escaping
 */
export function exportToCSV(reportData) {
  const { metadata, generatedAt, filterCriteria, summary, columns, rows } = reportData;

  const lines = [];

  // Title & Header Block
  lines.push(`"SMARTMED AI CLINICAL FLEET OPERATIONS REPORT"`);
  lines.push(`"Report Title:","${metadata.title.replace(/"/g, '""')}"`);
  lines.push(`"Report Category:","${metadata.category}"`);
  lines.push(`"Generated At:","${new Date(generatedAt).toLocaleString()}"`);

  // Filters Block
  const filterSummary = Object.entries(filterCriteria || {})
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  lines.push(`"Applied Filters:","${filterSummary.replace(/"/g, '""')}"`);
  lines.push('');

  // Summary Metrics Block
  lines.push(`"EXECUTIVE SUMMARY METRICS"`);
  Object.entries(summary || {}).forEach(([key, val]) => {
    if (typeof val === 'object' && val !== null) {
      lines.push(`"${key}","${JSON.stringify(val).replace(/"/g, '""')}"`);
    } else {
      lines.push(`"${key}","${val}"`);
    }
  });
  lines.push('');

  // Tabular Data Header
  const headerRow = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
  lines.push(headerRow);

  // Tabular Data Rows
  rows.forEach((row) => {
    const rowValues = columns.map((col) => {
      const val = row[col.key];
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    });
    lines.push(rowValues.join(','));
  });

  return lines.join('\r\n');
}

/**
 * Generate Excel (.xlsx) buffer using ExcelJS
 */
export async function exportToExcel(reportData) {
  const { metadata, generatedAt, filterCriteria, summary, columns, rows } = reportData;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SmartMed AI Operations Suite';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(metadata.title.slice(0, 30));

  // Style Tokens
  const primaryColor = '1D5FC1';
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor } };
  const subheaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } };
  const lightZebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
  const borderThin = {
    top: { style: 'thin', color: { argb: 'CBD5E1' } },
    left: { style: 'thin', color: { argb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    right: { style: 'thin', color: { argb: 'CBD5E1' } },
  };

  // Row 1: Hospital Suite Letterhead
  worksheet.mergeCells('A1:F1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'SMARTMED AI — HOSPITAL ASSET GEOLOCATION & FLEET MANAGEMENT';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = subheaderFill;
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  worksheet.getRow(1).height = 32;

  // Row 2: Report Title Banner
  worksheet.mergeCells('A2:F2');
  const subCell = worksheet.getCell('A2');
  subCell.value = `${metadata.title} | Category: ${metadata.category}`;
  subCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  subCell.fill = headerFill;
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  worksheet.getRow(2).height = 24;

  // Row 3-5: Metadata & Filter Details
  worksheet.addRow([]);
  worksheet.addRow(['Generated Date:', new Date(generatedAt).toLocaleString(), '', 'Report Scope:', metadata.category]);
  worksheet.getRow(4).font = { bold: true };

  const filterSummary = Object.entries(filterCriteria || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join('  |  ');
  worksheet.addRow(['Active Filters:', filterSummary]);
  worksheet.addRow([]);

  // Summary Metrics Table
  worksheet.addRow(['SUMMARY KEY PERFORMANCE INDICATORS']);
  worksheet.getRow(7).font = { bold: true, size: 10, color: { argb: primaryColor } };

  Object.entries(summary || {}).forEach(([key, val]) => {
    if (typeof val !== 'object') {
      worksheet.addRow(['  • ' + formatMetricLabel(key), String(val)]);
    }
  });

  worksheet.addRow([]);
  const tableStartRow = worksheet.lastRow.number + 1;

  // Data Table Headers
  const headerLabels = columns.map((c) => c.label);
  const headerRow = worksheet.addRow(headerLabels);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = subheaderFill;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = borderThin;
  });

  // Data Table Rows
  rows.forEach((row, idx) => {
    const rowVals = columns.map((col) => row[col.key] ?? '');
    const dataRow = worksheet.addRow(rowVals);
    dataRow.height = 20;

    dataRow.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'left' };
      if (idx % 2 === 1) {
        cell.fill = lightZebraFill;
      }
    });
  });

  // Auto-fit Column Widths
  worksheet.columns.forEach((column, i) => {
    let maxLen = 12;
    if (columns[i]) {
      maxLen = Math.max(maxLen, columns[i].label.length + 4);
    }
    column.width = Math.min(36, maxLen);
  });

  return await workbook.xlsx.writeBuffer();
}

/**
 * Generate PDF buffer using PDFKit with clean medical styling
 */
export async function exportToPDF(reportData) {
  const { metadata, generatedAt, filterCriteria, summary, columns, rows } = reportData;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 36,
        bufferPages: true,
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Colors
      const primaryNavy = '#0F172A';
      const accentBlue = '#1D5FC1';
      const textMuted = '#64748B';
      const borderGray = '#CBD5E1';
      const lightBg = '#F8FAFC';

      // Header Block
      doc.rect(36, 36, 770, 48).fill(primaryNavy);

      doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold');
      doc.text('SMARTMED AI', 50, 46);

      doc.fontSize(8).font('Helvetica').fillColor('#94A3B8');
      doc.text('HOSPITAL ASSET GEOLOCATION & CLINICAL FLEET MANAGEMENT', 50, 64);

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#38BDF8');
      doc.text(metadata.category.toUpperCase(), 640, 52, { align: 'right' });

      doc.fontSize(8).font('Helvetica').fillColor('#E2E8F0');
      doc.text(`Run Date: ${new Date(generatedAt).toLocaleString()}`, 640, 66, { align: 'right' });

      doc.moveDown(2);

      // Report Title
      let currentY = 96;
      doc.fillColor(accentBlue).fontSize(13).font('Helvetica-Bold');
      doc.text(metadata.title, 36, currentY);

      currentY += 18;
      doc.fillColor(textMuted).fontSize(8).font('Helvetica');
      doc.text(metadata.description, 36, currentY);

      // Filter Criteria Box
      currentY += 16;
      doc.rect(36, currentY, 770, 22).fill(lightBg).stroke(borderGray);
      doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold');

      const filterText = Object.entries(filterCriteria || {})
        .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
        .join('    |    ');
      doc.text(`APPLIED FILTERS:  ${filterText}`, 46, currentY + 7);

      // Summary KPI Badges
      currentY += 28;
      const summaryKeys = Object.entries(summary || {}).filter(([_, v]) => typeof v !== 'object').slice(0, 5);
      const boxWidth = 770 / Math.max(1, summaryKeys.length);

      summaryKeys.forEach(([key, val], idx) => {
        const xPos = 36 + idx * boxWidth;
        doc.rect(xPos, currentY, boxWidth - 6, 32).fill('#F1F5F9').stroke(borderGray);

        doc.fillColor(textMuted).fontSize(6.5).font('Helvetica');
        doc.text(formatMetricLabel(key).toUpperCase(), xPos + 6, currentY + 6);

        doc.fillColor(accentBlue).fontSize(10).font('Helvetica-Bold');
        doc.text(String(val), xPos + 6, currentY + 18);
      });

      // Data Table Setup
      currentY += 40;

      // Select top columns to fit landscape width cleanly
      const displayColumns = columns.slice(0, 8);
      const colWidth = 770 / displayColumns.length;

      // Header Row
      doc.rect(36, currentY, 770, 18).fill(primaryNavy);
      displayColumns.forEach((col, idx) => {
        doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
        doc.text(col.label, 40 + idx * colWidth, currentY + 5, { width: colWidth - 8, align: 'left' });
      });

      currentY += 18;

      // Table Data Rows
      const rowHeight = 15;
      const maxRowsPerPage = 22;
      let rowsOnPage = 0;

      rows.forEach((row, rowIdx) => {
        if (currentY > 520 || rowsOnPage >= maxRowsPerPage) {
          doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 });
          currentY = 40;
          rowsOnPage = 0;

          // Header on new page
          doc.rect(36, currentY, 770, 18).fill(primaryNavy);
          displayColumns.forEach((col, idx) => {
            doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
            doc.text(col.label, 40 + idx * colWidth, currentY + 5, { width: colWidth - 8, align: 'left' });
          });
          currentY += 18;
        }

        // Alternating fill
        if (rowIdx % 2 === 1) {
          doc.rect(36, currentY, 770, rowHeight).fill('#F8FAFC');
        }

        doc.rect(36, currentY, 770, rowHeight).stroke('#E2E8F0');

        displayColumns.forEach((col, idx) => {
          const rawVal = row[col.key] ?? '';
          const strVal = String(rawVal);
          doc.fillColor('#1E293B').fontSize(7).font('Helvetica');
          doc.text(strVal, 40 + idx * colWidth, currentY + 4, {
            width: colWidth - 8,
            height: rowHeight,
            ellipsis: true,
          });
        });

        currentY += rowHeight;
        rowsOnPage++;
      });

      // Pagination & Footer across all pages
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.rect(36, 560, 770, 1).fill(borderGray);

        doc.fillColor(textMuted).fontSize(7).font('Helvetica');
        doc.text('SmartMed AI Operations • Clinical Asset Intelligence & Geolocation Audit', 36, 566);
        doc.text(`Page ${i + 1} of ${totalPages}`, 720, 566, { align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function formatMetricLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (s) => s.toUpperCase());
}
