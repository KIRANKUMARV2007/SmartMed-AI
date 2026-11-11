/**
 * SmartMed AI - Centralized Report Generation & Aggregation Service
 * Supports 8 clinical and operational report types:
 * 1. Equipment Inventory
 * 2. Equipment Movement & Location
 * 3. Reservation & Clinical Holds
 * 4. Biomedical Maintenance & AI Failure Risk
 * 5. Sanitization & Clinical Readiness
 * 6. Fleet Utilization
 * 7. Emergency Allocation & OT Dispatch
 * 8. Regulatory & System Audit Trail (Admin/Doctor restricted)
 */

import mongoose from 'mongoose';
import { Equipment } from '../models/Equipment.js';
import { MovementLog } from '../models/MovementLog.js';
import { MaintenanceTicket } from '../models/MaintenanceTicket.js';
import { AuditLog } from '../models/AuditLog.js';
import { Room } from '../models/Room.js';
import { mlClient } from './mlClient.js';
import {
  SEED_EQUIPMENT,
  SEED_ROOMS,
  SEED_MOVEMENTS,
  SEED_MAINTENANCE_TICKETS,
} from '../data/seedData.js';

const FALLBACK_AUDIT_LOGS = [
  {
    id: 'AUD-SYS-1001',
    action: 'USER_LOGIN',
    category: 'AUTH',
    performedBy: { id: 'ADM-1001', name: 'Elena Rostova', role: 'admin', department: 'Operations' },
    targetType: 'Session',
    targetId: 'ADM-1001',
    details: 'Administrator authenticated into clinical operations portal.',
    timestamp: new Date(Date.now() - 3600 * 1000),
    ipAddress: '127.0.0.1',
  },
  {
    id: 'AUD-EQ-1002',
    action: 'EQUIPMENT_RESERVED',
    category: 'EQUIPMENT',
    performedBy: { id: 'DOC-8491', name: 'Dr. Maya Lin', role: 'doctor', department: 'Emergency Medicine' },
    targetType: 'Equipment',
    targetId: 'EQ-DEFIB-01',
    details: 'Clinician placed 30-minute hold on ZOLL R Series Defibrillator.',
    timestamp: new Date(Date.now() - 1800 * 1000),
    ipAddress: '127.0.0.1',
  },
];

export const REPORT_TYPES = [
  'inventory',
  'movements',
  'reservations',
  'maintenance',
  'sanitization',
  'utilization',
  'emergency',
  'audit',
];

export const REPORT_METADATA = {
  inventory: {
    id: 'inventory',
    title: 'Equipment Inventory & Fleet Status Report',
    category: 'Asset Management',
    description: 'Comprehensive inventory status across departments, tracking operational availability, battery levels, and asset condition.',
    allowedRoles: ['admin', 'doctor', 'nurse', 'staff'],
  },
  movements: {
    id: 'movements',
    title: 'Equipment Movement & Geolocation Audit Report',
    category: 'Chain of Custody',
    description: 'Chronological ledger of inter-departmental transfers, bedside handovers, and dual-QR relocations.',
    allowedRoles: ['admin', 'doctor', 'nurse', 'staff'],
  },
  reservations: {
    id: 'reservations',
    title: 'Clinical Equipment Reservation & Hold Report',
    category: 'Clinical Allocation',
    description: 'Records of 30-minute emergency holds, handover verifications, expired releases, and clinician reservations.',
    allowedRoles: ['admin', 'doctor', 'nurse', 'staff'],
  },
  maintenance: {
    id: 'maintenance',
    title: 'Biomedical Maintenance & Predictive Failure Risk Report',
    category: 'Engineering & Safety',
    description: 'Active hardware faults, scheduled biomedical inspections, and Random Forest 30-day failure risk forecasting.',
    allowedRoles: ['admin', 'doctor', 'nurse', 'staff'],
  },
  sanitization: {
    id: 'sanitization',
    title: 'Infection Control & Sanitization Readiness Report',
    category: 'Infection Prevention',
    description: 'Terminal chemical decontamination tracking, quarantined devices, and verified clinical release status.',
    allowedRoles: ['admin', 'doctor', 'nurse', 'staff'],
  },
  utilization: {
    id: 'utilization',
    title: 'Equipment Fleet Utilization & Duty Cycle Report',
    category: 'Operational Analytics',
    description: 'Operational hours, clinical session counts, idle ratios, and K-Means fleet deployment profile segmentation.',
    allowedRoles: ['admin', 'doctor', 'nurse', 'staff'],
  },
  emergency: {
    id: 'emergency',
    title: 'Emergency Asset Allocation & STAT Dispatch Report',
    category: 'Critical Care Operations',
    description: 'Audit records of rapid emergency equipment holds and Operating Theatre allocations for acute resuscitation.',
    allowedRoles: ['admin', 'doctor', 'nurse', 'staff'],
  },
  audit: {
    id: 'audit',
    title: 'System Security & Regulatory Compliance Audit Trail',
    category: 'Governance & Security',
    description: 'Full immutable compliance log of administrative actions, authentication attempts, and operational changes.',
    allowedRoles: ['admin', 'doctor'],
  },
};

