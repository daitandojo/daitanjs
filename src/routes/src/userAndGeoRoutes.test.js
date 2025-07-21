// src/routes/src/userAndGeoRoutes.test.js
import { NextResponse } from 'next/server';
import {
  handleCreateUser,
  handleGetUserById,
  handleUpdateUser,
  handleDeleteUser,
  handleGetMyProfile,
} from './userRoutes.js';
import { handleForwardGeocode, handleReverseGeocode } from './geoRoutes.js';
import {
  createUser,
  getUserById,
  updateUser,
  deleteUser,
} from '@daitanjs/users';
import { forwardGeocode, reverseGeocode } from '@daitanjs/geo';
import { DaitanNotFoundError, DaitanAuthorizationError } from '@daitanjs/error';

// --- Mocking Setup ---
jest.mock('@daitanjs/users');
jest.mock('@daitanjs/geo');
jest.mock('@daitanjs/middleware', () => ({
  withAuth: jest.fn((handler) => (req, context) => {
    req.user = { id: 'mock-user-id', sub: 'mock-user-id', role: 'user' };
    return handler(req, context);
  }),
}));

jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({ error: jest.fn(), debug: jest.fn() })),
}));

const createMockRequest = (
  method,
  body,
  url = 'http://localhost/api/test'
) => ({
  method,
  url: new URL(url),
  json: async () => body,
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('@daitanjs/routes (User & Geo Routes)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- User Routes ---
  describe('User Routes', () => {
    describe('handleCreateUser', () => {
      it('should create a user and return 201 status for a new user', async () => {
        const userData = { email: 'test@example.com', name: 'Test' };
        createUserService.mockResolvedValue({
          document: { _id: '123', ...userData },
          status: 'inserted',
          isNew: true,
        });

        const req = createMockRequest('POST', userData);
        const response = await handleCreateUser(req);
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body.success).toBe(true);
        expect(body.data.email).toBe(userData.email);
        expect(body.statusMessage).toBe('inserted');
      });

      it('should return 200 status if user already existed', async () => {
        const userData = { email: 'test@example.com', name: 'Test' };
        createUserService.mockResolvedValue({
          document: { _id: '123', ...userData },
          status: 'matched_no_update',
          isNew: false,
        });

        const req = createMockRequest('POST', userData);
        const response = await handleCreateUser(req);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.statusMessage).toBe('matched_no_update');
      });
    });

    describe('handleGetUserById', () => {
      it('should return a user profile for an authenticated request to their own ID', async () => {
        const mockUser = {
          _id: 'mock-user-id',
          name: 'Mock User',
          email: 'mock@test.com',
        };
        getUserByIdService.mockResolvedValue(mockUser);
        const req = createMockRequest('GET');
        const context = { params: { id: 'mock-user-id' } };

        const response = await handleGetUserById(req, context);
        const body = await response.json();

        expect(getUserByIdService).toHaveBeenCalledWith('mock-user-id');
        expect(response.status).toBe(200);
        expect(body.data.name).toBe('Mock User');
      });

      it("should return 403 Forbidden if requesting another user's profile", async () => {
        const req = createMockRequest('GET');
        const context = { params: { id: 'other-user-id' } };
        const response = await handleGetUserById(req, context);
        const body = await response.json();
        expect(response.status).toBe(403);
        expect(body.error).toContain('not authorized');
      });
    });

    describe('handleGetMyProfile', () => {
      it('should return the profile of the currently authenticated user', async () => {
        const mockUser = { _id: 'mock-user-id', name: 'Current User' };
        getUserByIdService.mockResolvedValue(mockUser);
        const req = createMockRequest('GET');
        const response = await handleGetMyProfile(req, {});
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.data.name).toBe('Current User');
        expect(getUserByIdService).toHaveBeenCalledWith('mock-user-id');
      });
    });

    describe('handleUpdateUser', () => {
      it("should update the authenticated user's profile", async () => {
        const updateData = { name: 'Updated Name' };
        updateUserService.mockResolvedValue({
          _id: 'mock-user-id',
          name: 'Updated Name',
        });
        const req = createMockRequest('PATCH', updateData);
        const response = await handleUpdateUser(req);
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.data.name).toBe('Updated Name');
        expect(updateUserService).toHaveBeenCalledWith(
          'mock-user-id',
          updateData
        );
      });
    });

    describe('handleDeleteUser', () => {
      it("should delete the authenticated user's profile", async () => {
        deleteUserService.mockResolvedValue({
          acknowledged: true,
          deletedCount: 1,
        });
        const req = createMockRequest('DELETE');
        const response = await handleDeleteUser(req);
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.data.message).toContain('successfully deleted');
        expect(deleteUserService).toHaveBeenCalledWith('mock-user-id');
      });
    });
  });

  describe('Geo Routes', () => {
    describe('handleForwardGeocode', () => {
      it('should return geocoding results for a valid query', async () => {
        const mockResults = [
          { place_name: 'Paris, France', center: [2.35, 48.85] },
        ];
        forwardGeocode.mockResolvedValue(mockResults);
        const req = createMockRequest('POST', { locationQuery: 'Paris' });
        const response = await handleForwardGeocode(req);
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.data).toEqual(mockResults);
        expect(forwardGeocode).toHaveBeenCalledWith({ locationQuery: 'Paris' });
      });
    });

    describe('handleReverseGeocode', () => {
      it('should return an address for valid coordinates', async () => {
        const mockResults = [{ place_name: 'Eiffel Tower, Paris' }];
        reverseGeocode.mockResolvedValue(mockResults);
        const req = createMockRequest('POST', { coordinates: [2.29, 48.85] });
        const response = await handleReverseGeocode(req);
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.data).toEqual(mockResults);
        expect(reverseGeocode).toHaveBeenCalledWith({
          coordinates: [2.29, 48.85],
        });
      });
    });
  });
});
