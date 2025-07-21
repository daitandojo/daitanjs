// apqueries/src/index.js
/**
 * @file Main module for @daitanjs/apiqueries.
 * @module @daitanjs/apiqueries
 *
 * @description
 * This library provides a standardized and simplified way to make HTTP requests using Axios.
 * It includes default configurations, helper methods for common HTTP verbs (GET, POST, PUT, DELETE, PATCH),
 * and robust error handling that wraps Axios errors into custom DaitanJS error types.
 * It also integrates with `@daitanjs/development` for logging and `@daitanjs/error` for custom errors.
 *
 * Key Features:
 * - Centralized `query` function for all HTTP requests.
 * - Convenience methods: `get`, `post`, `put`, `del`, `patch`.
 * - Default request configurations (e.g., JSON content type, timeout).
 * - Customizable per-request options (headers, data, params, timeout, etc.).
 * - Standardized error handling (DaitanApiError, DaitanConfigurationError).
 * - Verbose logging for request and response details.
 * - Automatic handling of `Content-Type` for `FormData`.
 */
import axios from 'axios';
import { getLogger } from '@daitanjs/development';
import {
  DaitanApiError,
  DaitanConfigurationError,
  DaitanNetworkError,
  DaitanOperationError,
} from '@daitanjs/error';
import { Buffer } from 'buffer';
import { truncateString } from '@daitanjs/utilities';

const apiQueriesLogger = getLogger('daitan-apiqueries');

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * @typedef {Object} QueryConfig
 * @property {string} url - The request URL.
 * @property {'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'} [method='GET']
 * @property {object} [headers]
 * @property {any} [data]
 * @property {object} [params]
 * @property {number} [timeout=DEFAULT_TIMEOUT_MS]
 * @property {import('axios').ResponseType} [responseType='json']
 * @property {boolean} [withCredentials=false]
 * @property {boolean} [verbose=false]
 * @property {string} [summary]
 * @property {Function} [validateStatus]
 * @property {import('axios').AxiosRequestTransformer | import('axios').AxiosRequestTransformer[]} [transformRequest]
 * @property {import('axios').AxiosResponseTransformer | import('axios').AxiosResponseTransformer[]} [transformResponse]
 * @property {any} [auth]
 * @property {string} [proxy]
 */

/**
 * @private
 */
const DEFAULT_AXIOS_CONFIG_OPTIONS = {
  headers: {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json;charset=UTF-8',
  },
  timeout: DEFAULT_TIMEOUT_MS,
  responseType: 'json',
  withCredentials: false,
  validateStatus: (status) => status >= 200 && status < 300,
};

/**
 * Makes an HTTP request using Axios with standardized configuration and error handling.
 *
 * @public
 * @async
 * @param {QueryConfig} config - The request configuration object.
 * @returns {Promise<any>} A promise that resolves to the response data.
 * @throws {DaitanConfigurationError|DaitanApiError|DaitanNetworkError|DaitanOperationError}
 */