/**
 * Helper to safely fetch database records with fallback to seed data
 */
async function fetchSafe(model, query = {}, sort = { createdAt: -1 }, fallbackData = []) {
  if (mongoose.connection.readyState === 1) {
    try {
      const records = await model.find(query).sort(sort).lean();
      if (records && records.length > 0) return records;
    } catch (err) {
      console.warn(`[ReportService] Database fetch failed for ${model.modelName}:`, err.message);
    }
  }
  return fallbackData;
}

/**
 * Filter an array of records by date range on a specified date field
 */
function applyDateFilter(records, dateField, startDate, endDate) {
  if (!startDate && !endDate) return records;
  const start = startDate ? new Date(startDate).getTime() : 0;
  const end = endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;

  return records.filter((item) => {
    const val = item[dateField];
    if (!val) return false;
    const itemTime = new Date(val).getTime();
    return !isNaN(itemTime) && itemTime >= start && itemTime <= end;
  });
}

/**
 * Build Equipment Inventory Report
 */
async function generateInventoryReport(filters = {}) {
  const { category, status, room, floor } = filters;
  const allRooms = await fetchSafe(Room, {}, { name: 1 }, SEED_ROOMS);
  const roomMap = new Map(allRooms.map((r) => [r.name, r]));

  let records = await fetchSafe(Equipment, {}, { id: 1 }, SEED_EQUIPMENT);

  if (category && category !== 'All' && category !== 'All Categories') {
    records = records.filter((e) => e.category === category);
  }
  if (status && status !== 'All') {
    records = records.filter((e) => e.status === status);
  }
  if (room && room !== 'All') {
    records = records.filter((e) => e.currentRoom === room);
  }
  if (floor && floor !== 'All') {
    records = records.filter((e) => {
      const r = roomMap.get(e.currentRoom);
      return r && r.floor === floor;
    });
  }

  // Summary Metrics
  const total = records.length;
  const available = records.filter((e) => e.status === 'Available').length;
  const inUse = records.filter((e) => e.status === 'In Use').length;
  const reserved = records.filter((e) => e.status === 'Reserved').length;
  const sanitizationPending = records.filter((e) => e.sanitizationStatus === 'PENDING').length;
  const faulty = records.filter((e) => e.status === 'Faulty' || e.status === 'Under Maintenance').length;
  const readinessRate = total > 0 ? Math.round((available / total) * 100) : 0;

  // Breakdown by Category
  const categoryCounts = {};
  records.forEach((e) => {
    categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
  });

  const rows = records.map((e) => {
    const rInfo = roomMap.get(e.currentRoom);
    return {
      equipmentId: e.id,
      name: e.name,
      category: e.category,
      model: e.model || 'Standard',
      serialNumber: e.serialNumber || 'N/A',
      currentRoom: e.currentRoom,
      floor: rInfo?.floor || 'Floor 1',
      status: e.status,
      sanitizationStatus: e.sanitizationStatus || 'CLEARED',
      batteryLevel: e.hasBattery && e.batteryLevel !== null ? `${e.batteryLevel}%` : 'AC Powered',
      condition: e.condition || 'Optimal',
      operatingHours: e.operatingHours || 0,
      lastConfirmedAt: e.lastConfirmedAt ? new Date(e.lastConfirmedAt).toLocaleString() : 'N/A',
    };
  });

  return {
    reportType: 'inventory',
    metadata: REPORT_METADATA.inventory,
    generatedAt: new Date().toISOString(),
    filterCriteria: { category: category || 'All', status: status || 'All', room: room || 'All', floor: floor || 'All' },
    summary: {
      totalEquipment: total,
      availableCount: available,
      inUseCount: inUse,
      reservedCount: reserved,
      sanitizationPendingCount: sanitizationPending,
      faultyCount: faulty,
      readinessRate: `${readinessRate}%`,
      categoryBreakdown: categoryCounts,
    },
    columns: [
      { key: 'equipmentId', label: 'Asset ID' },
      { key: 'name', label: 'Equipment Name' },
      { key: 'category', label: 'Category' },
      { key: 'currentRoom', label: 'Room' },
      { key: 'floor', label: 'Floor' },
      { key: 'status', label: 'Status' },
      { key: 'sanitizationStatus', label: 'Sanitization' },
      { key: 'batteryLevel', label: 'Battery' },
      { key: 'condition', label: 'Condition' },
      { key: 'operatingHours', label: 'Op Hours' },
      { key: 'lastConfirmedAt', label: 'Last Scan' },
    ],
    rows,
  };
}

