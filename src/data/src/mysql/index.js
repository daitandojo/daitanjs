// data/src/mysql/index.js
/**
 * @file MySQL database connection and query utilities.
 * @module @daitanjs/data/mysql
 *
 * @description
 * This module provides a robust connection manager and query execution utility for MySQL
 * databases, using the `mysql2/promise` library for async/await support. It manages a
 * singleton connection pool to ensure efficient and stable database communication.
 */
import mysql from 'mysql2/promise';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { DaitanConfigurationError, DaitanDatabaseError } from '@daitanjs/error';

const mysqlLogger = getLogger('daitan-mysql');

let globalMySqlConnectionPool = null;
let connectionInProgress = false;
let currentConnectionConfig = null;

/**
 * @typedef {import('mysql2/promise').Pool | import('mysql2/promise').Connection} MySqlConnection
 * @typedef {import('mysql2/promise').PoolOptions} MySqlPoolOptions
 */

/**
 * Establishes and manages a singleton connection pool to a MySQL database.
 * @public
 * @async
 * @param {MySqlPoolOptions} [options={}] - Connection pool options, overriding defaults and environment variables.
 * @returns {Promise<MySqlConnection>} The MySQL connection pool object.
 */
export async function connect(options = {}) {
  const configManager = getConfigManager(); // Lazy-load
  const callId = `mysql-connect-${Date.now().toString(36)}`;
  mysqlLogger.info(
    `[${callId}] Attempting to establish MySQL connection pool.`
  );

  const connectionConfig = {
    host: options.host || configManager.get('MYSQL_HOST', 'localhost'),
    port: options.port || configManager.get('MYSQL_PORT', 3306),
    user: options.user || configManager.get('MYSQL_USER'),
    password: options.password || configManager.get('MYSQL_PASSWORD'),
    database: options.database || configManager.get('MYSQL_DATABASE'),
    waitForConnections: options.waitForConnections ?? true,
    connectionLimit: options.connectionLimit ?? 10,
    queueLimit: options.queueLimit ?? 0,
    connectTimeout: options.connectTimeout ?? 10000,
    ...options, // Allow full override
  };

  const configForComparison = { ...connectionConfig };
  delete configForComparison.password;

  if (!connectionConfig.user || !connectionConfig.database) {
    throw new DaitanConfigurationError(
      'MySQL connection failed: Missing user or database. Configure MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE.'
    );
  }

  if (
    globalMySqlConnectionPool &&
    JSON.stringify(currentConnectionConfig) ===
      JSON.stringify(configForComparison) &&
    !options.forceReconnect
  ) {
    try {
      const conn = await globalMySqlConnectionPool.getConnection();
      await conn.ping();
      conn.release();
      return globalMySqlConnectionPool;
    } catch (pingError) {
      mysqlLogger.warn(
        `[${callId}] Existing MySQL connection is stale. Reconnecting. Error: ${pingError.message}`
      );
      await disconnect(true);
    }
  }

  if (connectionInProgress) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (
      globalMySqlConnectionPool &&
      JSON.stringify(currentConnectionConfig) ===
        JSON.stringify(configForComparison)
    )
      return globalMySqlConnectionPool;
  }

  connectionInProgress = true;
  if (globalMySqlConnectionPool) await disconnect(true);

  try {
    globalMySqlConnectionPool = await mysql.createPool(connectionConfig);
    currentConnectionConfig = configForComparison;

    const testConn = await globalMySqlConnectionPool.getConnection();
    await testConn.ping();
    testConn.release();
    mysqlLogger.info(
      `[${callId}] MySQL connection pool established and tested successfully for database "${connectionConfig.database}".`
    );
    return globalMySqlConnectionPool;
  } catch (error) {
    globalMySqlConnectionPool = null;
    currentConnectionConfig = null;
    throw new DaitanDatabaseError(
      `MySQL connection failed: ${error.message}`,
      { connectionParams: configForComparison },
      error
    );
  } finally {
    connectionInProgress = false;
  }
}

/**
 * Disconnects the global MySQL connection pool if it's active.
 * @public
 * @async
 * @param {boolean} [internalCall=false] - For internal use during reconnect.
 * @returns {Promise<void>}
 */
export async function disconnect(internalCall = false) {
  if (globalMySqlConnectionPool) {
    mysqlLogger.info('Disconnecting from MySQL...');
    try {
      await globalMySqlConnectionPool.end();
    } catch (error) {
      if (!internalCall) {
        throw new DaitanDatabaseError(
          `Error disconnecting MySQL: ${error.message}`,
          {},
          error
        );
      }
    } finally {
      globalMySqlConnectionPool = null;
      currentConnectionConfig = null;
      connectionInProgress = false;
    }
  }
}

/**
 * Executes a SQL query using the established connection pool.
 * @public
 * @async
 * @param {string} sqlString - The SQL query string.
 * @param {Array<any>} [values=[]] - Values for parameterized queries.
 * @returns {Promise<[mysql.RowDataPacket[] | mysql.OkPacket | mysql.ResultSetHeader, mysql.FieldPacket[]]>} Query results and fields.
 */
export async function execute(sqlString, values = []) {
  if (!globalMySqlConnectionPool) {
    await connect();
  }
  try {
    const [results, fields] = await globalMySqlConnectionPool.execute(
      sqlString,
      values
    );
    return [results, fields];
  } catch (error) {
    throw new DaitanDatabaseError(
      `SQL query execution failed: ${error.message}`,
      { sql: sqlString },
      error
    );
  }
}

/**
 * Logs the structure of the MySQL database.
 * @public
 * @async
 * @param {string} [dbName] - Specific database name to inspect.
 * @returns {Promise<void>}
 */
export async function logDatabaseStructure(dbName) {
  if (!globalMySqlConnectionPool) {
    await connect();
  }
  const databaseToInspect = dbName || currentConnectionConfig?.database;

  if (!databaseToInspect) {
    throw new DaitanConfigurationError(
      'Database name not specified and could not be determined from connection.'
    );
  }

  mysqlLogger.info(`Inspecting database: "${databaseToInspect}"`);
  try {
    const [tables] = await execute(`SHOW TABLES FROM \`${databaseToInspect}\``);
    for (const tableRow of tables) {
      const tableName = Object.values(tableRow)[0];
      mysqlLogger.info(`  ↳ Table: ${tableName}`);
      const [columns] = await execute(
        `SHOW COLUMNS FROM \`${databaseToInspect}\`.\`${tableName}\``
      );
      columns.forEach((col) => {
        mysqlLogger.info(
          `    - Column: ${col.Field} (Type: ${col.Type}, Null: ${col.Null})`
        );
      });
    }
  } catch (error) {
    throw new DaitanDatabaseError(
      `Failed to log MySQL database structure: ${error.message}`,
      {},
      error
    );
  }
}

process.on('exit', () => {
  if (globalMySqlConnectionPool) {
    mysqlLogger.info('Process exiting, closing MySQL pool...');
    globalMySqlConnectionPool.end();
  }
});