/**
 * SmartMed Equipment API Service
 *
 * Dedicated domain service interfacing with Express /api/equipment and /api/health endpoints.
 */

import { apiRequest, API_BASE_URL } from './client.js';

export const equipmentApi = {
  getBaseUrl() {
    return API_BASE_URL;
  },

  /**
   * Health check to detect backend uptime and MongoDB connection status.
   * @returns {Promise<{ status: string, service: string, uptime: number, database: { connected: boolean, state: string, host: string|null, name: string|null } }>}
   */
  async checkHealth() {
    return apiRequest('/health');
  },

  /**
   * Fetch equipment records from backend with optional server-side filtering.
   * @param {Object} [filters={}]
   * @param {string} [filters.status]
   * @param {string} [filters.category]
   * @param {string} [filters.currentRoom]
   * @param {string} [filters.search]
   * @returns {Promise<Array>} List of equipment items
   */
  async getEquipment(filters = {}) {
    const queryParams = new URLSearchParams();
    if (filters.status && filters.status !== 'All') {
      queryParams.set('status', filters.status);
    }
    if (filters.category && filters.category !== 'All') {
      queryParams.set('category', filters.category);
    }
    if (filters.currentRoom && filters.currentRoom !== 'All') {
      queryParams.set('currentRoom', filters.currentRoom);
    }
    if (filters.search && filters.search.trim()) {
      queryParams.set('search', filters.search.trim());
    }

    const qs = queryParams.toString();
    const endpoint = `/equipment${qs ? `?${qs}` : ''}`;
    return apiRequest(endpoint);
  },

  /**
   * Fetch a single equipment item by ID.
   * @param {string} id - Equipment identifier (e.g. 'EQ-VENT-01')
   * @returns {Promise<Object>} Equipment item
   */
  async getEquipmentById(id) {
    if (!id) {
      throw new Error('Equipment ID is required');
    }
    return apiRequest(`/equipment/${encodeURIComponent(id)}`);
  },

  /**
   * Register a new equipment record with the backend.
   * @param {Object} equipmentData - Equipment payload (name, category, model, serialNumber, currentRoom, etc.)
   * @returns {Promise<Object>} Created equipment item from backend
   */
  async createEquipment(equipmentData) {
    if (!equipmentData) {
      throw new Error('Equipment data payload is required');
    }
    return apiRequest('/equipment', {
      method: 'POST',
      body: JSON.stringify(equipmentData),
    });
  },

  /**
   * Update equipment specifications and details (Admin only).
   * @param {string} id - Equipment identifier
   * @param {Object} data - Updated attributes
   * @returns {Promise<Object>} Updated equipment item
   */
  async updateEquipment(id, data) {
    if (!id) throw new Error('Equipment ID is required');
    if (!data) throw new Error('Equipment ID and update payload are required');
    return apiRequest(`/equipment/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update equipment status (Admin only).
   * @param {string} id - Equipment identifier
   * @param {string} status - New status
   * @param {string} [notes] - Reason or notes
   * @returns {Promise<Object>} Updated equipment item
   */
  async updateEquipmentStatus(id, status, notes = '') {
    if (!id) throw new Error('Equipment ID is required');
    return apiRequest(`/equipment/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  },

  /**
   * Decommission/delete equipment (Admin only).
   * @param {string} id - Equipment identifier
   * @returns {Promise<Object>} Deletion result
   */
  async deleteEquipment(id) {
    if (!id) throw new Error('Equipment ID is required');
    return apiRequest(`/equipment/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  /**
   * Record a verified physical equipment relocation to a destination room.
   * @param {string} id - Equipment identifier
   * @param {Object} moveData
   * @param {string} moveData.toRoom - Target room name
   * @param {string} [moveData.staffId] - Custodian staff ID
   * @param {string} [moveData.staffName] - Custodian staff name
   * @param {string} [moveData.staffRole] - Custodian role
   * @returns {Promise<Object>} Updated equipment item
   */
  async moveEquipment(id, { toRoom, staffId, staffName, staffRole }) {
    if (!id) throw new Error('Equipment ID is required');
    if (!toRoom) throw new Error('Destination room is required');
    return apiRequest(`/equipment/${encodeURIComponent(id)}/move`, {
      method: 'POST',
      body: JSON.stringify({ toRoom, staffId, staffName, staffRole }),
    });
  },

  /**
   * Request intelligent clinical equipment recommendations from SmartMed AI.
   * Supports natural-language queries and structured parameters.
   * @param {Object} queryParams
   * @param {string} [queryParams.prompt] - Optional clinical natural-language query
   * @param {string} [queryParams.category] - Equipment category
   * @param {string} [queryParams.destinationRoom] - Destination room name
   * @param {string} [queryParams.urgency] - 'urgent' | 'standard'
   * @param {string[]} [queryParams.requiredCapabilities] - Required clinical capabilities
   * @param {number} [queryParams.minBatteryPercent] - Minimum battery percentage
   * @param {number} [queryParams.minRuntimeMinutes] - Minimum verified runtime minutes
   * @returns {Promise<Object>} Recommendation payload
   */
  async getRecommendations(queryParams = {}) {
    if (!queryParams || typeof queryParams !== 'object') {
      throw new Error('Recommendation query parameters are required');
    }
    return apiRequest('/ai/query', {
      method: 'POST',
      body: JSON.stringify(queryParams),
    });
  },

  /**
   * Authorize and execute an AI-recommended emergency allocation hold.
   * Atomically revalidates safety eligibility on the backend before reservation.
   * @param {Object|string} allocationParams - Allocation options or equipment ID string
   * @param {Object} [options] - Additional options when first param is equipmentId
   * @returns {Promise<Object>} Allocation confirmation
   */
  async allocateRecommendation(allocationParams, options = {}) {
    let payload = {};
    if (typeof allocationParams === 'string') {
      payload = { equipmentId: allocationParams, ...options };
    } else if (allocationParams && typeof allocationParams === 'object') {
      payload = { ...allocationParams };
    } else {
      throw new Error('Equipment ID is required for allocation');
    }

    if (!payload.equipmentId) {
      throw new Error('Equipment ID is required for allocation');
    }
    const dest = payload.destinationRoom || payload.destination || payload.clinicianRoom;
    if (!dest) {
      throw new Error('Destination room is required for allocation');
    }
    return apiRequest('/ai/allocate', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        clinicianRoom: dest,
        destinationRoom: dest,
      }),
    });
  },

  /**
   * Calculate shortest valid indoor navigation route between two hospital rooms.
   * @param {string} from - Source room name or ID
   * @param {string} to - Destination room name or ID
   * @returns {Promise<Object>} Route result with steps, distance, and floor transitions
   */
  async getNavigationRoute(from, to) {
    if (!from || !to) {
      throw new Error('Both start and destination rooms are required');
    }
    const params = new URLSearchParams({ from, to });
    return apiRequest(`/navigation/route?${params.toString()}`);
  },

  /**
   * Fetch hospital floor-plan navigation graph topology.
   * @returns {Promise<Object>} Hospital nodes, corridors, and elevator systems
   */
  async getNavigationGraph() {
    return apiRequest('/navigation/graph');
  },

  /**
   * Query Random Forest predictive maintenance risk inference.
   * @param {Array<Object>} [equipmentList] - Optional equipment array to score
   * @returns {Promise<Object>} Failure risk predictions and contributing factors
   */
  async getPredictiveMaintenance(equipmentList = null) {
    return apiRequest('/ai/predictive-maintenance', {
      method: 'POST',
      body: JSON.stringify({ equipment: equipmentList }),
    });
  },

  /**
   * Query K-Means fleet utilization segmentation and optimization insights.
   * @param {Array<Object>} [equipmentList] - Optional equipment fleet array to cluster
   * @returns {Promise<Object>} Utilization cluster assignments and fleet summaries
   */
  async getUtilizationClusters(equipmentList = null) {
    if (equipmentList && Array.isArray(equipmentList) && equipmentList.length > 0) {
      return apiRequest('/ai/utilization-clusters', {
        method: 'POST',
        body: JSON.stringify({ equipment: equipmentList }),
      });
    }
    return apiRequest('/ai/utilization-clusters');
  },

  /**
   * Health and model readiness status of Python Scikit-learn microservice.
   * @returns {Promise<Object>} Loaded models and service status
   */
  async getMLStatus() {
    return apiRequest('/ai/ml-status');
  },
};