/**
 * Build Equipment Movement & Location Audit Report
 */
async function generateMovementsReport(filters = {}) {
  const { startDate, endDate, room, user } = filters;

  let records = await fetchSafe(MovementLog, {}, { timestamp: -1 }, SEED_MOVEMENTS);
  records = applyDateFilter(records, 'timestamp', startDate, endDate);

  if (room && room !== 'All') {
    records = records.filter((m) => m.fromRoom === room || m.toRoom === room);
  }
  if (user && user !== 'All') {
    records = records.filter((m) => m.staffName?.toLowerCase().includes(user.toLowerCase()) || m.staffId === user);
  }

  const totalMovements = records.length;
  const dualQRCount = records.filter((m) => m.type?.includes('Dual-QR')).length;
  const handoverCount = records.filter((m) => m.type?.includes('Handover')).length;
  const sanitizationCount = records.filter((m) => m.type?.includes('Sanitization')).length;

  const typeCounts = {};
  records.forEach((m) => {
    typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
  });

  const rows = records.map((m) => ({
    movementId: m.id,
    timestamp: m.timestamp ? new Date(m.timestamp).toLocaleString() : 'N/A',
    equipmentId: m.equipmentId,
    equipmentName: m.equipmentName,
    fromRoom: m.fromRoom,
    toRoom: m.toRoom,
    movementType: m.type,
    staffName: m.staffName || 'Clinical Personnel',
    staffRole: m.staffRole || 'Staff',
    details: m.details || '',
  }));

  return {
    reportType: 'movements',
    metadata: REPORT_METADATA.movements,
    generatedAt: new Date().toISOString(),
    filterCriteria: { startDate: startDate || 'All Time', endDate: endDate || 'All Time', room: room || 'All', user: user || 'All' },
    summary: {
      totalMovements,
      dualQRVerified: dualQRCount,
      handoversCompleted: handoverCount,
      sanitizationTransfers: sanitizationCount,
      typeBreakdown: typeCounts,
    },
    columns: [
      { key: 'movementId', label: 'Log ID' },
      { key: 'timestamp', label: 'Date & Time' },
      { key: 'equipmentId', label: 'Asset ID' },
      { key: 'equipmentName', label: 'Equipment Name' },
      { key: 'fromRoom', label: 'Origin' },
      { key: 'toRoom', label: 'Destination' },
      { key: 'movementType', label: 'Transfer Type' },
      { key: 'staffName', label: 'Staff' },
      { key: 'details', label: 'Details' },
    ],
    rows,
  };
}

