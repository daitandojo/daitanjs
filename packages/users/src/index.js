// src/users/src/index.js
/**
 * @file User data management service layer.
 * @module @daitanjs/users
 *
 * @description
 * This service-layer package provides a clean, abstracted API for performing
 * CRUD (Create, Read, Update, Delete) operations on user data. It acts as an
 * intermediary between the application logic and the data persistence layer
 * (which is handled by `@daitanjs/data`).
 *
 * This abstraction allows the underlying data storage implementation to change
 * in the future without affecting the consuming application code, as long as the
 * function signatures in this module remain consistent.
 */
import { getLogger } from '@daitanjs/development';
import { User, findWithModel, upsertOneWithRetry } from '@daitanjs/data';
import {
  DaitanInvalidInputError,
  DaitanNotFoundError,
  DaitanDatabaseError,
} from '@daitanjs/error';

const userLogger = getLogger('daitan-users-service');

/**
 * @typedef {import('@daitanjs/data').User} UserModelType
 */

/**
 * Creates a new user or updates an existing one based on email.
 * This is an idempotent operation.
 * @public
 * @async
 * @param {object} userData - The user data, must include an 'email' property.
 * @param {object} [options={}] - Options for the operation.
 * @param {boolean} [options.verbose] - Enable verbose logging for this call.
 * @returns {Promise<import('@daitanjs/data/mongodb/mongooseUtils.js').UpsertResult>} Result object from the upsert operation.
 * @throws {DaitanInvalidInputError} If userData or email is missing/invalid.
 */
export const createUser = async (userData, options = {}) => {
  const callId = `createUser-${userData?.email || Date.now().toString(36)}`;
  userLogger.info(`[${callId}] Attempting to create or update user.`, {
    email: userData?.email,
  });

  if (!userData || typeof userData !== 'object' || !userData.email) {
    throw new DaitanInvalidInputError(
      'User data with a valid email is required to create a user.'
    );
  }

  // The `upsertOneWithRetry` function handles the logic of finding by email and creating/updating.
  const filter = { email: userData.email.toLowerCase().trim() };

  try {
    const result = await upsertOneWithRetry(User, filter, userData, {
      loggerInstance: userLogger,
    });

    userLogger.info(
      `[${callId}] User operation completed successfully. Status: ${result.status}`,
      { email: userData.email, userId: result.document?._id }
    );
    return result;
  } catch (error) {
    userLogger.error(
      `[${callId}] Error during createUser for email "${userData.email}": ${error.message}`
    );
    // Re-throw the original error, which will be a DaitanError type from the data layer.
    throw error;
  }
};

/**
 * Retrieves a user by their unique database ID.
 * @public
 * @async
 * @param {string} userId - The ID of the user to retrieve.
 * @returns {Promise<object | null>} The user document, or null if not found.
 * @throws {DaitanInvalidInputError} If userId is invalid.
 */
export const getUserById = async (userId) => {
  userLogger.info(`Attempting to retrieve user by ID: ${userId}`);
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new DaitanInvalidInputError('A valid user ID string is required.');
  }

  try {
    // `findWithModel` is used for a consistent read interface.
    const results = await findWithModel(User, { _id: userId }, { lean: true });
    if (results.length === 0) {
      userLogger.warn(`User not found with ID: ${userId}`);
      return null;
    }
    userLogger.info(`Successfully retrieved user with ID: ${userId}`);
    return results[0];
  } catch (error) {
    userLogger.error(
      `Error retrieving user by ID "${userId}": ${error.message}`
    );
    throw error; // Propagate the DaitanDatabaseError from findWithModel
  }
};

/**
 * Retrieves a user by their email address.
 * @public
 * @async
 * @param {string} email - The email address to search for.
 * @returns {Promise<object | null>} The user document, or null if not found.
 * @throws {DaitanInvalidInputError} If email is invalid.
 */
