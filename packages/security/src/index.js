// security/src/index.js
/**
 * @file Security utilities including OTP and JWT generation/verification.
 * @module @daitanjs/security
 *
 * @description
 * This library provides lightweight, focused security utilities for common tasks:
 * - **OTP (One-Time Password) Generation**: Create numeric or alphanumeric OTPs
 *   with configurable length and validity.
 * - **OTP Verification**: A conceptual helper for verifying submitted OTPs against stored ones.
 *   (Actual storage and retrieval of OTPs are handled by the consuming application).
 * - **JWT (JSON Web Token) Operations**: Generate, verify, and decode JWTs using
 *   the `jsonwebtoken` library. Includes default expiry and automatic `jti` (JWT ID) generation.
 *
 * All cryptographic operations rely on Node.js `crypto` module or the `jsonwebtoken` library.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid'; // For generating JWT IDs (jti)
import { getLogger } from '@daitanjs/development'; // For internal logging, if needed
import { DaitanInvalidInputError, DaitanOperationError } from '@daitanjs/error'; // For specific errors

const logger = getLogger('daitan-security'); // Logger for this module

// --- OTP (One-Time Password) Functionality ---

const DEFAULT_OTP_LENGTH = 6;
const DEFAULT_OTP_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * @typedef {Object} OTPGenerationResult
 * @property {string} otp - The generated One-Time Password.
 * @property {number} expiresAt - Timestamp (in milliseconds since epoch) when the OTP expires.
 */

/**
 * @typedef {Object} GenerateOTPOptions
 * @property {number} [length] - The desired length of the OTP.
 * @property {number} [validityMs] - The validity period of the OTP in milliseconds.
 */

/**
 * Generates a cryptographically secure numeric One-Time Password (OTP).
 *
 * @public
 * @param {GenerateOTPOptions} [options={}] - Options for OTP generation.
 * @returns {OTPGenerationResult} An object containing the OTP string and its expiry timestamp.
 * @throws {DaitanInvalidInputError} If `length` is not a positive integer or `validityMs` is not a positive number.
 */
export const generateNumericOTP = ({
  length = DEFAULT_OTP_LENGTH,
  validityMs = DEFAULT_OTP_VALIDITY_MS,
} = {}) => {
  if (!Number.isInteger(length) || length <= 0 || length > 10) {
    // Max length 10 for practical numeric OTPs
    throw new DaitanInvalidInputError(
      'OTP length must be a positive integer, typically between 4 and 10.'
    );
  }
  if (typeof validityMs !== 'number' || validityMs <= 0) {
    throw new DaitanInvalidInputError(
      'OTP validityMs must be a positive number.'
    );
  }

  // crypto.randomInt(max) generates an int in [0, max-1]. For length N, max is 10^N.
  // A more direct way is to generate `length` random digits.
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += crypto.randomInt(0, 10).toString();
  }

  const expiresAt = Date.now() + validityMs;
  logger.debug(
    `Generated numeric OTP (length ${length}), expires at ${new Date(
      expiresAt
    ).toISOString()}`
  );
  return { otp, expiresAt };
};

/**
 * Generates a cryptographically secure alphanumeric One-Time Password (OTP).
 *
 * @public
 * @param {GenerateOTPOptions} [options={length: 8, validityMs: DEFAULT_OTP_VALIDITY_MS}] - Options for OTP generation.
 * @returns {OTPGenerationResult} An object containing the OTP string and its expiry timestamp.
 * @throws {DaitanInvalidInputError} If `length` is not a positive integer or `validityMs` is not a positive number.
 */
export const generateAlphanumericOTP = ({
  length = 8,
  validityMs = DEFAULT_OTP_VALIDITY_MS,
} = {}) => {
  if (!Number.isInteger(length) || length <= 0 || length > 32) {
    // Max length for practical OTPs
    throw new DaitanInvalidInputError(
      'Alphanumeric OTP length must be a positive integer, typically between 6 and 32.'
    );
  }
  if (typeof validityMs !== 'number' || validityMs <= 0) {
    throw new DaitanInvalidInputError(
      'OTP validityMs must be a positive number.'
    );
  }

  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let otp = '';
  // Generate cryptographically secure random bytes
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    // Map byte to character index
    otp += characters[randomBytes[i] % characters.length];
  }
  const expiresAt = Date.now() + validityMs;
  logger.debug(
    `Generated alphanumeric OTP (length ${length}), expires at ${new Date(
      expiresAt
    ).toISOString()}`
  );
  return { otp, expiresAt };
};

/**
 * @typedef {Object} VerifyOTPOptions
 * @property {string} submittedOTP - The OTP submitted by the user.
 * @property {string} storedOTP - The OTP that was generated and stored by the application.
 * @property {number} storedOTPExpiresAt - The expiry timestamp (milliseconds since epoch) of the stored OTP.
 */

/**
 * Verifies a submitted OTP against a stored OTP and its expiry time.
 * This is a conceptual helper. The actual storage and retrieval of `storedOTP`
 * and `storedOTPExpiresAt` is the responsibility of the consuming application.
 *
 * @public
 * @param {VerifyOTPOptions} options - Parameters for OTP verification.
 * @returns {boolean} True if the OTP is valid (matches and not expired), false otherwise.
 */