/**
 * Build Reservation & Clinical Holds Report
 */
async function generateReservationsReport(filters = {}) {
  const { startDate, endDate, department } = filters;

  const equipmentList = await fetchSafe(Equipment, {}, { id: 1 }, SEED_EQUIPMENT);
  const movements = await fetchSafe(MovementLog, {}, { timestamp: -1 }, SEED_MOVEMENTS);

  // Active reservations directly from Equipment model
  const activeHolds = equipmentList
    .filter((e) => e.status === 'Reserved' && e.reservation)
    .map((e) => ({
      reservationId: `RES-ACT-${e.id}`,
      equipmentId: e.id,
      equipmentName: e.name,
      requestingUser: e.reservation.reservedBy,
      staffId: e.reservation.staffId,
      department: e.reservation.department,
      reservedAt: e.reservation.reservedAt ? new Date(e.reservation.reservedAt).toLocaleString() : 'N/A',
      rawDate: e.reservation.reservedAt,
      expiresAt: e.reservation.expiresAt ? new Date(e.reservation.expiresAt).toLocaleString() : 'N/A',
      purpose: e.reservation.purpose || 'Clinical Procedure',
      status: 'Active Hold',
      isHoldActive: true,
    }));

  // Historical reservation events from MovementLog
  const historicalEvents = movements
    .filter((m) =>
      m.type?.includes('Reservation') ||
      m.type?.includes('Handover') ||
      m.type?.includes('Emergency Allocation')
    )
    .map((m) => {
      let status = 'Completed Handover';
      if (m.type.includes('Placed')) status = 'Placed Hold';
      if (m.type.includes('Cancelled')) status = 'Cancelled';
      if (m.type.includes('Auto-Released') || m.type.includes('Expired')) status = 'Auto-Released (Expired)';
      if (m.type.includes('Emergency Allocation')) status = 'Emergency Dispatched';

      return {
        reservationId: m.id,
        equipmentId: m.equipmentId,
        equipmentName: m.equipmentName,
        requestingUser: m.staffName,
        staffId: m.staffId,
        department: 'Clinical Unit',
        reservedAt: m.timestamp ? new Date(m.timestamp).toLocaleString() : 'N/A',
        rawDate: m.timestamp,
        expiresAt: 'Completed',
        purpose: m.details || m.type,
        status,
        isHoldActive: false,
      };
    });

  let combined = [...activeHolds, ...historicalEvents];
  combined = applyDateFilter(combined, 'rawDate', startDate, endDate);

  if (department && department !== 'All') {
    combined = combined.filter((r) => r.department?.toLowerCase().includes(department.toLowerCase()));
  }

  const total = combined.length;
  const activeCount = combined.filter((r) => r.isHoldActive).length;
  const completedCount = combined.filter((r) => r.status === 'Completed Handover').length;
  const expiredCount = combined.filter((r) => r.status.includes('Expired') || r.status.includes('Cancelled')).length;

  return {
    reportType: 'reservations',
    metadata: REPORT_METADATA.reservations,
    generatedAt: new Date().toISOString(),
    filterCriteria: { startDate: startDate || 'All Time', endDate: endDate || 'All Time', department: department || 'All' },
    summary: {
      totalReservationEvents: total,
      activeHolds: activeCount,
      completedHandovers: completedCount,
      expiredOrCancelled: expiredCount,
    },
    columns: [
      { key: 'reservationId', label: 'Reservation ID' },
      { key: 'equipmentId', label: 'Asset ID' },
      { key: 'equipmentName', label: 'Equipment' },
      { key: 'requestingUser', label: 'Clinician' },
      { key: 'department', label: 'Department' },
      { key: 'reservedAt', label: 'Reserved At' },
      { key: 'expiresAt', label: 'Expires / Status' },
      { key: 'status', label: 'Hold State' },
      { key: 'purpose', label: 'Clinical Purpose' },
    ],
    rows: combined.map(({ rawDate, isHoldActive, ...rest }) => rest),
  };
}

