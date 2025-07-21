// src/data/src/csv/csvsql.test.js
import fs from 'fs/promises';
import { CSVSQL } from './csvsql.js'; // The refactored file now exports the class as a named export
import {
  DaitanInvalidInputError,
  DaitanFileOperationError,
  DaitanConfigurationError,
} from '@daitanjs/error';
import path from 'path'; // Import path for test file paths

// --- Mock Setup ---
jest.mock('fs/promises');
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
    get: jest.fn().mockImplementation((key, defaultValue) => {
      if (key === 'CSV_SQL_DIRECTORY') return './.test_csv_sql_data';
      return defaultValue;
    }),
  })),
}));

describe('CSVSQL', () => {
  let mockFsStorage = {};

  beforeEach(() => {
    mockFsStorage = {};
    jest.clearAllMocks();

    fs.readFile.mockImplementation(async (filePath) => {
      const normalizedPath = filePath.toString();
      if (mockFsStorage[normalizedPath]) {
        return mockFsStorage[normalizedPath];
      }
      const error = new Error(
        `ENOENT: no such file or directory, open '${normalizedPath}'`
      );
      error.code = 'ENOENT';
      throw error;
    });

    fs.writeFile.mockImplementation(async (filePath, data) => {
      mockFsStorage[filePath.toString()] = data;
    });

    fs.unlink.mockImplementation(async (filePath) => {
      const normalizedPath = filePath.toString();
      if (mockFsStorage[normalizedPath]) {
        delete mockFsStorage[normalizedPath];
      } else {
        const error = new Error(
          `ENOENT: no such file or directory, unlink '${normalizedPath}'`
        );
        error.code = 'ENOENT';
        throw error;
      }
    });

    fs.access.mockImplementation(async (filePath) => {
      if (!mockFsStorage[filePath.toString()]) {
        const error = new Error(
          `ENOENT: no such file or directory, access '${filePath}'`
        );
        error.code = 'ENOENT';
        throw error;
      }
    });

    fs.mkdir.mockResolvedValue();

    fs.readdir.mockImplementation(async (dirPath) => {
      const normalizedDirPath = dirPath.toString();
      return Object.keys(mockFsStorage)
        .filter((p) => p.startsWith(normalizedDirPath))
        .map((p) => path.basename(p));
    });
  });

  const getCsvSqlInstance = () => new CSVSQL(undefined, { verbose: false });

  describe('Table Management', () => {
    it('should create a new table with headers', async () => {
      const csvSql = getCsvSqlInstance();
      const tableName = 'test_table';
      const headers = ['id', 'name'];
      await csvSql.createTable({ tableName, headers });

      const filePath = csvSql._getTablePath(tableName);
      expect(mockFsStorage[filePath]).toBe('id,name\n'); // csv-stringify will add the newline
    });

    it('should throw an error if trying to create a table that already exists', async () => {
      const csvSql = getCsvSqlInstance();
      const tableName = 'existing_table';
      const headers = ['id', 'name'];
      mockFsStorage[csvSql._getTablePath(tableName)] =
        '"id","name"\n"1","test"';

      await expect(csvSql.createTable({ tableName, headers })).rejects.toThrow(
        DaitanFileOperationError
      );
    });

    it('should load an existing table into memory', async () => {
      const csvSql = getCsvSqlInstance();
      const tableName = 'people';
      const filePath = csvSql._getTablePath(tableName);
      mockFsStorage[filePath] = 'id,name,age\n1,Alice,30\n2,Bob,25';

      await csvSql.loadTable({ tableName });
      const info = csvSql.getTableInfo({ tableName });

      expect(info.rowCount).toBe(2);
      expect(info.headers).toEqual(['id', 'name', 'age']);
      expect(csvSql.tablesInMemory[tableName].data[0]).toEqual({
        id: '1',
        name: 'Alice',
        age: '30',
      });
    });

    it('should save in-memory data to a CSV file', async () => {
      const csvSql = getCsvSqlInstance();
      const tableName = 'new_people';

      const dataToSave = [
        { id: 10, name: 'Charlie', role: 'dev' },
        { id: 11, name: 'Dana', role: 'qa' },
      ];
      await csvSql.saveTable({ tableName, dataToSave });

      const filePath = csvSql._getTablePath(tableName);
      const expectedCsv = 'id,name,role\n10,Charlie,dev\n11,Dana,qa\n';
      expect(mockFsStorage[filePath]).toBe(expectedCsv);
      expect(csvSql.tablesInMemory[tableName].isDirty).toBe(false);
    });

    it('should delete a table file and remove it from memory', async () => {
      const csvSql = getCsvSqlInstance();
      const tableName = 'to_delete';
      const filePath = csvSql._getTablePath(tableName);
      mockFsStorage[filePath] = 'a,b\n1,2';
      await csvSql.loadTable({ tableName });

      expect(csvSql.tablesInMemory[tableName]).toBeDefined();
      await csvSql.deleteTable({ tableName });
      expect(mockFsStorage[filePath]).toBeUndefined();
      expect(csvSql.tablesInMemory[tableName]).toBeUndefined();
    });
  });

  describe('Query Engine', () => {
    let csvSql;
    beforeEach(async () => {
      csvSql = getCsvSqlInstance();
      const peopleCsv =
        'id,name,age,city\n1,Alice,30,New York\n2,Bob,25,Chicago\n3,Charlie,30,New York';
      mockFsStorage[csvSql._getTablePath('people')] = peopleCsv;
      await csvSql.loadTable({ tableName: 'people' });
    });

    it('should execute a SELECT * query', async () => {
      const results = await csvSql.query('SELECT * FROM people');
      expect(results.length).toBe(3);
    });

    it('should execute a SELECT with a WHERE clause', async () => {
      const results = await csvSql.query(
        'SELECT name FROM people WHERE age = 30'
      );
      expect(results.length).toBe(2);
      expect(results).toEqual([{ name: 'Alice' }, { name: 'Charlie' }]);
    });

    it('should execute a SELECT with a LIKE clause', async () => {
      const results = await csvSql.query(
        "SELECT id, name FROM people WHERE name LIKE 'ali'"
      );
      expect(results.length).toBe(1);
      expect(results[0]).toEqual({ id: '1', name: 'Alice' });
    });

    it('should execute an INSERT query and mark the table as dirty', async () => {
      const result = await csvSql.query(
        'INSERT INTO people VALUES {"id": "4", "name": "Dana", "age": "40", "city": "Chicago"}'
      );
      expect(result.insertedCount).toBe(1);
      expect(csvSql.tablesInMemory.people.data.length).toBe(4);
      expect(csvSql.tablesInMemory.people.isDirty).toBe(true);
    });

    it('should execute a DELETE query with a WHERE clause', async () => {
      const result = await csvSql.query(
        "DELETE FROM people WHERE city = 'Chicago'"
      );
      expect(result.deletedCount).toBe(1);
      expect(csvSql.tablesInMemory.people.data.length).toBe(2);
      expect(csvSql.tablesInMemory.people.isDirty).toBe(true);
    });

    it('should execute a DELETE query without a WHERE clause, deleting all rows', async () => {
      const result = await csvSql.query('DELETE FROM people');
      expect(result.deletedCount).toBe(3);
      expect(csvSql.tablesInMemory.people.data.length).toBe(0);
      expect(csvSql.tablesInMemory.people.isDirty).toBe(true);
    });

    it('should throw DaitanInvalidInputError for a malformed query', async () => {
      await expect(csvSql.query('SELECT FROM people')).rejects.toThrow(
        DaitanInvalidInputError
      );
      await expect(
        csvSql.query("UPDATE people SET name = 'x'")
      ).rejects.toThrow(DaitanInvalidInputError);
    });
  });
});
