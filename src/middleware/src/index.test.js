// src/middleware/src/index.test.js
import { NextResponse } from 'next/server';
import { withAuth } from './index.js';
import { verifyJWT } from '@daitanjs/security';
import {
  DaitanAuthenticationError,
  DaitanConfigurationError,
} from '@daitanjs/error';

// Mock dependencies
jest.mock('@daitanjs/security');
jest.mock('@daitanjs/development', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
  getRequiredEnvVariable: jest.fn().mockReturnValue('mock-secret'),
}));

// Helper to create mock NextRequest objects
const createMockRequest = (headers = {}, cookies = {}) => {
  const requestHeaders = new Headers(headers);
  const requestCookies = {
    get: (key) => cookies[key],
  };

  return {
    headers: requestHeaders,
    cookies: requestCookies,
    nextUrl: new URL('http://localhost/api/protected'),
  };
};

describe('@daitanjs/middleware', () => {
  describe('withAuth', () => {
    let mockHandler;

    beforeEach(() => {
      mockHandler = jest.fn(async (req) => {
        return NextResponse.json({ success: true, user: req.user });
      });
      jest.clearAllMocks();
    });

    it('should call the handler with user payload when token is in Authorization header', async () => {
      const token = 'valid-jwt';
      const userPayload = { id: 'user123', role: 'admin' };
      verifyJWT.mockReturnValue(userPayload);

      const req = createMockRequest({ Authorization: `Bearer ${token}` });
      const authenticatedHandler = withAuth(mockHandler);
      const response = await authenticatedHandler(req, {});
      const body = await response.json();

      expect(verifyJWT).toHaveBeenCalledWith(token, 'mock-secret');
      expect(mockHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.user).toEqual(userPayload);
    });

    it('should call the handler with user payload when token is in a cookie', async () => {
      const token = 'valid-cookie-jwt';
      const userPayload = { id: 'user456', role: 'user' };
      verifyJWT.mockReturnValue(userPayload);

      const req = createMockRequest({}, { 'auth-token': { value: token } });
      const authenticatedHandler = withAuth(mockHandler);
      const response = await authenticatedHandler(req, {});
      const body = await response.json();

      expect(verifyJWT).toHaveBeenCalledWith(token, 'mock-secret');
      expect(response.status).toBe(200);
      expect(body.user).toEqual(userPayload);
    });

    it('should return 401 Unauthorized if no token is provided', async () => {
      const req = createMockRequest();
      const authenticatedHandler = withAuth(mockHandler);
      const response = await authenticatedHandler(req, {});
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toContain('No token provided');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should return 401 Unauthorized for an expired token', async () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      verifyJWT.mockImplementation(() => {
        throw error;
      });

      const req = createMockRequest({ Authorization: 'Bearer expired-token' });
      const authenticatedHandler = withAuth(mockHandler);
      const response = await authenticatedHandler(req, {});
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toContain('Token has expired');
    });

    it('should return 401 Unauthorized for an invalid token signature', async () => {
      const error = new Error('Invalid signature');
      error.name = 'JsonWebTokenError';
      verifyJWT.mockImplementation(() => {
        throw error;
      });

      const req = createMockRequest({ Authorization: 'Bearer invalid-token' });
      const authenticatedHandler = withAuth(mockHandler);
      const response = await authenticatedHandler(req, {});
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toContain('Invalid token signature');
    });

    it('should return 500 for a configuration error (e.g., missing JWT_SECRET)', async () => {
      const configError = new DaitanConfigurationError('JWT_SECRET not set');
      verifyJWT.mockImplementation(() => {
        throw configError;
      });

      const req = createMockRequest({ Authorization: 'Bearer some-token' });
      const authenticatedHandler = withAuth(mockHandler);
      const response = await authenticatedHandler(req, {});
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toContain(
        'Authentication service configuration error'
      );
    });
  });
});
