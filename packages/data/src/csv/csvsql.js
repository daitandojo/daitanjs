// packages/data/src/csv/csvsql.js
/**
 * @file CSVSQL class for file-based CSV "database" operations.
 * @module @daitanjs/data/csv/CSVSQL
 *
 * @description
 * Provides a simple, file-based "SQL-like" interface for managing and querying
 * data stored in CSV files. Each CSV file is treated as a "table".
 * This class allows for creating tables (CSV files with headers), loading them into memory,
 * saving changes, deleting tables, and performing basic SELECT, INSERT, and DELETE queries
 * on the in-memory representation of the tables.
 *
 * It uses `csv-parse/sync` and `csv-stringify/sync` for CSV processing.
 * This is suitable for small to medium-sized datasets where the overhead of a full
 * database is not required, or for quick prototyping.
 *
 * Key Operations:
 * - `initialize()`: Sets up the data directory and can preload tables.
 * - `createTable()`, `loadTable()`, `saveTable()`, `deleteTable()`: Table management.
 * - `query()`: Executes simplified SQL-like queries (SELECT, INSERT, DELETE) on loaded tables.
 * - `listTables()`: Lists available CSV "tables" in the data directory.
 *
 * Configuration:
 * - `CSV_SQL_DIRECTORY` (environment variable via ConfigManager): Specifies the root
 *   directory for storing CSV table files. Defaults to an OS temp subfolder or local `.daitan_data_csv_sql`.
 * - `CSV_SQL_VERBOSE` or `DEBUG_DATA` (environment variables): Control verbosity.
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { parse as csvParseSync } from 'csv-parse/sync';
import { stringify as csvStringifySync } from 'csv-stringify/sync';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanFileOperationError,
  DaitanOperationError,
  DaitanInvalidInputError,
} from '@daitanjs/error';
import { truncateString } from '@daitanjs/utilities';

const csvSqlBaseLogger = getLogger('daitan-csv-sql');

const DEFAULT_CSV_SQL_DIR_NAME_FALLBACK = 'daitan_csv_sql_data';
const CSV_SQL_DATA_ROOT_DIR_NAME = '.daitan_csv_sql_root';

/**
 * @class CSVSQL
 * @classdesc Manages CSV files as tables, allowing for SQL-like operations.
 */
class CSVSQL {
  /**
   * Creates an instance of CSVSQL.
   * @public
   * @param {string} [directoryPath] - Optional: Path to the directory for storing CSV table files.
   * @param {object} [options={}] - Constructor options.
   * @param {import('winston').Logger} [options.loggerInstance] - Optional logger instance.
   * @param {boolean} [options.verbose] - Verbosity for this instance.
   */
  constructor(directoryPath, options = {}) {
    const configManager = getConfigManager(); // Call inside constructor
    this.logger = options.loggerInstance || csvSqlBaseLogger;
    this.verbose =
      options.verbose !== undefined
        ? options.verbose
        : configManager.get('CSV_SQL_VERBOSE', false) ||
          configManager.get('DEBUG_DATA', false);

    if (directoryPath) {
      if (typeof directoryPath !== 'string' || !directoryPath.trim()) {
        throw new DaitanConfigurationError(
          'If provided, directoryPath for CSVSQL must be a non-empty string.'
        );
      }
      this.dataDirectory = path.resolve(directoryPath.trim());
    } else {
      const configuredDir = configManager.get('CSV_SQL_DIRECTORY');
      if (configuredDir) {
        this.dataDirectory = path.resolve(String(configuredDir).trim());
      } else {
        try {
          this.dataDirectory = path.join(
            os.tmpdir(),
            'daitanjs_data',
            DEFAULT_CSV_SQL_DIR_NAME_FALLBACK
          );
        } catch (e) {
          this.logger.warn(
            `CSVSQL: os.tmpdir() failed, falling back to CWD for data directory. Error: ${e.message}`
          );
          this.dataDirectory = path.resolve(
            process.cwd(),
            CSV_SQL_DATA_ROOT_DIR_NAME,
            DEFAULT_CSV_SQL_DIR_NAME_FALLBACK
          );
        }
      }
    }

    /** @type {Object.<string, { data: object[], headers: string[], filePath: string, isDirty?: boolean }>} */
    this.tablesInMemory = {};
    this.isInitialized = false;

    if (this.verbose) {
      this.logger.info(
        `CSVSQL instance created. Data directory set to: "${this.dataDirectory}".`
      );
    }
  }