/**
 * Build Biomedical Maintenance & AI Failure Risk Report
 */
async function generateMaintenanceReport(filters = {}) {
  const { startDate, endDate, severity, status } = filters;

  let tickets = await fetchSafe(MaintenanceTicket, {}, { reportedAt: -1 }, SEED_MAINTENANCE_TICKETS);
  tickets = applyDateFilter(tickets, 'reportedAt', startDate, endDate);

  if (severity && severity !== 'All') {
    tickets = tickets.filter((t) => t.severity === severity);
  }
  if (status && status !== 'All') {
    tickets = tickets.filter((t) => t.status === status);
  }

  // Fetch ML predictive maintenance scores for equipment fleet
  const equipmentList = await fetchSafe(Equipment, {}, { id: 1 }, SEED_EQUIPMENT);
  let mlPredictions = [];
  let isMLPowered = false;

  try {
    const mlRes = await mlClient.predictMaintenance(equipmentList);
    if (mlRes && mlRes.results) {
      mlPredictions = mlRes.results;
      isMLPowered = mlRes.mlPowered || false;
    }
  } catch (mlErr) {
    console.warn('[ReportService] ML maintenance inference skipped:', mlErr.message);
  }

  const mlMap = new Map(mlPredictions.map((p) => [p.equipmentId, p]));

  const totalTickets = tickets.length;
  const activeFaults = tickets.filter((t) => t.status === 'ACTIVE_FAULT').length;
  const inProgress = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
  const resolved = tickets.filter((t) => t.status === 'RESOLVED').length;
  const criticalCount = tickets.filter((t) => t.severity === 'CRITICAL').length;
  const highRiskAssetsCount = mlPredictions.filter((p) => p.failureRiskScore >= 45).length;

  const rows = tickets.map((t) => {
    const ml = mlMap.get(t.equipmentId);
    return {
      ticketId: t.id,
      equipmentId: t.equipmentId,
      equipmentName: t.equipmentName,
      severity: t.severity,
      title: t.title,
      currentRoom: t.currentRoom,
      status: t.status,
      reportedAt: t.reportedAt ? new Date(t.reportedAt).toLocaleString() : 'N/A',
      resolvedAt: t.resolvedAt ? new Date(t.resolvedAt).toLocaleString() : 'Open',
      aiFailureRiskScore: ml ? `${ml.failureRiskScore}% (${ml.riskLevel})` : 'N/A',
      aiActionRecommendation: ml ? ml.actionRecommendation : 'Standard maintenance protocol',
    };
  });

  return {
    reportType: 'maintenance',
    metadata: REPORT_METADATA.maintenance,
    generatedAt: new Date().toISOString(),
    filterCriteria: { severity: severity || 'All', status: status || 'All', startDate: startDate || 'All Time', endDate: endDate || 'All Time' },
    summary: {
      totalTickets,
      activeFaults,
      inProgress,
      resolved,
      criticalSeverity: criticalCount,
      aiPredictedHighRiskAssets: highRiskAssetsCount,
      isMLPowered,
    },
    columns: [
      { key: 'ticketId', label: 'Ticket ID' },
      { key: 'equipmentId', label: 'Asset ID' },
      { key: 'equipmentName', label: 'Equipment' },
      { key: 'severity', label: 'Severity' },
      { key: 'title', label: 'Issue Description' },
      { key: 'status', label: 'Ticket Status' },
      { key: 'currentRoom', label: 'Location' },
      { key: 'reportedAt', label: 'Reported' },
      { key: 'aiFailureRiskScore', label: 'AI Risk (Random Forest)' },
      { key: 'aiActionRecommendation', label: 'AI Recommended Action' },
    ],
    rows,
  };
}

/**
 * Build Sanitization & Clinical Readiness Report
 */
