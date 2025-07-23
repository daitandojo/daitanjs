// src/apiqueries/src/index.test.js
import axios from 'axios';
import { query, get, post, put, del, patch } from './index.js';
import {
  DaitanError,
  DaitanConfigurationError,
  DaitanApiError,
  DaitanNetworkError,
  DaitanOperationError,
} from '@daitanjs/error';

// Mock the entire axios module
jest.mock('axios');

// Mock the logger to prevent console noise during tests and to spy on it
jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('@daitanjs/apiqueries', () => {
  const MOCK_URL = 'https://api.example.com/data';

  // Reset mocks before each test
  beforeEach(() => {
    axios.mockClear();
  });

  describe('query function', () => {
    it('should make a successful GET request by default', async () => {
      const mockResponse = { data: { id: 1, name: 'Test' } };
      axios.mockResolvedValue(mockResponse);

      const result = await query({ url: MOCK_URL });

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: MOCK_URL,
          method: 'GET',
        })
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should make a successful POST request when data is provided', async () => {
      const postData = { name: 'New Item' };
      const mockResponse = { data: { id: 2, ...postData } };
      axios.mockResolvedValue(mockResponse);

      const result = await post(MOCK_URL, postData);

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: MOCK_URL,
          method: 'POST',
          data: postData,
        })
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should throw DaitanConfigurationError for missing URL', async () => {
      await expect(query({})).rejects.toThrow(DaitanConfigurationError);
      await expect(query({ url: ' ' })).rejects.toThrow(
        DaitanConfigurationError
      );
    });

    it('should correctly merge default and custom headers', async () => {
      axios.mockResolvedValue({ data: {} });
      const customHeaders = {
        'X-Custom-Header': 'MyValue',
        Accept: 'application/xml',
      };

      await query({ url: MOCK_URL, headers: customHeaders });

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            Accept: 'application/xml', // Custom overrides default
            'Content-Type': 'application/json;charset=UTF-8', // Default is preserved
            'X-Custom-Header': 'MyValue', // Custom is added
          },
        })
      );
    });

    it('should handle FormData by removing the default JSON Content-Type', async () => {
      // Mock FormData in a Node.js environment
      const mockFormData = {
        _isFormData: true, // A flag to identify it in tests
        append: jest.fn(),
        getHeaders: () => ({
          'content-type': 'multipart/form-data; boundary=...',
        }),
      };

      axios.mockResolvedValue({ data: {} });
      await post(MOCK_URL, mockFormData);

      const axiosCallConfig = axios.mock.calls[0][0];

      // Check that the default 'application/json' header was removed
      expect(axiosCallConfig.headers['Content-Type']).not.toBe(
        'application/json;charset=UTF-8'
      );
      // Check that the headers from FormData itself were added
      expect(axiosCallConfig.headers['content-type']).toContain(
        'multipart/form-data'
      );
    });

    it('should wrap a 404 error in a DaitanApiError', async () => {
      const errorResponse = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { error: 'Resource does not exist' },
          headers: {},
        },
      };
      axios.mockRejectedValue(errorResponse);

      await expect(query({ url: MOCK_URL })).rejects.toThrow(DaitanApiError);
      try {
        await query({ url: MOCK_URL });
      } catch (e) {
        expect(e.httpStatusCode).toBe(404);
        expect(e.details.apiName).toBe('api.example.com');
        expect(e.details.responseData).toEqual({
          error: 'Resource does not exist',
        });
      }
    });

    it('should wrap a network timeout error in a DaitanNetworkError', async () => {
      const networkError = new Error('Request timed out');
      networkError.code = 'ECONNABORTED';
      networkError.request = { path: '/data' }; // Simulate a request object being present
      axios.mockRejectedValue(networkError);

      await expect(query({ url: MOCK_URL })).rejects.toThrow(
        DaitanNetworkError
      );
      try {
        await query({ url: MOCK_URL });
      } catch (e) {
        expect(e.message).toContain('timed out');
        expect(e.details.errorCode).toBe('ECONNABORTED');
      }
    });

    it('should wrap a general request setup error in a DaitanOperationError', async () => {
      const setupError = new Error(
        'Something bad happened before request was sent'
      );
      axios.mockRejectedValue(setupError); // No .request or .response property

      await expect(query({ url: MOCK_URL })).rejects.toThrow(
        DaitanOperationError
      );
      try {
        await query({ url: MOCK_URL });
      } catch (e) {
        expect(e.message).toContain('Error setting up request');
        expect(e.originalError).toBe(setupError);
      }
    });
  });

  // --- Tests for convenience methods ---
  describe('Convenience methods', () => {
    it('get() should call query with method GET', async () => {
      axios.mockResolvedValue({ data: {} });
      await get(MOCK_URL, { params: { id: 1 } });
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: MOCK_URL,
          params: { id: 1 },
        })
      );
    });

    it('put() should call query with method PUT and data', async () => {
      axios.mockResolvedValue({ data: {} });
      const putData = { name: 'Updated Name' };
      await put(MOCK_URL, putData);
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'PUT', url: MOCK_URL, data: putData })
      );
    });

    it('del() should call query with method DELETE', async () => {
      axios.mockResolvedValue({ data: {} });
      await del(MOCK_URL);
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'DELETE', url: MOCK_URL })
      );
    });

    it('patch() should call query with method PATCH and data', async () => {
      axios.mockResolvedValue({ data: {} });
      const patchData = { name: 'Patched Name' };
      await patch(MOCK_URL, patchData);
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          url: MOCK_URL,
          data: patchData,
        })
      );
    });
  });
});