  /**
   * Initializes the CSVSQL instance.
   * @public
   * @async
   * @param {object} [options={}] - Initialization options.
   * @param {boolean} [options.preloadAllTables=true]
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    if (this.isInitialized) return;
    const { preloadAllTables = true } = options;

    try {
      await fs.mkdir(this.dataDirectory, { recursive: true });
    } catch (mkdirError) {
      this.logger.error(
        `CRITICAL: Error creating CSVSQL data directory "${this.dataDirectory}".`,
        { errorMessage: mkdirError.message }
      );
      throw new DaitanFileOperationError(
        `Failed to create CSVSQL data directory: ${mkdirError.message}`,
        { path: this.dataDirectory, operation: 'mkdir' },
        mkdirError
      );
    }

    if (preloadAllTables) {
      try {
        const files = await fs.readdir(this.dataDirectory);
        const csvFiles = files.filter(
          (file) => path.extname(file).toLowerCase() === '.csv'
        );
        for (const file of csvFiles) {
          const tableName = path.basename(file, '.csv');
          await this.loadTable({ tableName });
        }
      } catch (readDirError) {
        this.logger.error(
          `Error reading data directory for preloading tables: "${this.dataDirectory}"`,
          { errorMessage: readDirError.message }
        );
      }
    }
    this.isInitialized = true;
  }

  /** @private */
  _getTablePath(tableName) {
    if (
      !tableName ||
      typeof tableName !== 'string' ||
      !/^[a-zA-Z0-9_.-]+$/.test(tableName.trim())
    ) {
      throw new DaitanInvalidInputError(
        'Table name must be a non-empty string with valid characters.'
      );
    }
    return path.join(this.dataDirectory, `${tableName.trim()}.csv`);
  }

  /**
   * Lists the names of all "tables" (CSV files) in the data directory.
   * @public
   * @async
   * @returns {Promise<string[]>}
   */
  async listTables() {
    await this.initialize();
    try {
      const files = await fs.readdir(this.dataDirectory);
      return files
        .filter((file) => path.extname(file).toLowerCase() === '.csv')
        .map((file) => path.basename(file, '.csv'));
    } catch (error) {
      throw new DaitanFileOperationError(
        `Failed to list tables from directory: ${error.message}`,
        { path: this.dataDirectory, operation: 'readdir' },
        error
      );
    }
  }

