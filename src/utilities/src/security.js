// src/utilities/src/security.js (version 1.01)
import crypto from 'crypto';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanValidationError,
} from '@daitanjs/error';

const securityLogger = getLogger('daitan-utilities-security');

class SecurityManager {
  constructor() {
    this.configManager = getConfigManager();
    this.algorithm = 'aes-256-gcm';
    this.keyDerivationIterations = 100000;
  }

  generateSecureKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  hashPassword(password, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(32).toString('hex');
    }

    const hash = crypto.pbkdf2Sync(
      password,
      salt,
      this.keyDerivationIterations,
      64,
      'sha512'
    );

    return {
      hash: hash.toString('hex'),
      salt,
    };
  }

  verifyPassword(password, storedHash, salt) {
    const hash = crypto.pbkdf2Sync(
      password,
      salt,
      this.keyDerivationIterations,
      64,
      'sha512'
    );

    return crypto.timingSafeEqual(
      Buffer.from(hash.toString('hex'), 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  }

  encrypt(text, key = null) {
    if (!key) {
      key = this.configManager.get('ENCRYPTION_KEY');
      if (!key) {
        throw new DaitanConfigurationError('ENCRYPTION_KEY not configured');
      }
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, key);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      iv: iv.toString('hex'),
      encrypted,
      authTag: cipher.getAuthTag ? cipher.getAuthTag().toString('hex') : null,
    };
  }

  decrypt(encryptedData, key = null) {
    if (!key) {
      key = this.configManager.get('ENCRYPTION_KEY');
      if (!key) {
        throw new DaitanConfigurationError('ENCRYPTION_KEY not configured');
      }
    }

    const decipher = crypto.createDecipher(this.algorithm, key);

    if (encryptedData.authTag && decipher.setAuthTag) {
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    }

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  generateJWT(payload, options = {}) {
    const secret = this.configManager.get('JWT_SECRET');
    if (!secret) {
      throw new DaitanConfigurationError('JWT_SECRET not configured');
    }

    const defaults = {
      expiresIn: '1h',
      issuer: 'daitanjs',
      audience: 'daitanjs-users',
    };

    const jwtOptions = { ...defaults, ...options };

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iat: now,
      exp: now + this.parseDuration(jwtOptions.expiresIn),
      iss: jwtOptions.issuer,
      aud: jwtOptions.audience,
      ...payload,
    };

    const headerEncoded = Buffer.from(JSON.stringify(header)).toString(
      'base64url'
    );
    const claimsEncoded = Buffer.from(JSON.stringify(claims)).toString(
      'base64url'
    );

    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${headerEncoded}.${claimsEncoded}`)
      .digest('base64url');

    return `${headerEncoded}.${claimsEncoded}.${signature}`;
  }

  verifyJWT(token) {
    const secret = this.configManager.get('JWT_SECRET');
    if (!secret) {
      throw new DaitanConfigurationError('JWT_SECRET not configured');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new DaitanValidationError('Invalid JWT format');
    }

    const [headerEncoded, claimsEncoded, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${headerEncoded}.${claimsEncoded}`)
      .digest('base64url');

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature, 'base64url'),
        Buffer.from(expectedSignature, 'base64url')
      )
    ) {
      throw new DaitanValidationError('Invalid JWT signature');
    }

    const claims = JSON.parse(
      Buffer.from(claimsEncoded, 'base64url').toString()
    );

    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
      throw new DaitanValidationError('JWT expired');
    }

    return claims;
  }

  parseDuration(duration) {
    if (typeof duration === 'number') return duration;

    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new DaitanValidationError('Invalid duration format');
    }

    const [, amount, unit] = match;
    const multipliers = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return parseInt(amount) * multipliers[unit];
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  validateCSRFToken(token, sessionToken) {
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(sessionToken, 'hex')
    );
  }

  rateLimit(key, limit = 100, window = 60000) {
    const now = Date.now();
    const windowStart = now - window;

    if (!this.rateLimitStore) {
      this.rateLimitStore = new Map();
    }

    if (!this.rateLimitStore.has(key)) {
      this.rateLimitStore.set(key, []);
    }

    const attempts = this.rateLimitStore.get(key);
    const validAttempts = attempts.filter((time) => time > windowStart);

    if (validAttempts.length >= limit) {
      return false;
    }

    validAttempts.push(now);
    this.rateLimitStore.set(key, validAttempts);

    return true;
  }
}

const securityManager = new SecurityManager();

export const {
  generateSecureKey,
  hashPassword,
  verifyPassword,
  encrypt,
  decrypt,
  generateJWT,
  verifyJWT,
  sanitizeInput,
  generateCSRFToken,
  validateCSRFToken,
  rateLimit,
} = securityManager;

export default securityManager;
