import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Boxes,
  ArrowRightLeft,
  CalendarCheck,
  Wrench,
  Sparkles,
  BarChart3,
  Siren,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Info,
  Clock,
  Check,
} from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';
import { useAuth } from '../../context/AuthContext';
import { reportsApi } from '../../api/reportsApi';

// 8 Supported Report Configurations
const REPORT_DEFINITIONS = [
  {
    id: 'inventory',
    title: 'Equipment Inventory',
    subtitle: 'Fleet status, availability & battery',
    icon: Boxes,
    color: '#38bdf8',
    requiresRole: null,
  },
  {
    id: 'movements',
    title: 'Movements & Location',
    subtitle: 'Dual-QR scans & room transfers',
    icon: ArrowRightLeft,
    color: '#818cf8',
    requiresRole: null,
  },
  {
    id: 'reservations',
    title: 'Reservations & Holds',
    subtitle: '30-minute holds & handovers',
    icon: CalendarCheck,
    color: '#f59e0b',
    requiresRole: null,
  },
  {
    id: 'maintenance',
    title: 'Biomedical Maintenance',
    subtitle: 'Hardware faults & AI risk scoring',
    icon: Wrench,
    color: '#ef4444',
    requiresRole: null,
  },
  {
    id: 'sanitization',
    title: 'Sanitization & Readiness',
    subtitle: 'Terminal decontamination audit',
    icon: Sparkles,
    color: '#10b981',
    requiresRole: null,
  },
  {
    id: 'utilization',
    title: 'Fleet Utilization',
    subtitle: 'Operating hours & K-Means clusters',
    icon: BarChart3,
    color: '#06b6d4',
    requiresRole: null,
  },
  {
    id: 'emergency',
    title: 'Emergency Allocation',
    subtitle: 'STAT resuscitation dispatches',
    icon: Siren,
    color: '#f43f5e',
    requiresRole: null,
  },
  {
    id: 'audit',
    title: 'Regulatory Audit Trail',
    subtitle: 'Administrative security & compliance',
    icon: ShieldCheck,
    color: '#a855f7',
    requiresRole: ['admin', 'doctor'],
  },
];

