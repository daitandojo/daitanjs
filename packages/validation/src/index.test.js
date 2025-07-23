// src/validation/src/index.test.js
import {
  isEmail,
  isPassword,
  isCreditCard,
  isValidJSON,
  isPhone,
  isName,
  isURL,
  isDate,
  isIP,
} from './index.js';
import { DaitanInvalidInputError } from '@daitanjs/error';

// We don't need to mock dependencies here because this package's functions
// are mostly pure or rely on other DaitanJS packages that we will test independently.
// The one exception is `cleanJSONString` from `@daitanjs/manipulation`, but we can
// test `isValidJSON` by providing strings that would or would not need cleaning.

describe('@daitanjs/validation', () => {
  describe('isEmail', () => {
    test('should return true for valid email addresses', () => {
      expect(isEmail('test@example.com')).toBe(true);
      expect(isEmail('test.name+alias@example.co.uk')).toBe(true);
    });

    test('should return false for invalid email addresses', () => {
      expect(isEmail('plainaddress')).toBe(false);
      expect(isEmail('@example.com')).toBe(false);
      expect(isEmail('test@.com')).toBe(false);
      expect(isEmail('test@domain..com')).toBe(false);
    });

    test('should return false for non-string inputs', () => {
      expect(isEmail(null)).toBe(false);
      expect(isEmail(123)).toBe(false);
    });
  });

  describe('isPhone', () => {
    test('should return true for valid phone number formats', () => {
      expect(isPhone('+1 (555) 123-4567')).toBe(true);
      expect(isPhone('555-123-4567')).toBe(true);
      expect(isPhone('5551234567')).toBe(true);
    });

    test('should return false for invalid phone number formats', () => {
      expect(isPhone('123')).toBe(false); // Too short
      expect(isPhone('555 123 4567 ext 123')).toBe(false); // Contains non-allowed characters
      expect(isPhone('not-a-phone-number')).toBe(false);
    });
  });

  describe('isName', () => {
    test('should return true for a valid name with default options', () => {
      expect(isName('John Doe')).toBe(true);
    });

    test('should return false for a name that is too short or too long', () => {
      expect(isName('J')).toBe(false);
      expect(isName('J'.repeat(101))).toBe(false);
    });

    test('should validate against a custom regex', () => {
      const options = { allowedCharsRegex: /^[a-zA-Z\s]+$/ };
      expect(isName('John Doe', options)).toBe(true);
      expect(isName('John Doe 123', options)).toBe(false);
    });
  });

  describe('isPassword', () => {
    test('should return true for a password that meets default requirements', () => {
      expect(isPassword('Password123!')).toBe(true);
    });

    test('should return false if missing a component', () => {
      expect(isPassword('password123!')).toBe(false); // Missing uppercase
      expect(isPassword('PASSWORD123!')).toBe(false); // Missing lowercase
      expect(isPassword('Password!')).toBe(false); // Missing number
      expect(isPassword('Password123')).toBe(false); // Missing special char
    });

    test('should validate correctly with custom options', () => {
      const options = { minLength: 10, requireSpecialChar: false };
      expect(isPassword('Password1234', options)).toBe(true);
      expect(isPassword('Pass1234', options)).toBe(false); // Too short
    });
  });

  describe('isURL', () => {
    it('should return true for valid URLs', () => {
      expect(isURL('https://example.com')).toBe(true);
      expect(isURL('http://localhost:3000/path')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isURL('example.com')).toBe(false);
      expect(isURL('htp://example.com')).toBe(false);
    });
  });

  describe('isDate', () => {
    it('should return true for valid YYYY-MM-DD dates', () => {
      expect(isDate('2023-12-31')).toBe(true);
      expect(isDate('2024-02-29')).toBe(true); // Leap year
    });

    it('should return false for invalid date formats or calendar dates', () => {
      expect(isDate('31-12-2023')).toBe(false); // Wrong format
      expect(isDate('2023/12/31')).toBe(false); // Wrong format
      expect(isDate('2023-13-01')).toBe(false); // Invalid month
      expect(isDate('2023-11-31')).toBe(false); // Invalid day for month
      expect(isDate('2023-02-29')).toBe(false); // Not a leap year
    });
  });

  describe('isIP', () => {
    it('should return true for valid IPv4 addresses', () => {
      expect(isIP('192.168.1.1')).toBe(true);
      expect(isIP('127.0.0.1')).toBe(true);
      expect(isIP('255.255.255.255')).toBe(true);
    });

    it('should return false for invalid IPv4 addresses', () => {
      expect(isIP('256.0.0.1')).toBe(false);
      expect(isIP('192.168.1')).toBe(false);
      expect(isIP('192.168.1.1.1')).toBe(false);
      expect(isIP('not-an-ip')).toBe(false);
    });
  });

  describe('isCreditCard', () => {
    test('should return true for valid credit card numbers (Luhn check)', () => {
      expect(isCreditCard('49927398716')).toBe(true);
      expect(isCreditCard('5412 3456 7890 1234')).toBe(true);
    });

    test('should return false for invalid credit card numbers', () => {
      expect(isCreditCard('49927398717')).toBe(false);
      expect(isCreditCard('123456')).toBe(false);
    });
  });

  describe('isValidJSON', () => {
    it('should return true for a valid JSON string', () => {
      const result = isValidJSON('{"a": 1, "b": "test"}');
      expect(result.isValid).toBe(true);
      expect(result.parsedJson).toEqual({ a: 1, b: 'test' });
      expect(result.error).toBeNull();
    });

    it('should return false for an invalid JSON string', () => {
      const result = isValidJSON('{"a": 1, "b": "test",}'); // Trailing comma
      expect(result.isValid).toBe(false);
      expect(result.parsedJson).toBeNull();
      expect(result.error).toContain('JSON Error:');
      expect(result.error).toContain('Hint: Detected a trailing comma');
    });

    it('should clean a dirty JSON string and parse it successfully when attemptClean is true', () => {
      const dirtyJson = '```json\n{ "key": "value" } // a comment\n```';
      const result = isValidJSON(dirtyJson, { attemptClean: true });
      expect(result.isValid).toBe(true);
      expect(result.parsedJson).toEqual({ key: 'value' });
    });

    it('should fail to parse a dirty JSON string when attemptClean is false', () => {
      const dirtyJson = '```json\n{ "key": "value" }\n```';
      const result = isValidJSON(dirtyJson, { attemptClean: false });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Unexpected token '`'");
    });

    it('should provide detailed context on parsing failure', () => {
      const badJson = '{"key": "value", "badKey" "anotherValue"}';
      const result = isValidJSON(badJson);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Context around error');
      expect(result.error).toContain('"badKey" ^ "anotherValue"'); // Shows where the error is
    });
  });
});
