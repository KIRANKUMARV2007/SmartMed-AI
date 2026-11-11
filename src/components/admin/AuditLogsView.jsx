import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { authApi } from '../../api/authApi';

export default function AuditLogsView() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const loadAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await authApi.getAuditLogs({
        category: categoryFilter,
        search: searchQuery,
        limit: 100,
      });
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Failed to retrieve audit trail.');
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, searchQuery]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const getActionBadgeClass = (category) => {
    switch (category) {
      case 'AUTH':
        return 'inuse';
      case 'EQUIPMENT':
        return 'available';
      case 'USER_MANAGEMENT':
        return 'reserved';
      default:
        return 'sanitization';
    }
  };

  return (
    <div className="admin-view-wrapper">
      <div className="view-header-flex">
        <div>
          <h2 className="view-section-title">
            <FileText size={20} color="var(--accent-cyan)" style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Regulatory & Operational Audit Trail
          </h2>
          <p className="view-section-subtitle">
            Cryptographically timestamped record of administrative interventions, user provisioning, logins, and asset mutations.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={loadAuditLogs}
        >
          <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      {error && (
        <div className="login-error-alert" style={{ marginBottom: 16 }}>
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="admin-filter-toolbar" style={{ marginBottom: 20 }}>
        <div className="admin-filter-left">
          <div className="admin-search-wrap">
            <Search size={15} className="admin-search-icon" />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search details, actor, action, or target ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="admin-filter-control">
            <label className="admin-filter-label">Category:</label>
            <select
              className="admin-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              <option value="EQUIPMENT">Equipment Lifecycle</option>
              <option value="USER_MANAGEMENT">User & Access Management</option>
              <option value="AUTH">Authentication & Sessions</option>
              <option value="SYSTEM">System Provisioning</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={loadAuditLogs}
          title="Refresh audit records"
        >
          <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="table-card">
        <div className="table-card-header">
          <div className="table-card-title">
            <Layers size={16} color="var(--accent-cyan)" />
            <span>Audit Entries ({logs.length})</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="clinical-table" style={{ minWidth: 840 }}>
            <thead>
              <tr>
                <th style={{ width: '16%' }}>Timestamp</th>
                <th style={{ width: '20%' }}>Action & Category</th>
                <th style={{ width: '18%' }}>Performed By</th>
                <th style={{ width: '16%' }}>Target Reference</th>
                <th style={{ width: '30%' }}>Audit Event Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <RotateCcw size={24} className="animate-spin" color="var(--accent-cyan)" style={{ margin: '0 auto 8px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>Retrieving immutable audit records...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <FileText size={32} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontWeight: 600 }}>No audit logs recorded for selected filter.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id || log._id}>
                    <td>
                      <div className="audit-meta-cell">
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(log.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          {log.action}
                        </span>
                        <span className={`status-badge ${getActionBadgeClass(log.category)}`} style={{ alignSelf: 'flex-start' }}>
                          <span className="status-badge-dot" />
                          {log.category}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          {log.performedBy?.name || 'System'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--accent-blue, var(--accent-cyan))', textTransform: 'capitalize', fontWeight: 600 }}>
                          {log.performedBy?.role || 'Service'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)' }}>{log.targetType}</span>
                        {log.targetId && (
                          <span className="audit-target-badge">
                            {log.targetId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="audit-details-cell">
                        {log.details}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