export default function ReportsView() {
  const { rooms } = useEquipment();
  const { user, isAdmin, isDoctor } = useAuth();

  // Active Report State
  const [activeReportId, setActiveReportId] = useState('inventory');
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedRoom, setSelectedRoom] = useState('All');
  const [selectedFloor, setSelectedFloor] = useState('All');
  const [searchFilter, setSearchFilter] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 12;

  // Active Report Metadata
  const currentDef = useMemo(() => {
    return REPORT_DEFINITIONS.find((r) => r.id === activeReportId) || REPORT_DEFINITIONS[0];
  }, [activeReportId]);

  const isRestrictedForUser = useMemo(() => {
    if (!currentDef.requiresRole) return false;
    return !currentDef.requiresRole.includes(user?.role);
  }, [currentDef, user]);

  // Load report preview
  const fetchReportPreview = useCallback(
    async (typeToFetch = activeReportId) => {
      if (currentDef.requiresRole && !currentDef.requiresRole.includes(user?.role)) {
        setReportData(null);
        setErrorMessage(`Access Restricted: ${currentDef.title} is reserved for Administrator and Physician oversight.`);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      setExportMessage(null);
      setCurrentPage(1);

      try {
        const filters = {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          category: selectedCategory !== 'All' ? selectedCategory : undefined,
          status: selectedStatus !== 'All' ? selectedStatus : undefined,
          room: selectedRoom !== 'All' ? selectedRoom : undefined,
          floor: selectedFloor !== 'All' ? selectedFloor : undefined,
        };

        const res = await reportsApi.getReportPreview(typeToFetch, filters);
        if (res && res.success && res.report) {
          setReportData(res.report);
        } else {
          throw new Error(res?.error || 'Failed to generate report preview.');
        }
      } catch (err) {
        setErrorMessage(err.message || 'Report retrieval failed.');
        setReportData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [activeReportId, currentDef, user, startDate, endDate, selectedCategory, selectedStatus, selectedRoom, selectedFloor]
  );

  // Initial and on-tab change fetch
  useEffect(() => {
    fetchReportPreview(activeReportId);
  }, [activeReportId, fetchReportPreview]);

  // Handle Export Download (PDF, Excel, CSV)
  const handleExport = async (format) => {
    if (isRestrictedForUser) return;
    setIsExporting(true);
    setExportMessage(null);
    setErrorMessage('');

    try {
      const filters = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        room: selectedRoom !== 'All' ? selectedRoom : undefined,
        floor: selectedFloor !== 'All' ? selectedFloor : undefined,
      };

      const res = await reportsApi.downloadReport(activeReportId, format, filters);
      if (res && res.success) {
        setExportMessage({
          type: 'success',
          text: `Report exported successfully as ${format.toUpperCase()} (${res.filename}).`,
        });
      }
    } catch (err) {
      setErrorMessage(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Quick Date Preset helper
  const handleDatePreset = (days) => {
    if (days === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const end = new Date();
    const start = new Date();
    if (days === 0) {
      // Today
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(end.toISOString().slice(0, 10));
    } else {
      start.setDate(end.getDate() - days);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(end.toISOString().slice(0, 10));
    }
  };

  // Filtered rows for client search
  const filteredRows = useMemo(() => {
    if (!reportData || !reportData.rows) return [];
    if (!searchFilter.trim()) return reportData.rows;

    const query = searchFilter.toLowerCase().trim();
    return reportData.rows.filter((row) =>
      Object.values(row).some((val) => String(val).toLowerCase().includes(query))
    );
  }, [reportData, searchFilter]);

  // Paginated Rows
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const paginatedRows = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(startIdx, startIdx + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Header Banner with Export Actions */}
      <div
        style={{
          padding: '20px 24px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--accent-blue) 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(29, 95, 193, 0.25)',
            }}
          >
            <FileSpreadsheet size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                Reports & Regulatory Data Export
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 12,
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                LIVE REPOSITORY EXPORT
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              Generate certified clinical audits, equipment utilization metrics, and chain of custody logs in PDF, Excel, and CSV.
            </p>
          </div>
        </div>

        {/* Global Export Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleExport('pdf')}
            disabled={isExporting || isLoading || isRestrictedForUser}
            title="Export professional printable PDF report"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 15px',
              fontSize: 13,
              fontWeight: 600,
              background: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
          >
            <FileText size={16} />
            <span>PDF</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleExport('xlsx')}
            disabled={isExporting || isLoading || isRestrictedForUser}
            title="Export structured Excel (.xlsx) spreadsheet"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 15px',
              fontSize: 13,
              fontWeight: 600,
              background: 'rgba(16, 185, 129, 0.1)',
              borderColor: 'rgba(16, 185, 129, 0.3)',
              color: '#10b981',
            }}
          >
            <FileSpreadsheet size={16} />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleExport('csv')}
            disabled={isExporting || isLoading || isRestrictedForUser}
            title="Export lightweight CSV table"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 15px',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Download size={16} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Export Feedback Toast */}
      {exportMessage && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--status-ready-bg)',
            border: '1px solid var(--status-ready-border)',
            color: 'var(--status-ready)',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{exportMessage.text}</span>
        </div>
      )}

      {/* Error / Alert Banner */}
      {errorMessage && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Report Type Selector Grid (8 Reports) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 12,
        }}
      >
        {REPORT_DEFINITIONS.map((def) => {
          const Icon = def.icon;
          const isActive = activeReportId === def.id;
          const isLocked = def.requiresRole && !def.requiresRole.includes(user?.role);

          return (
            <button
              key={def.id}
              type="button"
              onClick={() => setActiveReportId(def.id)}
              disabled={isLoading}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'var(--bg-card-hover, rgba(29, 95, 193, 0.12))' : 'var(--bg-card)',
                border: isActive ? `2px solid ${def.color}` : '1px solid var(--border-card)',
                boxShadow: isActive ? '0 4px 16px rgba(0,0,0,0.15)' : 'none',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
                opacity: isLocked ? 0.65 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: `${def.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: def.color,
                  }}
                >
                  <Icon size={18} />
                </div>
                {isLocked && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                    }}
                  >
                    RESTRICTED
                  </span>
                )}
                {isActive && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: def.color,
                      color: '#ffffff',
                    }}
                  >
                    ACTIVE
                  </span>
                )}
              </div>

              <div>
                <strong style={{ fontSize: 13, color: 'var(--text-primary)', display: 'block' }}>
                  {def.title}
                </strong>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {def.subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Filter Controls Toolbar */}
      <div
        style={{
          padding: '18px 20px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={18} color="var(--accent-blue)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Report Filters & Search Parameters
            </span>
          </div>

          {/* Quick Date Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>Date Presets:</span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleDatePreset(0)}
              style={{ fontSize: 11, padding: '4px 9px' }}
            >
              Today
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleDatePreset(7)}
              style={{ fontSize: 11, padding: '4px 9px' }}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleDatePreset(30)}
              style={{ fontSize: 11, padding: '4px 9px' }}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleDatePreset('all')}
              style={{ fontSize: 11, padding: '4px 9px' }}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          {/* Start Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Start Date
            </label>
            <input
              type="date"
              className="filter-select"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '100%', height: 38 }}
            />
          </div>

          {/* End Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
              End Date
            </label>
            <input
              type="date"
              className="filter-select"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '100%', height: 38 }}
            />
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Category
            </label>
            <select
              className="filter-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ width: '100%', height: 38 }}
            >
              <option value="All">All Categories</option>
              <option value="Ventilator">Ventilator</option>
              <option value="Defibrillator">Defibrillator</option>
              <option value="Infusion Pump">Infusion Pump</option>
              <option value="Portable Ultrasound">Portable Ultrasound</option>
              <option value="ECG Machine">ECG Machine</option>
              <option value="Patient Monitor">Patient Monitor</option>
              <option value="Transport Wheelchair">Transport Wheelchair</option>
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Equipment Status
            </label>
            <select
              className="filter-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ width: '100%', height: 38 }}
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="In Use">In Use</option>
              <option value="Sanitization Required">Sanitization Required</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Faulty">Faulty</option>
            </select>
          </div>

          {/* Floor / Ward Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Hospital Floor
            </label>
            <select
              className="filter-select"
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              style={{ width: '100%', height: 38 }}
            >
              <option value="All">All Floors</option>
              <option value="Floor 1">Floor 1 — Emergency & Trauma</option>
              <option value="Floor 2">Floor 2 — ICU & Critical Care</option>
              <option value="Floor 3">Floor 3 — Surgical & Recovery</option>
              <option value="Basement 1">Basement 1 — Biomed & Decon</option>
            </select>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setSelectedCategory('All');
              setSelectedStatus('All');
              setSelectedRoom('All');
              setSelectedFloor('All');
              setSearchFilter('');
            }}
            style={{ fontSize: 13, padding: '8px 16px' }}
          >
            Reset Filters
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => fetchReportPreview()}
            disabled={isLoading || isRestrictedForUser}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 20px' }}
          >
            <RefreshCw size={15} className={isLoading ? 'spin-icon' : ''} />
            <span>{isLoading ? 'Generating...' : 'Apply Filters'}</span>
          </button>
        </div>
      </div>

      {/* 4. Report Summary KPI Cards */}
      {reportData && reportData.summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
          }}
        >
          {Object.entries(reportData.summary)
            .filter(([_, val]) => typeof val !== 'object')
            .map(([key, val]) => (
              <div
                key={key}
                style={{
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-card)',
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {key.replace(/([A-Z])/g, ' $1')}
                </span>
                <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-blue)' }}>
                  {String(val)}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* 5. Report Preview Table Card */}
      <div
        style={{
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Table Title & Quick Search Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {reportData?.metadata?.title || currentDef.title} Preview
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Showing {filteredRows.length} of {reportData?.rows?.length || 0} matching records
            </span>
          </div>

          <div style={{ position: 'relative', width: 240 }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search preview..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="filter-search"
              style={{ width: '100%', height: 34, paddingLeft: 32, fontSize: 12.5 }}
            />
          </div>
        </div>

        {/* Loading Spinner State */}
        {isLoading && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 12px', color: 'var(--accent-blue)' }} />
            <p style={{ margin: 0, fontSize: 14 }}>Synthesizing real-time operational data...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!reportData || filteredRows.length === 0) && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Info size={32} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              No records found matching filter criteria
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12.5 }}>
              Try adjusting the date range or category filters to expand results.
            </p>
          </div>
        )}

        {/* Table View */}
        {!isLoading && reportData && paginatedRows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="equipment-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {reportData.columns.map((col) => (
                    <th key={col.key} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11.5 }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, idx) => (
                  <tr key={idx}>
                    {reportData.columns.map((col) => {
                      const val = row[col.key];

                      // Custom status styling
                      if (col.key === 'status') {
                        const statusClass = String(val).toLowerCase().replace(/\s+/g, '');
                        return (
                          <td key={col.key} style={{ padding: '10px 14px' }}>
                            <span className={`status-badge ${statusClass}`}>
                              {String(val)}
                            </span>
                          </td>
                        );
                      }

                      if (col.key === 'clinicalReadiness') {
                        const isReady = val === 'PATIENT READY';
                        return (
                          <td key={col.key} style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 4,
                                background: isReady ? 'var(--status-ready-bg)' : 'var(--status-faulty-bg)',
                                color: isReady ? 'var(--status-ready)' : 'var(--status-faulty)',
                              }}
                            >
                              {String(val)}
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td key={col.key} style={{ padding: '10px 14px', fontSize: 12.5 }}>
                          {val !== null && val !== undefined ? String(val) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination Footer */}
        {!isLoading && reportData && filteredRows.length > rowsPerPage && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12.5,
              color: 'var(--text-secondary)',
            }}
          >
            <span>
              Page {currentPage} of {totalPages}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                <ChevronLeft size={14} />
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