export const getUserByEmail = async (email) => {
  userLogger.info(`Attempting to retrieve user by email: ${email}`);
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new DaitanInvalidInputError(
      'A valid email address string is required.'
    );
  }

  try {
    const results = await findWithModel(
      User,
      { email: email.toLowerCase().trim() },
      { lean: true }
    );
    if (results.length === 0) {
      userLogger.warn(`User not found with email: ${email}`);
      return null;
    }
    userLogger.info(`Successfully retrieved user with email: ${email}`);
    return results[0];
  } catch (error) {
    userLogger.error(
      `Error retrieving user by email "${email}": ${error.message}`
    );
    throw error;
  }
};

/**
 * Updates an existing user's data.
 * @public
 * @async
 * @param {string} userId - The ID of the user to update.
 * @param {object} updateData - The fields to update.
 * @returns {Promise<object>} The updated user document.
 * @throws {DaitanInvalidInputError} If userId or updateData are invalid.
 * @throws {DaitanNotFoundError} If the user to update is not found.
 * @throws {DaitanDatabaseError} If the update operation fails.
 */
export const updateUser = async (userId, updateData) => {
  const callId = `updateUser-${userId}`;
  userLogger.info(`[${callId}] Attempting to update user.`);

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new DaitanInvalidInputError(
      'A valid user ID string is required for update.'
    );
  }
  if (
    !updateData ||
    typeof updateData !== 'object' ||
    Object.keys(updateData).length === 0
  ) {
    throw new DaitanInvalidInputError('updateData must be a non-empty object.');
  }

  // Prevent modification of immutable or sensitive fields
  const {
    _id,
    email,
    createdAt,
    updatedAt,
    __v,
    hash,
    salt,
    ...safeUpdateData
  } = updateData;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: safeUpdateData },
      { new: true, runValidators: true, lean: true }
    ).exec();

    if (!updatedUser) {
      throw new DaitanNotFoundError(`User with ID "${userId}" not found.`);
    }

    userLogger.info(`[${callId}] Successfully updated user: ${userId}`);
    return updatedUser;
  } catch (error) {
    userLogger.error(
      `[${callId}] Error updating user "${userId}": ${error.message}`
    );
    if (error instanceof DaitanNotFoundError) {
      throw error;
    }
    if (error.name === 'ValidationError') {
      throw new DaitanInvalidInputError(
        `User update failed validation: ${error.message}`,
        { validationErrors: error.errors }
      );
    }
    throw new DaitanDatabaseError(
      `Database error while updating user "${userId}": ${error.message}`,
      { userId },
      error
    );
  }
};

/**
 * Deletes a user from the database.
 * @public
 * @async
 * @param {string} userId - The ID of the user to delete.
 * @returns {Promise<{acknowledged: boolean, deletedCount: number}>} The result of the delete operation.
 * @throws {DaitanInvalidInputError} If userId is invalid.
 * @throws {DaitanNotFoundError} If the user to delete is not found.
 * @throws {DaitanDatabaseError} If the delete operation fails.
 */
export const deleteUser = async (userId) => {
  userLogger.info(`Attempting to delete user: ${userId}`);
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new DaitanInvalidInputError(
      'A valid user ID string is required for deletion.'
    );
  }

  try {
    const result = await User.deleteOne({ _id: userId }).exec();
    if (result.deletedCount === 0) {
      throw new DaitanNotFoundError(`User with ID "${userId}" not found.`);
    }
    userLogger.info(`Successfully deleted user: ${userId}.`);
    return {
      acknowledged: result.acknowledged,
      deletedCount: result.deletedCount,
    };
  } catch (error) {
    userLogger.error(`Error deleting user "${userId}": ${error.message}`);
    if (error instanceof DaitanNotFoundError) throw error;
    throw new DaitanDatabaseError(
      `Database error while deleting user "${userId}": ${error.message}`,
      { userId },
      error
    );
  }
};