async function generateSanitizationReport(filters = {}) {
  const { sanitizationStatus, category } = filters;

  let equipmentList = await fetchSafe(Equipment, {}, { id: 1 }, SEED_EQUIPMENT);

  if (sanitizationStatus && sanitizationStatus !== 'All') {
    equipmentList = equipmentList.filter((e) => e.sanitizationStatus === sanitizationStatus);
  }
  if (category && category !== 'All') {
    equipmentList = equipmentList.filter((e) => e.category === category);
  }

  const total = equipmentList.length;
  const cleared = equipmentList.filter((e) => e.sanitizationStatus === 'CLEARED').length;
  const pending = equipmentList.filter((e) => e.sanitizationStatus === 'PENDING').length;
  const complianceRate = total > 0 ? Math.round((cleared / total) * 100) : 0;

  const rows = equipmentList.map((e) => {
    const isReady = e.status === 'Available' && e.sanitizationStatus === 'CLEARED';
    return {
      equipmentId: e.id,
      name: e.name,
      category: e.category,
      currentRoom: e.currentRoom,
      status: e.status,
      sanitizationStatus: e.sanitizationStatus || 'CLEARED',
      clinicalReadiness: isReady ? 'PATIENT READY' : 'QUARANTINED',
      lastSanitizedAt: e.lastSanitizedAt ? new Date(e.lastSanitizedAt).toLocaleString() : 'Record Pending',
      lastConfirmedBy: e.lastConfirmedBy || 'Clinical Staff',
    };
  });

  return {
    reportType: 'sanitization',
    metadata: REPORT_METADATA.sanitization,
    generatedAt: new Date().toISOString(),
    filterCriteria: { sanitizationStatus: sanitizationStatus || 'All', category: category || 'All' },
    summary: {
      totalAssets: total,
      sanitizationCleared: cleared,
      sanitizationPending: pending,
      clinicalReadinessIndex: `${complianceRate}%`,
    },
    columns: [
      { key: 'equipmentId', label: 'Asset ID' },
      { key: 'name', label: 'Equipment Name' },
      { key: 'category', label: 'Category' },
      { key: 'currentRoom', label: 'Room' },
      { key: 'status', label: 'Status' },
      { key: 'sanitizationStatus', label: 'Sanitization Status' },
      { key: 'clinicalReadiness', label: 'Readiness Flag' },
      { key: 'lastSanitizedAt', label: 'Last Decontamination' },
      { key: 'lastConfirmedBy', label: 'Verified By' },
    ],
    rows,
  };
}

/**
 * Build Fleet Utilization & Duty Cycle Report
 */
