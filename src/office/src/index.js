// office/src/index.js
/**
 * @file Main entry point for the @daitanjs/office package.
 * @module @daitanjs/office
 *
 * @description
 * This package provides a suite of utilities for creating, manipulating, and reading
 * common office document formats: Excel (.xlsx), PowerPoint (.pptx), and Word (.docx).
 * It leverages popular libraries like ExcelJS, PptxGenJS, docx, and Mammoth.
 *
 * Key Features:
 * - **Excel**: Generate Excel files from table data, with support for styling and auto-filtering.
 * - **PowerPoint**: Create presentations, add slides with text and images, add charts, and save/read PPTX files.
 * - **Word**: Generate .docx documents, add paragraphs and tables with styling, save documents, and extract text content.
 *
 * All operations are designed to be asynchronous where appropriate and use DaitanJS
 * custom error types for consistent error handling. Logging is provided via `@daitanjs/development`.
 */

import { getLogger } from '@daitanjs/development';

const officeIndexLogger = getLogger('daitan-office-index');

officeIndexLogger.debug('Exporting DaitanJS Office module functionalities...');

// --- Excel Utilities ---
export { downloadTableAsExcel } from './excel.js';

// --- PowerPoint Utilities ---
export {
  createPresentation,
  addSlide,
  addImageToSlide,
  addChartToSlide,
  savePresentation,
  readPresentation,
} from './powerpoint.js';

// --- Word Document Utilities ---
export {
  createWordDocument,
  addWordParagraph,
  addWordTable,
  saveWordDocument,
  readWordDocument,
} from './word.js';

officeIndexLogger.info('DaitanJS Office module exports ready.');
