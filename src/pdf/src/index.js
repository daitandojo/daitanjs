// pdf/src/index.js
/**
 * @file Main entry point for the @daitanjs/pdf package.
 * @module @daitanjs/pdf
 *
 * @description
 * This package provides a comprehensive suite of utilities for working with PDF documents.
 *
 * Key Features:
 * - **Creation**: `htmlToPDF` converts HTML content into a PDF using Puppeteer (Node.js only).
 * - **Manipulation**: `mergePDFs` and `splitPDF` allow for combining and splitting PDF documents in memory using `pdf-lib`.
 * - **Reporting**: The high-level `generatePdfReport` function orchestrates the creation of
 *   a complete, styled PDF report from structured data, saving it to a file in a single call.
 * - **File System**: `savePDFBufferToFile` is a helper for writing PDF buffers to disk in a Node.js environment.
 */
import { getLogger } from '@daitanjs/development';

const logger = getLogger('daitan-pdf-index');
logger.debug('Exporting DaitanJS PDF module functionalities...');

// --- PDF Creation from HTML ---
export { htmlToPDF } from './creation.js';

// --- PDF Manipulation ---
export { mergePDFs, splitPDF, savePDFBufferToFile } from './manipulation.js';

// --- High-Level Reporting ---
export { generatePdfReport } from './reporting.js';
