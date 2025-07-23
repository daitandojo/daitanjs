// data/src/index.js
/**
 * @file Main entry point for the @daitanjs/data package.
 * @module @daitanjs/data
 *
 * @description
 * The `@daitanjs/data` package provides a comprehensive suite of tools for data
 * persistence, caching, and local file-based data management. It serves as the
 * foundational data layer for the DaitanJS ecosystem.
 *
 * Key Features:
 * - **MongoDB Integration**: Robust connection management and query helpers for both
 *   the native MongoDB driver and the Mongoose ODM. Includes pre-defined Mongoose
 *   schemas for common entities like `User`, `Company`, etc.
 * - **In-Memory Caching**: A powerful `CacheManager` class that wraps `node-cache`
 *   to provide TTL, key generation, and function wrapping for caching expensive operations.
 * - **File-Based Storage**:
 *   - `CSVSQL`: A unique utility that treats a directory of CSV files as a database,
 *     allowing for simplified SQL-like query operations.
 *   - `charStore`: A simple, line-delimited key-value store for lightweight data logging or tracking.
 *   - `jsonStore`: A line-delimited JSON store with a MongoDB-like query interface for
 *     unstructured or semi-structured data.
 * - **File System Utilities**: Re-exports core file system helpers from `@daitanjs/utilities`
 *   for convenience, though direct import is recommended to reduce dependency coupling.
 */
import { getLogger } from '@daitanjs/development';

const dataIndexLogger = getLogger('daitan-data-index');

dataIndexLogger.debug('Exporting DaitanJS Data modules and utilities...');

// --- Caching ---
export { default as CacheManager } from './caching/index.js';

// --- Character Storage (Simple Key-Value File Store) ---
export * from './char/index.js';

// --- CSV Utilities ---
export { ensureCSVExists, CSVSQL } from './csv/index.js';

// --- File System Utilities (Deprecated Re-export from @daitanjs/utilities) ---
export * from './file/index.js';

// --- JSON Store (Line-Delimited JSON with Querying) ---
export * from './jsonstore/index.js';

// --- MongoDB (Native Driver and Mongoose ODM) ---
export * from './mongodb/index.js';

// --- Mongoose Models ---
// This re-exports all Mongoose models defined in and exported from `./models/index.js`.
export * from './models/index.js';

// --- MySQL (Placeholder Utilities) ---
export * from './mysql/index.js';

dataIndexLogger.info('DaitanJS Data module main exports configured and ready.');