export const verifyOTP = ({ submittedOTP, storedOTP, storedOTPExpiresAt }) => {
  if (
    typeof submittedOTP !== 'string' ||
    !submittedOTP ||
    typeof storedOTP !== 'string' ||
    !storedOTP ||
    typeof storedOTPExpiresAt !== 'number'
  ) {
    logger.warn('verifyOTP: Invalid parameters received for OTP verification.');
    return false;
  }

  if (Date.now() > storedOTPExpiresAt) {
    logger.debug('OTP verification failed: OTP has expired.');
    return false; // OTP has expired
  }

  // Constant-time comparison is not strictly necessary for OTPs of typical length,
  // but good practice if maximum security is paramount. For simplicity, direct comparison is used.
  const isValid = crypto.timingSafeEqual(
    Buffer.from(submittedOTP),
    Buffer.from(storedOTP)
  );

  if (!isValid) {
    logger.debug(
      'OTP verification failed: Submitted OTP does not match stored OTP.'
    );
  } else {
    logger.debug('OTP verification successful.');
  }
  return isValid;
};

// --- JWT (JSON Web Token) Functionality ---

const DEFAULT_JWT_EXPIRY = '1h'; // Default expiry time for JWTs

/**
 * @typedef {Object} GenerateJWTOptions
 * @property {object} payload - The payload to include in the JWT.
 * @property {string | Buffer} secretOrPrivateKey - The secret or private key for signing.
 * @property {jwt.SignOptions} [options] - Options for JWT signing (e.g., `expiresIn`).
 */

/**
 * Generates a JSON Web Token (JWT).
 *
 * @public
 * @param {GenerateJWTOptions} params - Parameters for JWT generation.
 * @returns {string} The generated JWT string.
 * @throws {DaitanInvalidInputError} If `payload` or `secretOrPrivateKey` is missing or invalid.
 * @throws {DaitanOperationError} If `jsonwebtoken.sign` fails.
 */
export const generateJWT = ({ payload, secretOrPrivateKey, options = {} }) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new DaitanInvalidInputError(
      'JWT payload must be a non-null plain object.'
    );
  }
  if (!secretOrPrivateKey) {
    throw new DaitanInvalidInputError(
      'JWT secret or private key is required for signing.'
    );
  }

  const jwtOptions = {
    expiresIn: DEFAULT_JWT_EXPIRY,
    jwtid: uuidv4(), // JWT ID (jti) claim, useful for revocation or tracking
    ...options, // User-provided options override defaults
  };

  try {
    const token = jwt.sign(payload, secretOrPrivateKey, jwtOptions);
    logger.debug(
      `Generated JWT with JTI: ${jwtOptions.jwtid}, expires: ${jwtOptions.expiresIn}.`
    );
    return token;
  } catch (error) {
    logger.error(`Error generating JWT: ${error.message}`, {
      errorName: error.name,
    });
    throw new DaitanOperationError(
      `JWT signing failed: ${error.message}`,
      {},
      error
    );
  }
};

/**
 * @typedef {Object} VerifyJWTOptions
 * @property {string} token - The JWT string to verify.
 * @property {string | Buffer} secretOrPublicKey - The secret or public key for verification.
 * @property {jwt.VerifyOptions} [options] - Options for JWT verification.
 */

/**
 * Verifies a JSON Web Token (JWT).
 *
 * @public
 * @param {VerifyJWTOptions} params - Parameters for JWT verification.
 * @returns {object | string} The decoded payload if verification is successful.
 * @throws {DaitanInvalidInputError} If `token` or `secretOrPublicKey` is missing.
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError | jwt.NotBeforeError} Throws specific errors from `jsonwebtoken` on failure.
 */
export const verifyJWT = ({ token, secretOrPublicKey, options = {} }) => {
  if (!token || typeof token !== 'string') {
    throw new DaitanInvalidInputError(
      'JWT token string is required for verification.'
    );
  }
  if (!secretOrPublicKey) {
    throw new DaitanInvalidInputError(
      'JWT secret or public key is required for verification.'
    );
  }

  try {
    const decoded = jwt.verify(token, secretOrPublicKey, options);
    logger.debug('JWT verified successfully.', {
      jti: decoded.jti,
      sub: decoded.sub,
    });
    return decoded;
  } catch (error) {
    logger.warn(`JWT verification failed: ${error.message}`, {
      errorName: error.name,
      tokenPreview: token.substring(0, 20) + '...',
    });
    throw error;
  }
};

/**
 * @typedef {Object} DecodeJWTOptions
 * @property {string} token - The JWT string to decode.
 * @property {jwt.DecodeOptions} [options] - Options for decoding.
 */

/**
 * Decodes a JSON Web Token (JWT) without verifying its signature.
 *
 * @public
 * @param {DecodeJWTOptions} params - Parameters for JWT decoding.
 * @returns {null | string | { [key: string]: any }} The decoded payload or null if malformed.
 */
export const decodeJWT = ({ token, options = {} }) => {
  if (!token || typeof token !== 'string') {
    logger.warn('decodeJWT: Invalid or missing token string provided.');
    return null;
  }
  try {
    const decoded = jwt.decode(token, options);
    if (decoded === null) {
      logger.warn('decodeJWT: Token was malformed and could not be decoded.', {
        tokenPreview: token.substring(0, 20) + '...',
      });
    } else {
      logger.debug('JWT decoded (signature NOT VERIFIED).');
    }
    return decoded;
  } catch (error) {
    logger.error(`Error during JWT decode (unexpected): ${error.message}`, {
      errorName: error.name,
    });
    return null;
  }
};
