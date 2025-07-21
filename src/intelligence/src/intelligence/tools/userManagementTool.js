// intelligence/src/intelligence/tools/userManagementTool.js
/**
 * @file A DaitanJS tool for managing system users.
 * @module @daitanjs/intelligence/tools/userManagementTool
 */
import { z } from 'zod';
import { createDaitanTool } from '../core/toolFactory.js';
import { createUser, getUserByEmail, getUserById } from '@daitanjs/users';
import { DaitanNotFoundError, DaitanValidationError } from '@daitanjs/error';

// --- SCHEMA DEFINITIONS ---
// Define the individual action schemas as before.
const FindUserInputSchema = z
  .object({
    action: z.literal('find_user'),
    email: z.string().email('A valid email address is required.').optional(),
    userId: z.string().optional(),
  })
  .strict()
  .refine((data) => data.email || data.userId, {
    message:
      "To find a user, you must provide either the 'email' or the 'userId'.",
  });

const CreateUserInputSchema = z
  .object({
    action: z.literal('create_user'),
    email: z.string().email('A valid email address is required for creation.'),
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters long.')
      .optional(),
    username: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  })
  .strict();

// --- TOOL DEFINITION ---

export const userManagementTool = createDaitanTool(
  'user_management',
  `Manages users in the system. Can find a user by email or ID, or create a new user.
Input must be an object specifying the 'action' and its corresponding parameters.
- To find a user: {"action": "find_user", "email": "user@example.com"} OR {"action": "find_user", "userId": "some-id"}
- To create a user: {"action": "create_user", "email": "new@user.com", "name": "New User"}`,
  async (input) => {
    // --- DEFINITIVE FIX: Manual Validation Logic ---
    // Instead of a discriminated union, we manually check the action and validate.
    // This is more robust against module initialization order issues.
    if (!input || typeof input.action !== 'string') {
      throw new DaitanValidationError(
        "Invalid input: \"action\" key must be a string ('find_user' or 'create_user')."
      );
    }

    let validatedInput;
    if (input.action === 'find_user') {
      validatedInput = FindUserInputSchema.parse(input);
      let user;
      if (validatedInput.email) {
        user = await getUserByEmail(validatedInput.email);
      } else {
        user = await getUserById(validatedInput.userId);
      }
      if (!user) {
        throw new DaitanNotFoundError(
          `User not found with the provided criteria.`
        );
      }
      const { hash, salt, ...publicUser } = user.toObject
        ? user.toObject()
        : user;
      return `User found: ${JSON.stringify(publicUser, null, 2)}`;
    } else if (input.action === 'create_user') {
      validatedInput = CreateUserInputSchema.parse(input);
      const { action, ...userData } = validatedInput;
      const result = await createUser(userData);
      return `User operation successful. Status: ${result.status}. User ID: ${result.document._id}`;
    } else {
      throw new DaitanValidationError(
        `Unsupported action: "${input.action}". Must be 'find_user' or 'create_user'.`
      );
    }
  }
  // We remove the schema from the tool definition since we are handling validation manually inside.
);