  /**
   * Loads a CSV table from file into memory.
   * @public
   * @async
   * @param {object} params
   * @param {string} params.tableName
   * @param {boolean} [params.forceReload=false]
   * @returns {Promise<void>}
   */
  async loadTable({ tableName, forceReload = false }) {
    await this.initialize();
    const filePath = this._getTablePath(tableName);

    if (this.tablesInMemory[tableName] && !forceReload) return;

    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      if (!fileContent.trim()) {
        this.tablesInMemory[tableName] = {
          data: [],
          headers: [],
          filePath,
          isDirty: false,
        };
        return;
      }
      const parsedData = csvParseSync(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
      const headers = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];
      this.tablesInMemory[tableName] = {
        data: parsedData,
        headers,
        filePath,
        isDirty: false,
      };
    } catch (error) {
      throw new DaitanFileOperationError(
        `Failed to load/parse CSV table "${tableName}": ${error.message}`,
        { path: filePath, operation: 'loadTable' },
        error
      );
    }
  }

  /**
   * Saves an in-memory table to its CSV file.
   * @public
   * @async
   * @param {object} params
   * @param {string} params.tableName
   * @param {object[]} [params.dataToSave] - Optional new data to save.
   * @returns {Promise<void>}
   */
  async saveTable({ tableName, dataToSave }) {
    await this.initialize();
    const filePath = this._getTablePath(tableName);
    let dataForCsv, headersForCsv;

    if (dataToSave !== undefined) {
      if (
        !Array.isArray(dataToSave) ||
        (dataToSave.length > 0 && typeof dataToSave[0] !== 'object')
      ) {
        throw new DaitanInvalidInputError(
          'If `dataToSave` is provided, it must be an array of objects.'
        );
      }
      dataForCsv = dataToSave;
      headersForCsv =
        dataToSave.length > 0
          ? Object.keys(dataToSave[0])
          : this.tablesInMemory[tableName]?.headers || [];
      this.tablesInMemory[tableName] = {
        data: dataForCsv,
        headers: headersForCsv,
        filePath,
        isDirty: false,
      };
    } else if (this.tablesInMemory[tableName]) {
      dataForCsv = this.tablesInMemory[tableName].data;
      headersForCsv = this.tablesInMemory[tableName].headers;
    } else {
      throw new DaitanConfigurationError(
        `Cannot save table "${tableName}": Not loaded and no new data provided.`
      );
    }

    try {
      const csvContent = csvStringifySync(dataForCsv, {
        header: true,
        columns: headersForCsv.length > 0 ? headersForCsv : undefined,
      });
      await fs.writeFile(filePath, csvContent, 'utf8');
      if (this.tablesInMemory[tableName])
        this.tablesInMemory[tableName].isDirty = false;
    } catch (error) {
      throw new DaitanFileOperationError(
        `Failed to save CSV table "${tableName}": ${error.message}`,
        { path: filePath, operation: 'saveTable' },
        error
      );
    }
  }

  /**
   * Deletes a table (its CSV file) and removes it from memory.
   * @public
   * @async
   * @param {object} params
   * @param {string} params.tableName
   * @returns {Promise<void>}
   */
  async deleteTable({ tableName }) {
    await this.initialize();
    const filePath = this._getTablePath(tableName);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new DaitanFileOperationError(
          `Failed to delete CSV table file "${tableName}": ${error.message}`,
          { path: filePath, operation: 'unlink' },
          error
        );
      }
    }
    if (this.tablesInMemory[tableName]) {
      delete this.tablesInMemory[tableName];
    }
  }

  /**
   * Creates a new empty table (CSV file with only headers).
   * @public
   * @async
   * @param {object} params
   * @param {string} params.tableName
   * @param {string[]} params.headers
   * @returns {Promise<void>}
   */
  async createTable({ tableName, headers }) {
    await this.initialize();
    const filePath = this._getTablePath(tableName);
    if (
      !Array.isArray(headers) ||
      headers.length === 0 ||
      !headers.every((h) => typeof h === 'string' && h.trim())
    ) {
      throw new DaitanInvalidInputError(
        '`headers` must be a non-empty array of non-empty strings.'
      );
    }

    try {
      await fs.access(filePath, fs.constants.F_OK);
      throw new DaitanFileOperationError(
        `Table "${tableName}" already exists.`,
        { path: filePath, operation: 'create_check_exists' }
      );
    } catch (error) {
      if (error.code === 'ENOENT') {
        const headerCsvString = csvStringifySync([headers]);
        await fs.writeFile(filePath, headerCsvString, 'utf8');
        this.tablesInMemory[tableName] = {
          data: [],
          headers: [...headers],
          filePath,
          isDirty: false,
        };
      } else {
        throw new DaitanFileOperationError(
          `Failed to check for table "${tableName}": ${error.message}`,
          { path: filePath, operation: 'create_access_check' },
          error
        );
      }
    }
  }

  /**
   * Gets information about a loaded table.
   * @public
   * @param {object} params
   * @param {string} params.tableName
   * @returns {{tableName: string, headers: string[], rowCount: number, filePath: string, inMemory: boolean, isDirty: boolean}}
   */
  getTableInfo({ tableName }) {
    const table = this.tablesInMemory[tableName?.trim()];
    if (!table) {
      throw new DaitanOperationError(
        `Table "${tableName}" is not loaded in memory. Use loadTable() first.`
      );
    }
    return {
      tableName: tableName.trim(),
      headers: [...table.headers],
      rowCount: table.data.length,
      filePath: table.filePath,
      inMemory: true,
      isDirty: table.isDirty || false,
    };
  }

  /** @private */
  _parseQuery(sqlQuery) {
    if (typeof sqlQuery !== 'string' || !sqlQuery.trim())
      throw new DaitanInvalidInputError('SQL query string cannot be empty.');
    const upperQuery = sqlQuery.toUpperCase().trim();
    if (upperQuery.startsWith('SELECT')) {
      const fromMatch = upperQuery.match(/\sFROM\s+([a-zA-Z0-9_.-]+)/);
      if (!fromMatch)
        throw new DaitanInvalidInputError(
          'Invalid SELECT: Missing FROM clause.'
        );
      return {
        action: 'SELECT',
        tableName: fromMatch[1],
        fields: sqlQuery
          .substring(6, fromMatch.index)
          .trim()
          .split(',')
          .map((f) => f.trim()),
        conditions: sqlQuery
          .match(/\sWHERE\s+(.+?)(?:\sORDER BY|\s*$)/i)?.[1]
          .trim(),
        orderBy: sqlQuery.match(
          /\sORDER BY\s+([a-zA-Z0-9_]+)(?:\s+(ASC|DESC))?/i
        )
          ? {
              field: sqlQuery.match(/\sORDER BY\s+([a-zA-Z0-9_]+)/i)[1],
              direction: (
                sqlQuery.match(/\s(ASC|DESC)/i)?.[1] || 'ASC'
              ).toUpperCase(),
            }
          : undefined,
      };
    } else if (upperQuery.startsWith('INSERT INTO')) {
      const tableMatch = upperQuery.match(
        /INSERT INTO\s+([a-zA-Z0-9_.-]+)\s+VALUES/
      );
      if (!tableMatch)
        throw new DaitanInvalidInputError('Invalid INSERT format.');
      const jsonValuesMatch = sqlQuery.match(/\sVALUES\s*(\{[\s\S]*?\})\s*$/is);
      if (!jsonValuesMatch?.[1])
        throw new DaitanInvalidInputError(
          'Invalid INSERT: Missing JSON object for VALUES.'
        );
      try {
        return {
          action: 'INSERT',
          tableName: tableMatch[1],
          valuesObject: JSON.parse(jsonValuesMatch[1]),
        };
      } catch (e) {
        throw new DaitanInvalidInputError(
          `Invalid JSON in INSERT VALUES: ${e.message}`
        );
      }
    } else if (upperQuery.startsWith('DELETE FROM')) {
      const tableMatch = upperQuery.match(/DELETE FROM\s+([a-zA-Z0-9_.-]+)/);
      if (!tableMatch)
        throw new DaitanInvalidInputError(
          'Invalid DELETE: Missing FROM clause.'
        );
      return {
        action: 'DELETE',
        tableName: tableMatch[1],
        conditions: sqlQuery.match(/\sWHERE\s+(.+?)\s*$/i)?.[1].trim(),
      };
    }
    throw new DaitanInvalidInputError(`Unsupported SQL action in query.`);
  }

  /** @private */
  _evaluateCondition(row, conditionString, headers) {
    if (!conditionString?.trim()) return true;
    const conditionRegex =
      /^\s*([a-zA-Z0-9_]+)\s*(!==?|===?|<>|<=?|>=?|LIKE)\s*(.+)\s*$/i;
    const match = conditionString.match(conditionRegex);
    if (!match) return false;
    const [, fieldName, operator, rawValue] = match.map((s) => s.trim());
    if (!headers.includes(fieldName)) return false;
    const rowValue = row[fieldName];
    let compareValue;
    if (
      (rawValue.startsWith("'") && rawValue.endsWith("'")) ||
      (rawValue.startsWith('"') && rawValue.endsWith('"'))
    )
      compareValue = rawValue.slice(1, -1);
    else if (rawValue.toLowerCase() === 'true') compareValue = true;
    else if (rawValue.toLowerCase() === 'false') compareValue = false;
    else if (!isNaN(parseFloat(rawValue)) && isFinite(rawValue))
      compareValue = parseFloat(rawValue);
    else compareValue = rawValue;
    let coercedRowValue = rowValue;
    if (typeof rowValue === 'string') {
      if (typeof compareValue === 'number')
        coercedRowValue = parseFloat(rowValue) || rowValue;
      else if (typeof compareValue === 'boolean')
        coercedRowValue =
          rowValue.toLowerCase() === 'true'
            ? true
            : rowValue.toLowerCase() === 'false'
            ? false
            : rowValue;
    }
    if (operator.toUpperCase() === 'LIKE')
      return (
        typeof coercedRowValue === 'string' &&
        typeof compareValue === 'string' &&
        String(coercedRowValue)
          .toLowerCase()
          .includes(String(compareValue).toLowerCase())
      );
    switch (operator.toUpperCase()) {
      case '=':
      case '==':
        return coercedRowValue == compareValue;
      case '===':
        return coercedRowValue === compareValue;
      case '!=':
      case '<>':
        return coercedRowValue != compareValue;
      case '!==':
        return coercedRowValue !== compareValue;
      case '>':
        return coercedRowValue > compareValue;
      case '<':
        return coercedRowValue < compareValue;
      case '>=':
        return coercedRowValue >= compareValue;
      case '<=':
        return coercedRowValue <= compareValue;
      default:
        return false;
    }
  }

  /**
   * Executes a simplified SQL-like query on an in-memory table.
   * @public
   * @async
   * @param {string} sqlQuery
   * @returns {Promise<object[] | {success: boolean, message?: string, insertedCount?: number, deletedCount?: number}>}
   */
  async query(sqlQuery) {
    await this.initialize();
    const parsedQuery = this._parseQuery(sqlQuery);
    const { action, tableName } = parsedQuery;
    if (!this.tablesInMemory[tableName]) await this.loadTable({ tableName });
    const table = this.tablesInMemory[tableName];
    if (!table)
      throw new DaitanOperationError(`Table "${tableName}" not available.`);

    switch (action) {
      case 'SELECT':
        let results = parsedQuery.conditions
          ? table.data.filter((row) =>
              this._evaluateCondition(
                row,
                parsedQuery.conditions,
                table.headers
              )
            )
          : [...table.data];
        if (
          parsedQuery.orderBy?.field &&
          table.headers.includes(parsedQuery.orderBy.field)
        )
          results.sort((a, b) => {
            const [valA, valB] = [
              a[parsedQuery.orderBy.field],
              b[parsedQuery.orderBy.field],
            ];
            let comp = 0;
            if (valA < valB) comp = -1;
            if (valA > valB) comp = 1;
            return parsedQuery.orderBy.direction === 'DESC' ? comp * -1 : comp;
          });
        if (parsedQuery.fields[0] !== '*')
          results = results.map((row) =>
            parsedQuery.fields.reduce((acc, field) => {
              if (table.headers.includes(field)) acc[field] = row[field];
              return acc;
            }, {})
          );
        return results;
      case 'INSERT':
        if (
          typeof parsedQuery.valuesObject !== 'object' ||
          parsedQuery.valuesObject === null
        )
          throw new DaitanInvalidInputError(
            'INSERT requires a valid JSON object.'
          );
        table.data.push(parsedQuery.valuesObject);
        table.isDirty = true;
        const newKeys = Object.keys(parsedQuery.valuesObject);
        const headerSet = new Set(table.headers);
        newKeys.forEach((key) => headerSet.add(key));
        table.headers = Array.from(headerSet);
        return {
          success: true,
          message: `Row inserted into "${tableName}" in memory.`,
          insertedCount: 1,
        };
      case 'DELETE':
        const initialLength = table.data.length;
        table.data = parsedQuery.conditions
          ? table.data.filter(
              (row) =>
                !this._evaluateCondition(
                  row,
                  parsedQuery.conditions,
                  table.headers
                )
            )
          : [];
        const deletedCount = initialLength - table.data.length;
        if (deletedCount > 0) table.isDirty = true;
        return { success: true, deletedCount };
      default:
        throw new DaitanOperationError(
          `Unsupported SQL action parsed: ${action}`
        );
    }
  }

  /**
   * Saves the result of a SELECT query to a new CSV table file.
   * @public
   * @async
   * @param {object} params
   * @param {object[]} params.queryResultData
   * @param {string} params.newTableName
   * @returns {Promise<void>}
   */
  async saveQueryResult({ queryResultData, newTableName }) {
    await this.initialize();
    if (!Array.isArray(queryResultData))
      throw new DaitanInvalidInputError(
        'queryResultData must be an array of objects.'
      );
    this._getTablePath(newTableName); // Validates name
    await this.saveTable({
      tableName: newTableName,
      dataToSave: queryResultData,
    });
  }

  /**
   * Clears all loaded tables from the in-memory cache.
   * @public
   */
  clearMemoryCache() {
    this.tablesInMemory = {};
  }
}

export { CSVSQL };