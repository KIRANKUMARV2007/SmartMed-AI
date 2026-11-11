import { apiRequest, getAuthToken, API_BASE_URL } from './client.js';

export const reportsApi = {
  /**
   * Fetch metadata catalog of available report types
   */
  async getReportTypes() {
    return apiRequest('/reports/types', { method: 'GET' });
  },

  /**
   * Build full export URL with query parameters
   * @param {string} type
   * @param {'pdf' | 'xlsx' | 'csv'} format
   * @param {Object} filters
   */
  getExportUrl(type = 'inventory', format = 'csv', filters = {}) {
    const params = new URLSearchParams();
    params.set('type', type);
    params.set('format', format);

    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '' && val !== 'All' && val !== 'All Categories') {
        params.set(key, val);
      }
    });

    return `${API_BASE_URL}/reports/export?${params.toString()}`;
  },

  /**
   * Retrieve report preview data including KPI summary cards and table rows
   * @param {string} type - 'inventory' | 'movements' | 'reservations' | 'maintenance' | 'sanitization' | 'utilization' | 'emergency' | 'audit'
   * @param {Object} filters
   */
  async getReportPreview(type = 'inventory', filters = {}) {
    if (!type || typeof type !== 'string' || !type.trim()) {
      throw new Error('Report type is required');
    }

    const params = new URLSearchParams();
    params.set('type', type);

    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '' && val !== 'All' && val !== 'All Categories') {
        params.set(key, val);
      }
    });

    return apiRequest(`/reports/preview?${params.toString()}`, { method: 'GET' });
  },

  /**
   * Execute real file export and trigger browser download with correct filename and MIME type
   * @param {string} type - report type key
   * @param {'pdf' | 'xlsx' | 'csv'} format
   * @param {Object} filters
   */
  async downloadReport(type = 'inventory', format = 'csv', filters = {}) {
    const normalizedFormat = (format || 'csv').toLowerCase();
    if (!['pdf', 'xlsx', 'csv'].includes(normalizedFormat)) {
      throw new Error(`Unsupported export format: ${format}. Must be pdf, xlsx, or csv.`);
    }

    const params = new URLSearchParams();
    params.set('type', type);
    params.set('format', normalizedFormat);

    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '' && val !== 'All' && val !== 'All Categories') {
        params.set(key, val);
      }
    });

    const url = `${API_BASE_URL}/reports/export?${params.toString()}`;
    const token = getAuthToken();

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      let errorDetail = `Export failed with HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        errorDetail = errJson.error || errorDetail;
      } catch {
        // use default
      }
      throw new Error(errorDetail);
    }

    // Determine filename from Content-Disposition header if available
    let filename = `SmartMed_${type}_report_${new Date().toISOString().slice(0, 10)}.${format}`;
    const disposition = response.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);

    return { success: true, filename };
  },
};
