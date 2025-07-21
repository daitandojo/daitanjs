// routes/src/userRoutes.js
/**
 * @file Reusable Next.js App Router route handlers for user management.
 * @module @daitanjs/routes/userRoutes
 *
 * @description
 * This module provides pre-built API route handlers for user CRUD operations.
 * They wrap the core functionalities of the `@daitanjs/users` service package.
 * Authentication middleware is applied where necessary to protect routes.
 */
import {
  createUser as createUserService,
  getUserById as getUserByIdService,
  updateUser as updateUserService,
  deleteUser as deleteUserService,
} from '@daitanjs/users';
import {
  handleApiError,
  createSuccessResponse,
  getJsonBody,
} from './helpers.js';
import { withAuth } from '@daitanjs/middleware';
import { DaitanAuthorizationError, DaitanNotFoundError } from '@daitanjs/error';

/**
 * Route handler for creating a new user.
 * This is typically an open endpoint, but can be protected if needed.
 * @param {import('next/server').NextRequest} req
 * @returns {Promise<import('next/server').NextResponse>}
 */
export async function handleCreateUser(req) {
  try {
    const userData = await getJsonBody(req);
    const result = await createUserService(userData);
    const status = result.isNew ? 201 : 200;
    return createSuccessResponse(result.document, status, {
      statusMessage: result.status,
    });
  } catch (error) {
    return handleApiError(error, 'createUser');
  }
}

/**
 * Route handler for retrieving a user's public profile by their ID.
 * @param {import('next/server').NextRequest} req
 * @param {{ params: { id: string } }} context
 * @returns {Promise<import('next/server').NextResponse>}
 */
async function getSingleUserHandler(req, context) {
  try {
    const userIdToView = context.params?.id;
    const requesterId = req.user?.id || req.user?.sub;

    if (requesterId !== userIdToView) {
      // Add more complex role-based checks here if necessary
      // e.g., if (req.user.role !== 'admin') { ... }
      throw new DaitanAuthorizationError(
        'You are not authorized to view this user profile.'
      );
    }

    const user = await getUserByIdService(userIdToView);
    if (!user) {
      throw new DaitanNotFoundError(`User with ID ${userIdToView} not found.`);
    }

    // Omit sensitive fields before sending the response
    const { hash, salt, ...publicProfile } = user;
    return createSuccessResponse(publicProfile);
  } catch (error) {
    return handleApiError(error, 'getUserById');
  }
}
export const handleGetUserById = withAuth(getSingleUserHandler);

/**
 * Route handler for updating the authenticated user's profile.
 * @param {import('next/server').NextRequest} req
 * @returns {Promise<import('next/server').NextResponse>}
 */
async function updateUserHandler(req) {
  try {
    const userIdToUpdate = req.user?.id || req.user?.sub;
    const updateData = await getJsonBody(req);
    const updatedUser = await updateUserService(userIdToUpdate, updateData);
    const { hash, salt, ...publicProfile } = updatedUser;
    return createSuccessResponse(publicProfile);
  } catch (error) {
    return handleApiError(error, 'updateUser');
  }
}
export const handleUpdateUser = withAuth(updateUserHandler);

/**
 * Route handler for deleting the authenticated user's account.
 * @param {import('next/server').NextRequest} req
 * @returns {Promise<import('next/server').NextResponse>}
 */
async function deleteUserHandler(req) {
  try {
    const userIdToDelete = req.user?.id || req.user?.sub;
    await deleteUserService(userIdToDelete);
    return createSuccessResponse({
      message: `User account ${userIdToDelete} successfully deleted.`,
    });
  } catch (error) {
    return handleApiError(error, 'deleteUser');
  }
}
export const handleDeleteUser = withAuth(deleteUserHandler);

/**
 * Route handler to get the profile of the currently authenticated user.
 * @param {import('next/server').NextRequest} req
 * @returns {Promise<import('next/server').NextResponse>}
 */
async function getMyProfileHandler(req) {
  try {
    const userId = req.user?.id || req.user?.sub;
    const user = await getUserByIdService(userId);
    if (!user) {
      throw new DaitanNotFoundError(
        `Authenticated user profile with ID ${userId} not found in database.`
      );
    }
    const { hash, salt, ...publicProfile } = user;
    return createSuccessResponse(publicProfile);
  } catch (error) {
    return handleApiError(error, 'getMyProfile');
  }
}
export const handleGetMyProfile = withAuth(getMyProfileHandler);
