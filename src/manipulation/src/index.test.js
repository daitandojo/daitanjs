// src/manipulation/src/index.test.js
import {
  convertUSDateToUKDate,
  cleanJSONString,
  deepCleanJSON,
  safeParseJSON,
  validateJSON,
  addEscapes,
  escapeObjectStrings,
  truncate,
  toTitleCase,
  isAlpha,
  isAlphanumeric,
  isNumeric,
  reverseString,
} from './index.js';
import { DaitanInvalidInputError, DaitanOperationError } from '@daitanjs/error';

// Mock the logger to prevent console noise during tests
jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    isLevelEnabled: jest.fn().mockReturnValue(true), // Mock as true to test debug logic
  })),
}));

describe('@daitanjs/manipulation', () => {
  describe('Date Utilities', () => {
    describe('convertUSDateToUKDate', () => {
      it('should correctly convert a valid MM/DD/YYYY date to DD/MM/YYYY', () => {
        expect(convertUSDateToUKDate('12/31/2023')).toBe('31/12/2023');
        expect(convertUSDateToUKDate('01/05/2024')).toBe('05/01/2024');
      });

      it('should throw DaitanInvalidInputError for non-string input', () => {
        expect(() => convertUSDateToUKDate(null)).toThrow(
          DaitanInvalidInputError
        );
        expect(() => convertUSDateToUKDate(12345)).toThrow(
          DaitanInvalidInputError
        );
      });

      it('should throw DaitanInvalidInputError for invalid date formats or values', () => {
        expect(() => convertUSDateToUKDate('2023-12-31')).toThrow(
          DaitanInvalidInputError
        );
        expect(() => convertUSDateToUKDate('31/12/2023')).toThrow(
          DaitanInvalidInputError
        ); // Incorrect month/day values
        expect(() => convertUSDateToUKDate('02/30/2024')).toThrow(
          DaitanInvalidInputError
        ); // Invalid calendar date
      });
    });
  });

  describe('JSON Utilities', () => {
    it('cleanJSONString should remove markdown code fences', () => {
      const dirty = '```json\n{"key": "value"}\n```';
      expect(cleanJSONString(dirty)).toBe('{"key": "value"}');
    });

    it('deepCleanJSON should recursively clean string values', () => {
      const dirtyObj = {
        a: '```json\n"clean"```',
        b: { c: '  "trailing comma" , ' },
      };
      const cleaned = deepCleanJSON(dirtyObj);
      expect(cleaned).toEqual({ a: '"clean"', b: { c: '"trailing comma"' } });
    });

    it('safeParseJSON should throw DaitanOperationError for an invalid string', () => {
      const invalid = '{"a": 1,,}';
      expect(() => safeParseJSON(invalid)).toThrow(DaitanOperationError);
      expect(() => safeParseJSON(invalid)).toThrow(
        /JSON parsing failed: JSON Error: Unexpected token/
      );
    });

    it('validateJSON should return a detailed error for invalid JSON', () => {
      const invalid = '{"key": "value",,}';
      const result = validateJSON(invalid);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Context around error');
      expect(result.error).toContain('^');
    });
  });

  describe('String Utilities', () => {
    describe('addEscapes', () => {
      it('should escape backslashes, double quotes, and newlines', () => {
        const str = 'This is a "test" with a \\ backslash and a \n newline.';
        const expected =
          'This is a \\"test\\" with a \\\\ backslash and a \\n newline.';
        expect(addEscapes(str)).toBe(expected);
      });

      it('should throw DaitanInvalidInputError for non-string input', () => {
        expect(() => addEscapes(123)).toThrow(DaitanInvalidInputError);
      });
    });

    describe('escapeObjectStrings', () => {
      it('should recursively escape all string values in an object', () => {
        const obj = { a: 'quote"', b: { c: 'new\nline' }, d: 123, e: null };
        const expected = {
          a: 'quote\\"',
          b: { c: 'new\\nline' },
          d: 123,
          e: null,
        };
        expect(escapeObjectStrings(obj)).toEqual(expected);
      });
    });

    describe('truncate', () => {
      it('should throw DaitanInvalidInputError for non-string input', () => {
        expect(() => truncate(123)).toThrow(DaitanInvalidInputError);
      });

      it('should throw DaitanInvalidInputError for invalid maxLength', () => {
        expect(() => truncate('hello', 'invalid')).toThrow(
          DaitanInvalidInputError
        );
      });
    });

    describe('toTitleCase', () => {
      it('should correctly title-case a string', () => {
        expect(toTitleCase('hello world from daitanjs')).toBe(
          'Hello World From Daitanjs'
        );
      });

      it('should throw DaitanInvalidInputError for non-string input', () => {
        expect(() => toTitleCase({})).toThrow(DaitanInvalidInputError);
      });
    });

    describe('isAlpha, isAlphanumeric, isNumeric', () => {
      it('should correctly identify character types', () => {
        expect(isAlpha('abc')).toBe(true);
        expect(isAlpha('abc1')).toBe(false);
        expect(isAlphanumeric('abc1')).toBe(true);
        expect(isAlphanumeric('abc!')).toBe(false);
        expect(isNumeric('123')).toBe(true);
        expect(isNumeric('123a')).toBe(false);
      });

      it('should throw DaitanInvalidInputError for non-string inputs', () => {
        expect(() => isAlpha(123)).toThrow(DaitanInvalidInputError);
        expect(() => isAlphanumeric(null)).toThrow(DaitanInvalidInputError);
        expect(() => isNumeric(undefined)).toThrow(DaitanInvalidInputError);
      });
    });
  });
});