async function generateUtilizationReport(filters = {}) {
  const { category } = filters;

  let equipmentList = await fetchSafe(Equipment, {}, { operatingHours: -1 }, SEED_EQUIPMENT);

  if (category && category !== 'All') {
    equipmentList = equipmentList.filter((e) => e.category === category);
  }

  // Attempt ML utilization clustering
  let clusterResults = [];
  let isMLPowered = false;
  try {
    const clusterRes = await mlClient.clusterUtilization(equipmentList);
    if (clusterRes && clusterRes.results) {
      clusterResults = clusterRes.results;
      isMLPowered = clusterRes.mlPowered || false;
    }
  } catch (err) {
    console.warn('[ReportService] Utilization clustering skipped:', err.message);
  }

  const clusterMap = new Map(clusterResults.map((c) => [c.equipmentId, c]));

  const total = equipmentList.length;
  const totalHours = equipmentList.reduce((acc, e) => acc + (e.operatingHours || 0), 0);
  const avgHours = total > 0 ? Math.round(totalHours / total) : 0;
  const highWearCount = equipmentList.filter((e) => (e.operatingHours || 0) > 2500).length;
  const underutilizedCount = equipmentList.filter((e) => (e.operatingHours || 0) < 600).length;

  const rows = equipmentList.map((e) => {
    const c = clusterMap.get(e.id);
    const hours = e.operatingHours || 0;
    const sessions = e.totalUsageSessions || Math.max(1, Math.round(hours / 14));
    const hps = sessions > 0 ? Math.round((hours / sessions) * 10) / 10 : 0;
    const profile = c ? c.clusterName : hours > 2500 ? 'Overutilized' : hours < 600 ? 'Underutilized' : 'Balanced';

    return {
      equipmentId: e.id,
      name: e.name,
      category: e.category,
      operatingHours: hours,
      totalUsageSessions: sessions,
      hoursPerSession: hps,
      currentStatus: e.status,
      currentRoom: e.currentRoom,
      utilizationProfile: profile,
      recommendedAction: c ? c.actionRecommendation : 'Maintain current assignment',
    };
  });

  return {
    reportType: 'utilization',
    metadata: REPORT_METADATA.utilization,
    generatedAt: new Date().toISOString(),
    filterCriteria: { category: category || 'All' },
    summary: {
      totalAssetsAnalyzed: total,
      totalFleetOperatingHours: totalHours,
      averageHoursPerAsset: avgHours,
      overutilizedAssets: highWearCount,
      underutilizedAssets: underutilizedCount,
      isMLPowered,
    },
    columns: [
      { key: 'equipmentId', label: 'Asset ID' },
      { key: 'name', label: 'Equipment Name' },
      { key: 'category', label: 'Category' },
      { key: 'operatingHours', label: 'Operating Hours' },
      { key: 'totalUsageSessions', label: 'Sessions' },
      { key: 'hoursPerSession', label: 'Hours/Session' },
      { key: 'currentStatus', label: 'Current Status' },
      { key: 'currentRoom', label: 'Room' },
      { key: 'utilizationProfile', label: 'Workload Profile' },
      { key: 'recommendedAction', label: 'Action Recommendation' },
    ],
    rows,
  };
}

/**
 * Build Emergency Allocation & OT Dispatch Report
 */
async function generateEmergencyReport(filters = {}) {
  const { startDate, endDate, room } = filters;

  const movements = await fetchSafe(MovementLog, {}, { timestamp: -1 }, SEED_MOVEMENTS);
  const equipmentList = await fetchSafe(Equipment, {}, { id: 1 }, SEED_EQUIPMENT);

  // Filter movement logs matching emergency criteria
  let emergencyLogs = movements.filter((m) =>
    m.type?.includes('Emergency') ||
    m.details?.toLowerCase().includes('emergency') ||
    m.details?.toLowerCase().includes('ot dispatch') ||
    m.details?.toLowerCase().includes('resuscitation')
  );

  // Active emergency holds on Equipment
  const activeEmergencyHolds = equipmentList
    .filter((e) => e.status === 'Reserved' && e.reservation?.purpose?.toLowerCase().includes('emergency'))
    .map((e) => ({
      id: `EMG-ACT-${e.id}`,
      timestamp: e.reservation.reservedAt,
      equipmentId: e.id,
      equipmentName: e.name,
      fromRoom: e.currentRoom,
      toRoom: e.currentRoom,
      type: 'Active Emergency Hold',
      staffName: e.reservation.reservedBy,
      staffRole: 'Emergency Clinician',
      details: e.reservation.purpose,
    }));

  let combined = [...activeEmergencyHolds, ...emergencyLogs];
  combined = applyDateFilter(combined, 'timestamp', startDate, endDate);

  if (room && room !== 'All') {
    combined = combined.filter((m) => m.fromRoom === room || m.toRoom === room);
  }

  const total = combined.length;
  const activeCount = combined.filter((m) => m.type?.includes('Active')).length;

  const rows = combined.map((m) => ({
    allocationId: m.id,
    timestamp: m.timestamp ? new Date(m.timestamp).toLocaleString() : 'N/A',
    equipmentId: m.equipmentId,
    equipmentName: m.equipmentName,
    originRoom: m.fromRoom,
    targetRoom: m.toRoom,
    clinician: m.staffName || 'Attending Physician',
    role: m.staffRole || 'Clinician',
    purpose: m.details || 'Emergency Medical Procedure',
  }));

  return {
    reportType: 'emergency',
    metadata: REPORT_METADATA.emergency,
    generatedAt: new Date().toISOString(),
    filterCriteria: { startDate: startDate || 'All Time', endDate: endDate || 'All Time', room: room || 'All' },
    summary: {
      totalEmergencyEvents: total,
      activeEmergencyHolds: activeCount,
      completedDispatches: total - activeCount,
    },
    columns: [
      { key: 'allocationId', label: 'Event ID' },
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'equipmentId', label: 'Asset ID' },
      { key: 'equipmentName', label: 'Equipment Name' },
      { key: 'originRoom', label: 'From Room' },
      { key: 'targetRoom', label: 'Emergency Room' },
      { key: 'clinician', label: 'Clinician' },
      { key: 'role', label: 'Role' },
      { key: 'purpose', label: 'Emergency Purpose' },
    ],
    rows,
  };
}

