// src/users/src/index.test.js
import {
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
} from './index.js';
// Import from the main data package entry point
import {
  User as UserModel,
  upsertOneWithRetry,
  findWithModel,
} from '@daitanjs/data';
import {
  DaitanInvalidInputError,
  DaitanNotFoundError,
  DaitanDatabaseError,
} from '@daitanjs/error';

// --- Mocking Setup ---
// Mock the entire @daitanjs/data package to control the behavior of its exports.
jest.mock('@daitanjs/data', () => ({
  // We need to mock the User model and the utility functions separately.
  User: {
    findByIdAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  },
  upsertOneWithRetry: jest.fn(),
  findWithModel: jest.fn(),
}));

jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('@daitanjs/users service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should call upsertOneWithRetry with correct parameters and return the result', async () => {
      const userData = { email: 'new@example.com', name: 'New User' };
      const mockUpsertResult = {
        document: { _id: '123', ...userData },
        status: 'inserted',
        isNew: true,
      };
      upsertOneWithRetry.mockResolvedValue(mockUpsertResult);

      const result = await createUser(userData);

      expect(upsertOneWithRetry).toHaveBeenCalledWith(
        UserModel,
        { email: 'new@example.com' },
        userData,
        expect.any(Object)
      );
      expect(result).toEqual(mockUpsertResult);
    });

    it('should throw DaitanInvalidInputError if userData or email is missing', async () => {
      await expect(createUser(null)).rejects.toThrow(DaitanInvalidInputError);
      await expect(createUser({ name: 'No Email' })).rejects.toThrow(
        DaitanInvalidInputError
      );
    });

    it('should propagate DaitanDatabaseError from the data layer', async () => {
      const dbError = new DaitanDatabaseError('DB connection lost');
      upsertOneWithRetry.mockRejectedValue(dbError);

      await expect(createUser({ email: 'test@fail.com' })).rejects.toThrow(
        DaitanDatabaseError
      );
      await expect(createUser({ email: 'test@fail.com' })).rejects.toThrow(
        'DB connection lost'
      );
    });
  });

  describe('getUserById', () => {
    it('should call findWithModel and return the user if found', async () => {
      const mockUser = { _id: '123', email: 'found@example.com' };
      findWithModel.mockResolvedValue([mockUser]); // findWithModel returns an array

      const user = await getUserById('123');

      expect(findWithModel).toHaveBeenCalledWith(
        UserModel,
        { _id: '123' },
        { lean: true }
      );
      expect(user).toEqual(mockUser);
    });

    it('should return null if user is not found', async () => {
      findWithModel.mockResolvedValue([]); // Simulate not found
      const user = await getUserById('nonexistent');
      expect(user).toBeNull();
    });

    it('should throw DaitanInvalidInputError for an invalid ID', async () => {
      await expect(getUserById(' ')).rejects.toThrow(DaitanInvalidInputError);
    });
  });

  describe('getUserByEmail', () => {
    it('should call findWithModel with a normalized email and return the user', async () => {
      const mockUser = { _id: '123', email: 'found@example.com' };
      findWithModel.mockResolvedValue([mockUser]);

      const user = await getUserByEmail(' FOUND@example.com ');

      expect(findWithModel).toHaveBeenCalledWith(
        UserModel,
        { email: 'found@example.com' },
        { lean: true }
      );
      expect(user).toEqual(mockUser);
    });
  });

  describe('updateUser', () => {
    it('should call findByIdAndUpdate and return the updated user', async () => {
      const updateData = { name: 'Updated Name' };
      const mockUpdatedUser = {
        _id: '123',
        email: 'test@test.com',
        name: 'Updated Name',
      };
      // Mongoose's findByIdAndUpdate returns a query object, so we mock .exec()
      UserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUpdatedUser),
      });

      const user = await updateUser('123', updateData);

      expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '123',
        { $set: updateData },
        expect.any(Object)
      );
      expect(user).toEqual(mockUpdatedUser);
    });

    it('should throw DaitanNotFoundError if findByIdAndUpdate returns null', async () => {
      UserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(updateUser('nonexistent', { name: 'test' })).rejects.toThrow(
        DaitanNotFoundError
      );
    });

    it('should strip read-only fields from the update payload', async () => {
      const updateData = {
        name: 'Updated',
        email: 'new@email.com',
        _id: '456',
        hash: 'newhash',
      };
      const expectedPayload = { $set: { name: 'Updated' } }; // email, _id, hash should be stripped
      UserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: '123', ...updateData }),
      });

      await updateUser('123', updateData);
      expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '123',
        expectedPayload,
        expect.any(Object)
      );
    });
  });

  describe('deleteUser', () => {
    it('should call deleteOne and return the result on success', async () => {
      const mockDeleteResult = { acknowledged: true, deletedCount: 1 };
      UserModel.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDeleteResult),
      });

      const result = await deleteUser('123');

      expect(UserModel.deleteOne).toHaveBeenCalledWith({ _id: '123' });
      expect(result).toEqual(mockDeleteResult);
    });

    it('should throw DaitanNotFoundError if no user was deleted', async () => {
      const mockDeleteResult = { acknowledged: true, deletedCount: 0 };
      UserModel.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDeleteResult),
      });

      await expect(deleteUser('nonexistent')).rejects.toThrow(
        DaitanNotFoundError
      );
    });
  });
});
