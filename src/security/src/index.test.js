// src/security/src/index.test.js
import {
  generateNumericOTP,
  generateAlphanumericOTP,
  verifyOTP,
  generateJWT,
  verifyJWT,
  decodeJWT,
} from './index.js';
import { DaitanInvalidInputError } from '@daitanjs/error';
import jwt from 'jsonwebtoken';

// Mock the logger
jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('@daitanjs/security', () => {
  // --- OTP Tests ---
  describe('OTP Functionality', () => {
    describe('generateNumericOTP', () => {
      it('should generate a numeric OTP of the specified length', () => {
        const { otp } = generateNumericOTP(8);
        expect(otp).toHaveLength(8);
        expect(otp).toMatch(/^[0-9]{8}$/);
      });

      it('should generate a 6-digit OTP by default', () => {
        const { otp } = generateNumericOTP();
        expect(otp).toHaveLength(6);
        expect(otp).toMatch(/^[0-9]{6}$/);
      });

      it('should return an expiry timestamp in the future', () => {
        const { expiresAt } = generateNumericOTP(6, 10000); // 10 seconds validity
        expect(expiresAt).toBeGreaterThan(Date.now());
        expect(expiresAt).toBeLessThanOrEqual(Date.now() + 10000);
      });

      it('should throw DaitanInvalidInputError for invalid length or validity', () => {
        expect(() => generateNumericOTP(0)).toThrow(DaitanInvalidInputError);
        expect(() => generateNumericOTP(-1)).toThrow(DaitanInvalidInputError);
        expect(() => generateNumericOTP(11)).toThrow(DaitanInvalidInputError);
        expect(() => generateNumericOTP('6')).toThrow(DaitanInvalidInputError);
        expect(() => generateNumericOTP(6, -100)).toThrow(
          DaitanInvalidInputError
        );
      });
    });

    describe('generateAlphanumericOTP', () => {
      it('should generate an alphanumeric OTP of the specified length', () => {
        const { otp } = generateAlphanumericOTP(10);
        expect(otp).toHaveLength(10);
        expect(otp).toMatch(/^[A-Za-z0-9]{10}$/);
      });

      it('should generate an 8-character OTP by default', () => {
        const { otp } = generateAlphanumericOTP();
        expect(otp).toHaveLength(8);
        expect(otp).toMatch(/^[A-Za-z0-9]{8}$/);
      });
    });

    describe('verifyOTP', () => {
      it('should return true for a valid, non-expired OTP', () => {
        const { otp, expiresAt } = generateNumericOTP();
        expect(verifyOTP(otp, otp, expiresAt)).toBe(true);
      });

      it('should return false for an incorrect OTP', () => {
        const { otp, expiresAt } = generateNumericOTP();
        expect(verifyOTP('000000', otp, expiresAt)).toBe(false);
      });

      it('should return false for an expired OTP', () => {
        // FIX: Manually create an expired timestamp instead of passing an invalid value to the generator
        const otp = '123456';
        const expiredTimestamp = Date.now() - 1000; // 1 second in the past
        expect(verifyOTP(otp, otp, expiredTimestamp)).toBe(false);
      });

      it('should return false for invalid inputs', () => {
        expect(verifyOTP(null, '123456', Date.now() + 10000)).toBe(false);
        expect(verifyOTP('123456', undefined, Date.now() + 10000)).toBe(false);
        expect(verifyOTP('123456', '123456', 'not a timestamp')).toBe(false);
      });
    });
  });

  // --- JWT Tests ---
  describe('JWT Functionality', () => {
    const secret = 'my-super-secret-key-for-testing';
    const payload = { userId: 123, role: 'user' };

    describe('generateJWT', () => {
      it('should generate a valid JWT string', () => {
        const token = generateJWT(payload, secret);
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3);
      });

      it('should include a jti claim by default', () => {
        const token = generateJWT(payload, secret);
        const decoded = jwt.decode(token);
        expect(decoded).toHaveProperty('jti');
        expect(typeof decoded.jti).toBe('string');
      });

      it('should use default expiry of 1h', () => {
        const token = generateJWT(payload, secret);
        const decoded = jwt.decode(token);
        expect(decoded.exp - decoded.iat).toBe(3600);
      });

      it('should use custom options like expiresIn', () => {
        const token = generateJWT(payload, secret, { expiresIn: '2h' });
        const decoded = jwt.decode(token);
        expect(decoded.exp - decoded.iat).toBe(7200);
      });

      it('should throw DaitanInvalidInputError for invalid payload or secret', () => {
        expect(() => generateJWT(null, secret)).toThrow(
          DaitanInvalidInputError
        );
        expect(() => generateJWT('not-an-object', secret)).toThrow(
          DaitanInvalidInputError
        );
        expect(() => generateJWT(payload, '')).toThrow(DaitanInvalidInputError);
      });
    });

    describe('verifyJWT', () => {
      it('should successfully verify a valid token and return its payload', () => {
        const token = generateJWT(payload, secret);
        const decoded = verifyJWT(token, secret);
        expect(decoded.userId).toBe(payload.userId);
        expect(decoded.role).toBe(payload.role);
      });

      it('should throw TokenExpiredError for an expired token', () => {
        const token = generateJWT(payload, secret, { expiresIn: '-1s' }); // Expired 1 second ago
        expect(() => verifyJWT(token, secret)).toThrow(jwt.TokenExpiredError);
      });

      it('should throw JsonWebTokenError for an invalid signature', () => {
        const token = generateJWT(payload, secret);
        expect(() => verifyJWT(token, 'wrong-secret')).toThrow(
          jwt.JsonWebTokenError
        );
        expect(() => verifyJWT(token, 'wrong-secret')).toThrow(
          'invalid signature'
        );
      });

      it('should throw JsonWebTokenError for a malformed token', () => {
        const malformedToken = 'not.a.real.token';
        expect(() => verifyJWT(malformedToken, secret)).toThrow(
          jwt.JsonWebTokenError
        );
        expect(() => verifyJWT(malformedToken, secret)).toThrow(
          'jwt malformed'
        );
      });
    });

    describe('decodeJWT', () => {
      it('should decode a token without verification', () => {
        const token = generateJWT(payload, secret);
        const decoded = decodeJWT(token);
        expect(decoded.userId).toBe(payload.userId);
        expect(decoded.role).toBe(payload.role);
      });

      it('should return the full decoded object with header when complete is true', () => {
        const token = generateJWT(payload, secret, { algorithm: 'HS256' });
        const decoded = decodeJWT(token, { complete: true });
        expect(decoded).toHaveProperty('header');
        expect(decoded).toHaveProperty('payload');
        expect(decoded).toHaveProperty('signature');
        expect(decoded.header.alg).toBe('HS256');
        expect(decoded.payload.userId).toBe(payload.userId);
      });

      it('should return null for a malformed token', () => {
        expect(decodeJWT('not.a.valid.token')).toBeNull();
      });

      it('should successfully decode a token even with the wrong secret', () => {
        const token = generateJWT(payload, secret);
        const decoded = decodeJWT(token, 'wrong-secret'); // secret is ignored by decode
        expect(decoded.userId).toBe(payload.userId);
      });
    });
  });
});
