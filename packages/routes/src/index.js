// routes/src/index.js
/**
 * @file Main entry point for the @daitanjs/routes package.
 * @module @daitanjs/routes
 *
 * @description
 * This package provides pre-built API route handlers for a Next.js App Router environment,
 * designed to work seamlessly with other DaitanJS packages. It exposes a comprehensive
 * suite of endpoints for authentication, user management, geolocation, AI services,
 * payments, media, and queue management.
 *
 * @example
 * // In your `app/api/auth/login/route.js`:
 * export { handleLogin as POST } from '@daitanjs/routes';
 *
 * // In your `app/api/users/[id]/route.js`:
 * export { handleGetUserById as GET } from '@daitanjs/routes';
 *
 * // In your `app/api/ai/chat/route.js`:
 * export { handleLlmChat as POST } from '@daitanjs/routes';
 */

import { getLogger } from '@daitanjs/development';

const routesIndexLogger = getLogger('daitan-routes-index');

routesIndexLogger.debug(
  'Exporting all DaitanJS Route module functionalities...'
);

// --- Helper Utilities ---
export {
  handleApiError,
  createSuccessResponse,
  getJsonBody,
} from './helpers.js';

// --- Authentication Route Handlers ---
export {
  handleLogin,
  handleSignUp,
  handleGoogleLogin,
  handleGoogleCallback,
} from './authRoutes.js';

// --- User Management Route Handlers ---
export {
  handleCreateUser,
  handleGetUserById,
  handleUpdateUser,
  handleDeleteUser,
  handleGetMyProfile,
} from './userRoutes.js';

// --- Geolocation Route Handlers ---
export { handleForwardGeocode, handleReverseGeocode } from './geoRoutes.js';

// --- Speech Synthesis & Recognition Route Handlers ---
export { handleTTS, handleSTT } from './speechRoutes.js';

// --- AI & Senses Route Handlers ---
export {
  handleLlmChat,
  handleImageGeneration,
  handleImageAnalysis,
} from './intelligenceRoutes.js';

// --- Payment Route Handlers ---
export { handleCreatePaymentIntent } from './paymentRoutes.js';

// --- Queue Management Route Handlers ---
export { handleGetJobStatus } from './queueRoutes.js';

// --- Media Route Handlers ---
export { handleYoutubeSearch } from './mediaRoutes.js';

routesIndexLogger.info(
  'DaitanJS Routes module exports are fully configured and ready.'
);
