// src/data/src/jsonstore/index.test.js
import fs from 'fs';
import fsPromises from 'fs/promises';
import {
  jsonStore,
  jsonQuery,
  jsonExist,
  jsonDelete,
  jsonUpdate,
  readJSONsFromFile,
} from './index.js';
import { DaitanInvalidInputError } from '@daitanjs/error';

// --- Mock Setup ---
jest.mock('fs/promises');
jest.mock('fs');
jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));
jest.mock('@daitanjs/config', () => ({
  getConfigManager: jest.fn(() => ({
    get: jest.fn().mockReturnValue(null),
  })),
}));

describe('jsonstore utilities', () => {
  let mockFileContent = '';
  const mockFilePath = './.test_data/jsonStore.ldjson';

  beforeEach(() => {
    mockFileContent = '';
    jest.clearAllMocks();

    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockClear();
    fs.writeFileSync.mockClear();

    fsPromises.readFile.mockImplementation(async (path) => {
      if (path === mockFilePath) return mockFileContent;
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    });

    fsPromises.appendFile.mockImplementation(async (path, data) => {
      if (path === mockFilePath) {
        mockFileContent += data;
      }
    });

    fsPromises.writeFile.mockImplementation(async (path, data) => {
      if (path === mockFilePath) {
        mockFileContent = data;
      }
    });

    fsPromises.access.mockResolvedValue(undefined);
  });

  const setupInitialContent = (dataArray) => {
    mockFileContent = dataArray.map(JSON.stringify).join('\n') + '\n';
  };

  describe('jsonStore', () => {
    it('should append a JSON object to the file', async () => {
      const obj = { id: 1, name: 'test' };
      await jsonStore({ object: obj, filePath: mockFilePath });
      expect(mockFileContent).toBe(JSON.stringify(obj) + '\n');
    });

    it('should throw DaitanInvalidInputError for non-object input', async () => {
      await expect(
        jsonStore({ object: 'a string', filePath: mockFilePath })
      ).rejects.toThrow(DaitanInvalidInputError);
    });
  });

  describe('jsonQuery', () => {
    beforeEach(() => {
      setupInitialContent([
        { id: 1, type: 'user', score: 10, tags: ['a', 'b'] },
        { id: 2, type: 'post', score: 20, tags: ['b', 'c'] },
        { id: 3, type: 'user', score: 30, tags: ['c', 'd'] },
      ]);
    });

    it('should return all objects matching a simple query', async () => {
      const results = await jsonQuery({
        query: { type: 'user' },
        filePath: mockFilePath,
      });
      expect(results.length).toBe(2);
      expect(results[0].id).toBe(1);
      expect(results[1].id).toBe(3);
    });

    it('should handle an empty query object to return all items', async () => {
      const results = await jsonQuery({ query: {}, filePath: mockFilePath });
      expect(results.length).toBe(3);
    });

    it('should handle advanced query operators like $gt and $in', async () => {
      const results = await jsonQuery({
        query: { score: { $gt: 15 }, tags: { $in: ['c'] } },
        filePath: mockFilePath,
      });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(2);
    });

    it('should handle a filter function', async () => {
      const results = await jsonQuery({
        query: (obj) => obj.score > 25,
        filePath: mockFilePath,
      });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(3);
    });
  });

  describe('jsonExist', () => {
    it('should return true if an object matching the query exists', async () => {
      setupInitialContent([{ id: 1, name: 'exists' }]);
      const exists = await jsonExist({
        query: { name: 'exists' },
        filePath: mockFilePath,
      });
      expect(exists).toBe(true);
    });

    it('should return false if no object matches the query', async () => {
      setupInitialContent([{ id: 1, name: 'exists' }]);
      const exists = await jsonExist({
        query: { name: 'does_not_exist' },
        filePath: mockFilePath,
      });
      expect(exists).toBe(false);
    });
  });

  describe('jsonDelete', () => {
    it('should delete matching objects and rewrite the file', async () => {
      setupInitialContent([
        { id: 1, status: 'active' },
        { id: 2, status: 'inactive' },
        { id: 3, status: 'active' },
      ]);
      const result = await jsonDelete({
        query: { status: 'active' },
        filePath: mockFilePath,
      });
      expect(result.deletedCount).toBe(2);
      const remainingData = await readJSONsFromFile({ filePath: mockFilePath });
      expect(remainingData.length).toBe(1);
      expect(remainingData[0].id).toBe(2);
    });
  });

  describe('jsonUpdate', () => {
    it('should update matching objects with a provided object', async () => {
      setupInitialContent([
        { id: 1, status: 'pending', user: 'A' },
        { id: 2, status: 'active', user: 'B' },
        { id: 3, status: 'pending', user: 'C' },
      ]);
      const result = await jsonUpdate({
        query: { status: 'pending' },
        updates: { status: 'approved', approvedBy: 'admin' },
        filePath: mockFilePath,
      });

      expect(result.updatedCount).toBe(2);
      const updatedData = await readJSONsFromFile({ filePath: mockFilePath });
      expect(updatedData.find((d) => d.id === 1).status).toBe('approved');
      expect(updatedData.find((d) => d.id === 3).status).toBe('approved');
      expect(updatedData.find((d) => d.id === 1).approvedBy).toBe('admin');
      expect(updatedData.find((d) => d.id === 2).status).toBe('active');
    });

    it('should update matching objects using a provided function', async () => {
      setupInitialContent([
        { id: 1, count: 5 },
        { id: 2, count: 10 },
      ]);
      const result = await jsonUpdate({
        query: { id: 2 },
        updates: (obj) => ({ ...obj, count: obj.count + 1 }),
        filePath: mockFilePath,
      });

      expect(result.updatedCount).toBe(1);
      const updatedData = await readJSONsFromFile({ filePath: mockFilePath });
      expect(updatedData.find((d) => d.id === 2).count).toBe(11);
      expect(updatedData.find((d) => d.id === 1).count).toBe(5);
    });
  });
});
