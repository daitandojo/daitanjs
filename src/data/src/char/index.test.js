// src/data/src/char/index.test.js
import fs from 'fs';
import fsPromises from 'fs/promises';
import {
  charSet,
  charGet,
  charDel,
  charCount,
  charClearAll,
  charBackup,
} from './index.js';
import { DaitanInvalidInputError } from '@daitanjs/error';

// Mock the file system modules
jest.mock('fs/promises');
jest.mock('fs');

// Mock the logger to prevent console noise
jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock config manager to control the default path
jest.mock('@daitanjs/config', () => ({
  getConfigManager: jest.fn(() => ({
    get: jest.fn().mockReturnValue(null), // Default to no configured path
  })),
}));

describe('char store utilities', () => {
  let mockFileContent = '';

  beforeEach(() => {
    // Reset mock state before each test
    mockFileContent = '';
    jest.clearAllMocks();

    // Mock implementation for readFile
    fsPromises.readFile.mockImplementation(async () => {
      return mockFileContent;
    });

    // Mock implementation for writeFile
    fsPromises.writeFile.mockImplementation(async (path, data) => {
      mockFileContent = data;
      return Promise.resolve();
    });

    // Mock implementation for copyFile
    fsPromises.copyFile.mockImplementation(async (src, dest) => {
      // In a mock, we don't actually create a new file, just acknowledge the call
      return Promise.resolve();
    });

    // Mock implementation for fs.existsSync to control file presence
    fs.existsSync.mockReturnValue(true);

    // Mock implementation for fsPromises.access to control presence checks
    fsPromises.access.mockResolvedValue(undefined);
  });

  const testKey = ['user', '123', 'profile'];
  const testValue = '{"name":"John Doe","email":"john@example.com"}';
  const testRecord =
    'user:123:profile={"name":"John Doe","email":"john@example.com"}';

  describe('charSet', () => {
    it('should add a new record to an empty file', async () => {
      await charSet({ keyArray: testKey, value: testValue });
      expect(mockFileContent).toBe(testRecord);
    });

    it('should add a new record to a file with existing content', async () => {
      mockFileContent = 'existing:key=existing_value';
      await charSet({ keyArray: testKey, value: testValue });
      expect(mockFileContent).toBe(
        `existing:key=existing_value\n${testRecord}`
      );
    });

    it('should update an existing record', async () => {
      mockFileContent = testRecord;
      const updatedValue =
        '{"name":"Johnathan Doe","email":"john@example.com"}';
      const updatedRecord =
        'user:123:profile={"name":"Johnathan Doe","email":"john@example.com"}';

      await charSet({ keyArray: testKey, value: updatedValue });
      expect(mockFileContent).toBe(updatedRecord);
    });

    it('should throw DaitanInvalidInputError for invalid key or value', async () => {
      await expect(
        charSet({ keyArray: ['invalid:key'], value: 'value' })
      ).rejects.toThrow(DaitanInvalidInputError);
      await expect(
        charSet({ keyArray: ['valid-key'], value: 123 })
      ).rejects.toThrow(DaitanInvalidInputError);
      await expect(charSet({ keyArray: [], value: 'value' })).rejects.toThrow(
        DaitanInvalidInputError
      );
    });
  });

  describe('charGet', () => {
    it('should retrieve the correct value for an existing key', async () => {
      mockFileContent = `other:key=other_value\n${testRecord}\nanother:key=another_value`;
      const value = await charGet({ keyArray: testKey });
      expect(value).toBe(testValue);
    });

    it('should return null for a non-existent key', async () => {
      mockFileContent = 'other:key=other_value';
      const value = await charGet({ keyArray: testKey });
      expect(value).toBeNull();
    });

    it('should return null for an empty file', async () => {
      mockFileContent = '';
      const value = await charGet({ keyArray: testKey });
      expect(value).toBeNull();
    });
  });

  describe('charDel', () => {
    it('should delete an existing record and return true', async () => {
      mockFileContent = `first:record=1\n${testRecord}\nthird:record=3`;
      const result = await charDel({ keyArray: testKey });
      expect(result).toBe(true);
      expect(mockFileContent).toBe('first:record=1\nthird:record=3');
    });

    it('should not change the file and return false for a non-existent key', async () => {
      const originalContent = 'first:record=1\nthird:record=3';
      mockFileContent = originalContent;
      const result = await charDel({ keyArray: testKey });
      expect(result).toBe(false);
      expect(mockFileContent).toBe(originalContent);
    });
  });

  describe('charCount', () => {
    it('should return the correct number of records', async () => {
      mockFileContent = `one=1\ntwo=2\nthree=3`;
      const count = await charCount();
      expect(count).toBe(3);
    });

    it('should return 0 for an empty file', async () => {
      mockFileContent = ``;
      const count = await charCount();
      expect(count).toBe(0);
    });
  });

  describe('charClearAll', () => {
    it('should clear all content from the file', async () => {
      mockFileContent = `one=1\ntwo=2\nthree=3`;
      await charClearAll();
      expect(mockFileContent).toBe('');
    });
  });

  describe('charBackup', () => {
    it('should call copyFile with a timestamped backup path', async () => {
      await charBackup({ filePath: './charStore.txt' });
      expect(fsPromises.copyFile).toHaveBeenCalledTimes(1);
      const [source, destination] = fsPromises.copyFile.mock.calls[0];
      expect(source).toBe('./charStore.txt');
      expect(destination).toMatch(
        /charStore.txt.bak.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/
      );
    });

    it('should throw an error if the source file does not exist', async () => {
      const enoentError = new Error('File not found');
      enoentError.code = 'ENOENT';
      fsPromises.copyFile.mockRejectedValue(enoentError);
      await expect(
        charBackup({ filePath: './nonexistent.txt' })
      ).rejects.toThrow(/Source file not found/);
    });
  });
});
