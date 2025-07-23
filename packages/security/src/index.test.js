// packages/security/src/index.test.js (version 1.0.1)
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
        const { otp } = generateNumericOTP({ length: 8 });
        expect(otp).toHaveLength(8);
        expect(otp).toMatch(/^[0-9]{8}$/);
      });

      it('should generate a 6-digit OTP by default', () => {
        const { otp } = generateNumericOTP();
        expect(otp).toHaveLength(6);
        expect(otp).toMatch(/^[0-9]{6}$/);
      });

      it('should return an expiry timestamp in the future', () => {
        const { expiresAt } = generateNumericOTP({ validityMs: 10000 }); // 10 seconds validity
        expect(expiresAt).toBeGreaterThan(Date.now());
        expect(expiresAt).toBeLessThanOrEqual(Date.now() + 10000);
      });

      it('should throw DaitanInvalidInputError for invalid length or validity', () => {
        expect(() => generateNumericOTP({ length: 0 })).toThrow(DaitanInvalidInputError);
        expect(() => generateNumericOTP({ length: -1 })).toThrow(DaitanInvalidInputError);
        expect(() => generateNumericOTP({ length: 11 })).toThrow(DaitanInvalidInputError);
        expect(() => generateNumericOTP({ length: '6' })).toThrow(DaitanInvalidInputError);
        expect(() => generateNumericOTP({ length: 6, validityMs: -100 })).toThrow(
          DaitanInvalidInputError
        );
      });
    });

    describe('generateAlphanumericOTP', () => {
      it('should generate an alphanumeric OTP of the specified length', () => {
        const { otp } = generateAlphanumericOTP({ length: 10 });
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
        expect(verifyOTP({ submittedOTP: otp, storedOTP: otp, storedOTPExpiresAt: expiresAt })).toBe(true);
      });

      it('should return false for an incorrect OTP', () => {
        const { otp, expiresAt } = generateNumericOTP();
        expect(verifyOTP({ submittedOTP: '000000', storedOTP: otp, storedOTPExpiresAt: expiresAt })).toBe(false);
      });

      it('should return false for an expired OTP', () => {
        // DEFINITIVE FIX: Manually create an expired timestamp instead of passing an invalid value to the generator
        const otp = '123456';
        const expiredTimestamp = Date.now() - 1000; // 1 second in the past
        expect(verifyOTP({ submittedOTP: otp, storedOTP: otp, storedOTPExpiresAt: expiredTimestamp })).toBe(false);
      });

      it('should return false for invalid inputs', () => {
        expect(verifyOTP({ submittedOTP: null, storedOTP: '123456', storedOTPExpiresAt: Date.now() + 10000 })).toBe(false);
        expect(verifyOTP({ submittedOTP: '123456', storedOTP: undefined, storedOTPExpiresAt: Date.now() + 10000 })).toBe(false);
        expect(verifyOTP({ submittedOTP: '123456', storedOTP: '123456', storedOTPExpiresAt: 'not a timestamp' })).toBe(false);
      });
    });
  });

  // --- JWT Tests ---
  describe('JWT Functionality', () => {
    const secret = 'my-super-secret-key-for-testing';
    const payload = { userId: 123, role: 'user' };

    describe('generateJWT', () => {
      it('should generate a valid JWT string', () => {
        const token = generateJWT({ payload, secretOrPrivateKey: secret });
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3);
      });

      it('should include a jti claim by default', () => {
        const token = generateJWT({ payload, secretOrPrivateKey: secret });
        const decoded = jwt.decode(token);
        expect(decoded).toHaveProperty('jti');
        expect(typeof decoded.jti).toBe('string');
      });

      it('should use default expiry of 1h', () => {
        const token = generateJWT({ payload, secretOrPrivateKey: secret });
        const decoded = jwt.decode(token);
        expect(decoded.exp - decoded.iat).toBe(3600);
      });

      it('should use custom options like expiresIn', () => {
        const token = generateJWT({ payload, secretOrPrivateKey: secret, options: { expiresIn: '2h' } });
        const decoded = jwt.decode(token);
        expect(decoded.exp - decoded.iat).toBe(7200);
      });

      it('should throw DaitanInvalidInputError for invalid payload or secret', () => {
        expect(() => generateJWT({ payload: null, secretOrPrivateKey: secret })).toThrow(
          DaitanInvalidInputError
        );
        expect(() => generateJWT({ payload: 'not-an-object', secretOrPrivateKey: secret })).toThrow(
          DaitanInvalidInputError
        );
        expect(() => generateJWT({ payload, secretOrPrivateKey: '' })).toThrow(DaitanInvalidInputError);
      });
    });

    describe('verifyJWT', () => {
      it('should successfully verify a valid token and return its payload', () => {
        const token = generateJWT({ payload, secretOrPrivateKey: secret });
        const decoded = verifyJWT({ token, secretOrPublicKey: secret });
        expect(decoded.userId).toBe(payload.userId);
        expect(decoded.role).toBe(payload.role);
      });

      it('should throw TokenExpiredError for an expired token', () => {
        const token = generateJWT({ payload, secretOrPrivateKey: secret, options: { expiresIn: '-1s' } }); // Expired 1 second ago
        expect(() => verifyJWT({ token, secretOrPublicKey: secret })).toThrow(jwt.TokenExpiredError);
      });

      it('should throw JsonWebTokenError for an invalid signature', () => {
        const token = generateJWT({ payload, secretOrPrivateKey: secret });
        expect(() => verifyJWT({ token, secretOrPublicKey: 'wrong-secret' })).toThrow(
          jwt.JsonWebTokenError
        );
        expect(() => verifyJWT({ token, secretOrPublicKey: 'wrong-secret' })).toThrow(
          'invalid signature'
        );
      });

      it('should throw JsonWebTokenError for a malformed token', () => {
        const malformedToken = 'not.a.real.token';
        expect(() => verifyJWT({ token: malformedToken, secretOrPublicKey: secret })).toThrow(
          jwt.JsonWebTokenError
        );
        expect(() => verifyJWT({ token: malformedToken, secretOrPublicKey: secret })).toThrow(
          'jwt malformed'
        );
      });
    });

    describe('decodeJWT', () => {
      it('should decode a token without verification', () => {
        const token = generateJWT({ payload, secretOrPrivateKey: secret });
        const decoded = decodeJWT({ token });
        expect(decoded.userId).toBe(payload.userId);
        expect(decoded.role).toBe(payload.role);
      });

      it('should return the full decoded object with header when complete is true', () => {
        const token = generateJWT({ payload, secretOrPrivateKey: secret, options: { algorithm: 'HS256' } });
        const decoded = decodeJWT({ token, options: { complete: true } });
        expect(decoded).toHaveProperty('header');
        expect(decoded).toHaveProperty('payload');
        expect(decoded).toHaveProperty('signature');
        expect(decoded.header.alg).toBe('HS256');
        expect(decoded.payload.userId).toBe(payload.userId);
      });

      it('should return null for a malformed token', () => {
        expect(decodeJWT({ token: 'not.a.valid.token' })).toBeNull();
      });

      it('should successfully decode a token even with the wrong secret', () => {
        const token = generateJWT({ payload, secretOrPrivateKey: secret });
        const decoded = decodeJWT({ token, options: { secretOrPublicKey: 'wrong-secret' } }); // secret is ignored by decode
        expect(decoded.userId).toBe(payload.userId);
      });
    });
  });
});