export const query = async (config) => {
  if (
    !config ||
    !config.url ||
    typeof config.url !== 'string' ||
    !config.url.trim()
  ) {
    apiQueriesLogger.error('Missing or invalid request URL in query config.', {
      config,
    });
    throw new DaitanConfigurationError(
      'Request URL is required and must be a non-empty string.'
    );
  }

  const effectiveMethod = (
    config.method || (config.data ? 'POST' : 'GET')
  ).toUpperCase();
  const callId = Math.random().toString(36).substring(2, 9);

  const summaryForLog =
    config.summary ||
    `HTTP ${effectiveMethod} to ${config.url.substring(0, 80)}${
      config.url.length > 80 ? '...' : ''
    }`;
  const verboseLog = config.verbose || false;

  if (verboseLog) {
    apiQueriesLogger.info(
      `[${callId}] Initiating API query: ${summaryForLog}`,
      {
        method: effectiveMethod,
        url: config.url,
        params: config.params,
      }
    );
  }

  const axiosConfig = {
    url: config.url,
    method: effectiveMethod,
    headers: {
      ...DEFAULT_AXIOS_CONFIG_OPTIONS.headers,
      ...config.headers,
    },
    params: config.params,
    data: config.data,
    timeout: config.timeout ?? DEFAULT_AXIOS_CONFIG_OPTIONS.timeout,
    responseType:
      config.responseType ?? DEFAULT_AXIOS_CONFIG_OPTIONS.responseType,
    withCredentials:
      config.withCredentials ?? DEFAULT_AXIOS_CONFIG_OPTIONS.withCredentials,
    validateStatus:
      config.validateStatus || DEFAULT_AXIOS_CONFIG_OPTIONS.validateStatus,
    transformRequest: config.transformRequest,
    transformResponse: config.transformResponse,
    auth: config.auth,
    proxy: config.proxy,
  };

  const isFormData =
    (typeof FormData !== 'undefined' && config.data instanceof FormData) ||
    (typeof config.data === 'object' &&
      config.data !== null &&
      typeof config.data.append === 'function' &&
      typeof config.data.getHeaders === 'function') ||
    (typeof window === 'undefined' &&
      config.data instanceof Buffer &&
      axiosConfig.headers['Content-Type']?.startsWith('multipart/form-data'));

  if (
    isFormData &&
    axiosConfig.headers['Content-Type']?.includes('application/json')
  ) {
    if (verboseLog) {
      apiQueriesLogger.debug(
        `[${callId}] Removing default 'Content-Type' for FormData request.`
      );
    }
    delete axiosConfig.headers['Content-Type'];
    if (typeof config.data.getHeaders === 'function') {
      axiosConfig.headers = {
        ...axiosConfig.headers,
        ...config.data.getHeaders(),
      };
    }
  }

  if (verboseLog) {
    const dataToLog = config.data
      ? typeof config.data === 'string'
        ? truncateString(config.data, 200)
        : isFormData
        ? '[FormData]'
        : typeof config.data === 'object'
        ? `{keys: ${Object.keys(config.data).join(', ').substring(0, 100)}}`
        : '[Non-object/string data]'
      : undefined;

    apiQueriesLogger.debug(`[${callId}] Axios request configuration:`, {
      url: axiosConfig.url,
      method: axiosConfig.method,
      headers: axiosConfig.headers,
      params: axiosConfig.params,
      dataPreview: dataToLog,
      timeout: axiosConfig.timeout,
      responseType: axiosConfig.responseType,
    });
  }

  try {
    const response = await axios(axiosConfig);
    if (verboseLog) {
      apiQueriesLogger.info(
        `[${callId}] API query successful: ${summaryForLog}`,
        {
          status: response.status,
          statusText: response.statusText,
        }
      );
      const responseDataPreview =
        axiosConfig.responseType === 'json' ||
        axiosConfig.responseType === 'text'
          ? truncateString(JSON.stringify(response.data), 200)
          : `[${axiosConfig.responseType} data - Length: ${
              response.data?.length || response.data?.byteLength || 'N/A'
            }]`;
      apiQueriesLogger.debug(
        `[${callId}] Response data preview:`,
        responseDataPreview
      );
    }
    return response.data;
  } catch (error) {
    const apiName = new URL(config.url).hostname;
    let daitanError;

    if (error.response) {
      apiQueriesLogger.warn(
        `[${callId}] API query FAILED: ${summaryForLog} - HTTP Status ${error.response.status}`,
        {
          status: error.response.status,
          statusText: error.response.statusText,
          responseDataPreview: truncateString(
            JSON.stringify(error.response.data),
            200
          ),
          responseHeaders: error.response.headers,
          requestConfigSent: {
            method: axiosConfig.method,
            url: axiosConfig.url,
            params: axiosConfig.params,
            headers: axiosConfig.headers,
          },
        }
      );
      daitanError = new DaitanApiError(
        `API request to ${apiName} failed with status ${
          error.response.status
        }: ${error.response.statusText || error.message}`,
        apiName,
        error.response.status,
        {
          responseData: error.response.data,
          requestConfigSummary: {
            url: axiosConfig.url,
            method: axiosConfig.method,
            params: axiosConfig.params,
          },
        },
        error
      );
    } else if (error.request) {
      apiQueriesLogger.error(
        `[${callId}] API query FAILED: ${summaryForLog} - No response received.`,
        {
          message: error.message,
          code: error.code,
          requestUrl: axiosConfig.url,
        }
      );
      const message =
        error.code === 'ECONNABORTED'
          ? `Request to ${apiName} timed out after ${axiosConfig.timeout}ms.`
          : `No response received from ${apiName}: ${error.message}`;
      daitanError = new DaitanNetworkError(
        message,
        { apiName, errorCode: error.code, requestUrl: axiosConfig.url },
        error
      );
    } else {
      apiQueriesLogger.error(
        `[${callId}] API query setup ERROR: ${summaryForLog} - ${error.message}`,
        {
          message: error.message,
          requestUrl: axiosConfig.url,
          errorStackPreview: error.stack?.substring(0, 200),
        }
      );
      daitanError = new DaitanOperationError(
        `Error setting up request to ${apiName}: ${error.message}`,
        {
          requestConfigSummary: {
            url: axiosConfig.url,
            method: axiosConfig.method,
          },
        },
        error
      );
    }
    throw daitanError;
  }
};

/**
 * Makes a GET request.
 * @public
 */
export const get = (url, config = {}) => {
  return query({ ...config, method: 'GET', url });
};

/**
 * Makes a POST request.
 * @public
 */
export const post = (url, data, config = {}) => {
  return query({ ...config, method: 'POST', url, data });
};

/**
 * Makes a PUT request.
 * @public
 */
export const put = (url, data, config = {}) => {
  return query({ ...config, method: 'PUT', url, data });
};

/**
 * Makes a DELETE request.
 * @public
 */
export const del = (url, config = {}) => {
  return query({ ...config, method: 'DELETE', url });
};

/**
 * Makes a PATCH request.
 * @public
 */
export const patch = (url, data, config = {}) => {
  return query({ ...config, method: 'PATCH', url, data });
};
