import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const CSV_DIRECTORY = '/var/tmp/csv';

class CSVSQL {
  constructor(directory = CSV_DIRECTORY) {
    this.directory = directory;
    this.tables = {};
  }

  async initialize() {
    try {
      await fs.access(this.directory);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(this.directory, { recursive: true });
      } else {
        throw error;
      }
    }
  
    // Automatically load all CSV files in the directory
    const files = await fs.readdir(this.directory);
    for (const file of files) {
      if (path.extname(file).toLowerCase() === '.csv') {
        const tableName = path.basename(file, '.csv');
        await this.loadTable({ tableName });
      }
    }
  }

  async listTables() {
    const files = await fs.readdir(this.directory);
    return files.filter(file => path.extname(file).toLowerCase() === '.csv');
  }

  async loadTable({ tableName }) {
    const filePath = path.join(this.directory, `${tableName}.csv`);
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const parsed = parse(fileContent, { columns: true, skip_empty_lines: true });
      this.tables[tableName] = {
        data: parsed,
        headers: Object.keys(parsed[0] || {}),
        filePath: filePath
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Table ${tableName} does not exist.`);
      } else {
        throw new Error(`Failed to load table ${tableName}: ${error.message}`);
      }
    }
  }

  async saveTable(tableName, data = null) {
    const table = this.tables[tableName];
    if (!table && !data) {
      throw new Error(`Table ${tableName} does not exist and no data provided.`);
    }
    const dataToSave = data || table.data;
    const filePath = path.join(this.directory, `${tableName}.csv`);
    const csvContent = stringify(dataToSave, { header: true });
    await fs.writeFile(filePath, csvContent, 'utf8');
    if (!table) {
      this.tables[tableName] = {
        data: dataToSave,
        headers: Object.keys(dataToSave[0] || {}),
        filePath: filePath
      };
    }
  }

  async deleteTable({ tableName }) {
    const filePath = path.join(this.directory, `${tableName}.csv`);
    try {
      await fs.unlink(filePath);
      delete this.tables[tableName];
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Table ${tableName} does not exist.`);
      } else {
        throw new Error(`Failed to delete table ${tableName}: ${error.message}`);
      }
    }
  }

  async createTable({ tableName, headers }) {
    const filePath = path.join(this.directory, `${tableName}.csv`);
    try {
      await fs.access(filePath);
      throw new Error(`Table ${tableName} already exists.`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const csvContent = stringify([headers], { header: true });
        await fs.writeFile(filePath, csvContent, 'utf8');
        this.tables[tableName] = {
          data: [],
          headers: headers,
          filePath: filePath
        };
      } else {
        throw error;
      }
    }
  }

  getTableInfo({ tableName }) {
    const table = this.tables[tableName];
    if (!table) {
      throw new Error(`Table ${tableName} is not loaded.`);
    }
    return {
      fieldCount: table.headers.length,
      recordCount: table.data.length
    };
  }

  query(sqlQuery) {
    const { action, tableName, fields, conditions, orderBy } = this._parseQuery(sqlQuery);

    if (!this.tables[tableName]) {
      throw new Error(`Table ${tableName} is not loaded. Use loadTable() first.`);
    }

    switch (action) {
      case 'SELECT':
        return this._select(tableName, fields, conditions, orderBy);
      case 'INSERT':
        return this._insert(tableName, fields);
      case 'DELETE':
        return this._delete(tableName, conditions);
      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  }

  _parseQuery(sqlQuery) {
    const parts = sqlQuery.split(/\s+/);
    const action = parts[0].toUpperCase();
    let tableName, fields, conditions, orderBy;
  
    if (action === 'SELECT') {
      const fromIndex = parts.indexOf('FROM');
      if (fromIndex === -1) {
        throw new Error('Invalid SELECT query: missing FROM clause');
      }
      fields = parts.slice(1, fromIndex).join(' ').split(',').map(f => f.trim());
      tableName = parts[fromIndex + 1];
      const whereIndex = parts.indexOf('WHERE');
      const orderByIndex = parts.indexOf('ORDER');
      if (whereIndex !== -1) {
        conditions = parts.slice(whereIndex + 1, orderByIndex !== -1 ? orderByIndex : undefined).join(' ');
      }
      if (orderByIndex !== -1) {
        orderBy = parts.slice(orderByIndex + 2).join(' ');
      }
    } else if (action === 'INSERT') {
      tableName = parts[2];
      const valuesIndex = sqlQuery.indexOf('VALUES');
      if (valuesIndex !== -1) {
        const jsonStr = sqlQuery.slice(valuesIndex + 6).trim();
        try {
          fields = JSON.parse(jsonStr);
        } catch (error) {
          throw new Error(`Invalid JSON in INSERT query: ${error.message}`);
        }
      } else {
        throw new Error('Invalid INSERT query format');
      }
    } else if (action === 'DELETE') {
      tableName = parts[2];
      const whereIndex = parts.indexOf('WHERE');
      if (whereIndex !== -1) {
        conditions = parts.slice(whereIndex + 1).join(' ');
      }
    }
  
    return { action, tableName, fields, conditions, orderBy };
  }
    
  _select(tableName, fields, conditions, orderBy) {
    let result = this.tables[tableName].data;
  
    if (conditions) {
      result = result.filter(row => this._evaluateCondition(row, conditions));
    }
  
    if (fields[0] !== '*') {
      result = result.map(row => {
        const newRow = {};
        fields.forEach(field => {
          newRow[field.trim()] = row[field.trim()];
        });
        return newRow;
      });
    }
  
    if (orderBy) {
      const [field, direction] = orderBy.split(' ');
      result.sort((a, b) => {
        const aValue = this._parseValue(a[field.trim()]);
        const bValue = this._parseValue(b[field.trim()]);
        if (aValue < bValue) return direction === 'DESC' ? 1 : -1;
        if (aValue > bValue) return direction === 'DESC' ? -1 : 1;
        return 0;
      });
    }
  
    return result;
  }

  _insert(tableName, newRow) {
    this.tables[tableName].data.push(newRow);
    this.tables[tableName].headers = [...new Set([...this.tables[tableName].headers, ...Object.keys(newRow)])];
  }

  _delete(tableName, conditions) {
    this.tables[tableName].data = this.tables[tableName].data.filter(row => !this._evaluateCondition(row, conditions));
  }

  _evaluateCondition(row, condition) {
    const [field, operator, value] = condition.split(/\s*(=|!=|>|<|>=|<=)\s*/);
    const rowValue = this._parseValue(row[field.trim()]);
    const compareValue = this._parseValue(value);
    
    switch (operator) {
      case '=': return rowValue == compareValue;
      case '!=': return rowValue != compareValue;
      case '>': return rowValue > compareValue;
      case '<': return rowValue < compareValue;
      case '>=': return rowValue >= compareValue;
      case '<=': return rowValue <= compareValue;
      default: throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  _parseValue(value) {
    if (typeof value === 'string' && value.startsWith("'") && value.endsWith("'")) {
      return value.slice(1, -1);
    }
    return isNaN(value) ? value : Number(value);
  }

  async saveQueryResult(queryResult, newTableName) {
    if (!Array.isArray(queryResult) || queryResult.length === 0) {
      throw new Error('Invalid query result to save');
    }
    await this.saveTable(newTableName, queryResult);
  }
}

export default CSVSQL;
