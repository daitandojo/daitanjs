// src/data/src/caching/index.test.js
import CacheManager from './index.js';
import { DaitanInvalidInputError } from '@daitanjs/error';

// Mock the logger
jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    isLevelEnabled: jest.fn().mockReturnValue(false),
  })),
}));

describe('CacheManager', () => {
  // Use fake timers for all tests in this suite to control time-based logic.
  jest.useFakeTimers();

  let cache;

  beforeEach(() => {
    // Create a new cache instance for each test to ensure isolation
    cache = new CacheManager({ stdTTL: 60 });
  });

  afterEach(() => {
    // Clean up the cache after each test
    cache.close();
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      expect(cache.nodeCacheOptions.useClones).toBe(true);
      expect(cache.nodeCacheOptions.stdTTL).toBe(60);
    });

    it('should override default options with user-provided options', () => {
      const customCache = new CacheManager({ stdTTL: 120, useClones: false });
      expect(customCache.nodeCacheOptions.stdTTL).toBe(120);
      expect(customCache.nodeCacheOptions.useClones).toBe(false);
      customCache.close();
    });
  });

  describe('generateKey', () => {
    it('should generate a consistent key for the same inputs', () => {
      const key1 = cache.generateKey('prefix', 'arg1', 123, { a: 1, b: 2 });
      const key2 = cache.generateKey('prefix', 'arg1', 123, { a: 1, b: 2 });
      expect(key1).toBe(key2);
      expect(key1).toContain('prefix:');
    });

    it('should generate a different key for different inputs', () => {
      const key1 = cache.generateKey('prefix', 'arg1');
      const key2 = cache.generateKey('prefix', 'arg2');
      expect(key1).not.toBe(key2);
    });

    it('should handle object arguments with different key orders consistently', () => {
      const key1 = cache.generateKey('prefix', { b: 2, a: 1 });
      const key2 = cache.generateKey('prefix', { a: 1, b: 2 });
      expect(key1).toBe(key2);
    });

    it('should throw DaitanInvalidInputError for an invalid prefix', () => {
      expect(() => cache.generateKey(null, 'arg1')).toThrow(
        DaitanInvalidInputError
      );
      expect(() => cache.generateKey(' ', 'arg1')).toThrow(
        DaitanInvalidInputError
      );
    });
  });

  describe('set, get, and del', () => {
    it('should set and get a value correctly', () => {
      const key = 'test_key';
      const value = { data: 'some data' };
      cache.set(key, value);
      const retrieved = cache.get(key);
      expect(retrieved).toEqual(value);
      if (cache.nodeCacheOptions.useClones) {
        expect(retrieved).not.toBe(value);
      }
    });

    it('should not cache an undefined value', () => {
      const key = 'undefined_key';
      const result = cache.set(key, undefined);
      expect(result).toBe(false);
      expect(cache.get(key)).toBeUndefined();
    });

    it('should return undefined for a non-existent key', () => {
      expect(cache.get('non_existent_key')).toBeUndefined();
    });

    it('should delete a key correctly', () => {
      const key = 'to_delete';
      cache.set(key, 'some value');
      expect(cache.get(key)).toBe('some value');
      const deletedCount = cache.del(key);
      expect(deletedCount).toBe(1);
      expect(cache.get(key)).toBeUndefined();
    });

    it('should delete multiple keys correctly', () => {
      cache.set('key1', 1);
      cache.set('key2', 2);
      const deletedCount = cache.del(['key1', 'key2']);
      expect(deletedCount).toBe(2);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should throw DaitanInvalidInputError for invalid keys', () => {
      expect(() => cache.set(null, 'value')).toThrow(DaitanInvalidInputError);
      expect(() => cache.get('')).toThrow(DaitanInvalidInputError);
      expect(() => cache.del([])).toThrow(DaitanInvalidInputError);
    });
  });

  describe('wrap', () => {
    it('should cache the result of an async function', async () => {
      const myAsyncFunction = jest.fn(async (arg) => `result for ${arg}`);
      const wrappedFunction = cache.wrap(myAsyncFunction, {
        prefix: 'my_func',
      });

      const result1 = await wrappedFunction('input1');
      expect(result1).toBe('result for input1');
      expect(myAsyncFunction).toHaveBeenCalledTimes(1);

      const result2 = await wrappedFunction('input1');
      expect(result2).toBe('result for input1');
      expect(myAsyncFunction).toHaveBeenCalledTimes(1);

      const result3 = await wrappedFunction('input2');
      expect(result3).toBe('result for input2');
      expect(myAsyncFunction).toHaveBeenCalledTimes(2);
    });

    it('should throw DaitanInvalidInputError for invalid function or prefix', () => {
      expect(() => cache.wrap('not a function', { prefix: 'p' })).toThrow(
        DaitanInvalidInputError
      );
      expect(() => cache.wrap(async () => {}, { prefix: '' })).toThrow(
        DaitanInvalidInputError
      );
    });
  });

  describe('invalidateByPrefix', () => {
    it('should invalidate all keys starting with a given prefix', () => {
      const key1 = cache.generateKey('api:users', 1);
      const key2 = cache.generateKey('api:users', 2);
      const key3 = cache.generateKey('api:products', 1);

      cache.set(key1, 'user 1');
      cache.set(key2, 'user 2');
      cache.set(key3, 'product 1');

      const invalidatedCount = cache.invalidateByPrefix('api:users');

      expect(invalidatedCount).toBe(2);
      expect(cache.get(key1)).toBeUndefined();
      expect(cache.get(key2)).toBeUndefined();
      expect(cache.get(key3)).toBe('product 1');
    });

    it('should return 0 if no keys match the prefix', () => {
      expect(cache.invalidateByPrefix('non_existent_prefix')).toBe(0);
    });
  });

  describe('TTL (Time-To-Live)', () => {
    it('should expire a key after the specified TTL', () => {
      const ttlCache = new CacheManager({ stdTTL: 10 });
      ttlCache.set('ttl_key', 'temporary value', 2); // 2 second TTL

      expect(ttlCache.get('ttl_key')).toBe('temporary value');

      // Advance time by 3 seconds
      jest.advanceTimersByTime(3000);

      expect(ttlCache.get('ttl_key')).toBeUndefined();
      ttlCache.close();
    });

    it('should use the default TTL if no specific TTL is provided', () => {
      const ttlCache = new CacheManager({ stdTTL: 5 }); // 5 second default TTL
      ttlCache.set('default_ttl_key', 'some value');

      jest.advanceTimersByTime(4000);
      expect(ttlCache.get('default_ttl_key')).toBe('some value');

      jest.advanceTimersByTime(2000); // Total 6 seconds passed
      expect(ttlCache.get('default_ttl_key')).toBeUndefined();

      ttlCache.close();
    });
  });
});
