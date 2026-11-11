/**
 * SmartMed Centralized Frontend API Client
 *
 * Provides a resilient, standardized HTTP client for communicating with
 * the SmartMed Express backend. Handles timeouts, standard error responses,
 * and differentiates between network failures, server unavailability, and business errors.
 */

// Base API URL with sensible default to local development port
export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:5000/api';

/**
 * Custom error class for API client failures with status codes and structured details.
 */
export class ApiClientError extends Error {
  constructor(message, { status = null, code = 'API_ERROR', details = null, endpoint = '' } = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.endpoint = endpoint;
  }
}

let currentAuthToken = null;

/**
 * Configure memory auth token for Authorization header.
 * @param {string|null} token
 */
export function setAuthToken(token) {
  currentAuthToken = token;
}

export function getAuthToken() {
  return currentAuthToken;
}

/**
 * Standardized fetch helper with timeout and structured error handling.
 *
 * @param {string} endpoint - Relative endpoint (e.g. '/equipment') or absolute URL.
 * @param {RequestInit & { timeoutMs?: number }} [options={}]
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const timeoutMs = options.timeoutMs || 8000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (currentAuthToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${currentAuthToken}`;
    }

    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Attempt to parse JSON response body
    let body = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    } else {
      try {
        const text = await response.text();
        body = { rawText: text };
      } catch {
        body = null;
      }
    }

    if (!response.ok) {
      const errorMessage =
        body?.error ||
        body?.message ||
        `Backend returned HTTP ${response.status} (${response.statusText || 'Error'})`;

      throw new ApiClientError(errorMessage, {
        status: response.status,
        code: body?.code || `HTTP_${response.status}`,
        details: body,
        endpoint,
      });
    }

    return body;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof ApiClientError) {
      throw err;
    }

    if (err.name === 'AbortError') {
      throw new ApiClientError(
        `Request to ${endpoint} timed out after ${timeoutMs}ms. Backend server may be offline or unresponsive.`,
        { status: null, code: 'TIMEOUT', endpoint }
      );
    }

    // Network / Connection Refused / DNS Failure
    throw new ApiClientError(
      `Unable to connect to SmartMed server at ${url}. Ensure the Express backend is running on port 5000.`,
      { status: null, code: 'NETWORK_ERROR', details: err.message, endpoint }
    );
  }
}