/**
 * Build System Security & Regulatory Audit Trail Report (Admin/Doctor Only)
 */
async function generateAuditReport(filters = {}, user) {
  // Enforce role authorization
  if (user && user.role !== 'admin' && user.role !== 'doctor') {
    const err = new Error('Access Denied: Regulatory Audit Reports require Administrator or Physician clearance.');
    err.status = 403;
    throw err;
  }

  const { startDate, endDate, category, user: staffFilter } = filters;

  let records = await fetchSafe(AuditLog, {}, { timestamp: -1 }, FALLBACK_AUDIT_LOGS);
  records = applyDateFilter(records, 'timestamp', startDate, endDate);

  if (category && category !== 'All') {
    records = records.filter((a) => a.category === category);
  }
  if (staffFilter && staffFilter !== 'All') {
    records = records.filter((a) => a.performedBy?.name?.toLowerCase().includes(staffFilter.toLowerCase()) || a.performedBy?.id === staffFilter);
  }

  const total = records.length;
  const categoryCounts = {};
  records.forEach((a) => {
    categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
  });

  const rows = records.map((a) => ({
    auditId: a.id,
    timestamp: a.timestamp ? new Date(a.timestamp).toLocaleString() : 'N/A',
    action: a.action,
    category: a.category,
    performedBy: a.performedBy?.name ? `${a.performedBy.name} (${a.performedBy.role})` : 'System',
    targetType: a.targetType || 'Asset',
    targetId: a.targetId || 'N/A',
    details: a.details || '',
    ipAddress: a.ipAddress || 'Internal',
  }));

  return {
    reportType: 'audit',
    metadata: REPORT_METADATA.audit,
    generatedAt: new Date().toISOString(),
    filterCriteria: { category: category || 'All', user: staffFilter || 'All', startDate: startDate || 'All Time', endDate: endDate || 'All Time' },
    summary: {
      totalAuditEntries: total,
      categoryBreakdown: categoryCounts,
    },
    columns: [
      { key: 'auditId', label: 'Audit ID' },
      { key: 'timestamp', label: 'Date & Time' },
      { key: 'action', label: 'Action' },
      { key: 'category', label: 'Category' },
      { key: 'performedBy', label: 'Operator' },
      { key: 'targetType', label: 'Target' },
      { key: 'targetId', label: 'Target ID' },
      { key: 'details', label: 'Audit Details' },
      { key: 'ipAddress', label: 'IP Address' },
    ],
    rows,
  };
}

/**
 * Main dispatcher for all 8 report types
 */
export async function generateReportData(type, filters = {}, user = null) {
  const reportType = (type || '').toLowerCase().trim();

  switch (reportType) {
    case 'inventory':
      return generateInventoryReport(filters);
    case 'movements':
      return generateMovementsReport(filters);
    case 'reservations':
      return generateReservationsReport(filters);
    case 'maintenance':
      return generateMaintenanceReport(filters);
    case 'sanitization':
      return generateSanitizationReport(filters);
    case 'utilization':
      return generateUtilizationReport(filters);
    case 'emergency':
      return generateEmergencyReport(filters);
    case 'audit':
      return generateAuditReport(filters, user);
    default:
      throw new Error(`Unsupported report type '${type}'. Supported types: ${REPORT_TYPES.join(', ')}`);
  }
}
