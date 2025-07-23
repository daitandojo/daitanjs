// web/src/index.js
/**
 * @file Main entry point for the @daitanjs/web package.
 * @module @daitanjs/web
 *
 * @description
 * This package provides powerful, intelligent utilities for web-related tasks, including:
 * - **Robust Scraping**: An advanced `downloadAndExtract` function that uses a cascading
 *   strategy to automatically choose the best engine (static or browser-based) and can
 *   output clean, "reader-mode" text.
 * - **Web Search**: A flexible `googleSearch` utility for direct access to the
 *   Google Custom Search Engine API.
 *
 * For most web scraping and search tasks, `downloadAndExtract` and `googleSearch`
 * are the recommended entry points.
 */

import { getLogger } from '@daitanjs/development';

const webIndexLogger = getLogger('daitan-web-index');

webIndexLogger.debug('Exporting DaitanJS Web module functionalities...');

// --- Advanced Scraping Utilities ---
// The primary public function for scraping with intelligent strategy selection.
export { downloadAndExtract } from './scraping.js';

// --- Core Search Utilities ---
// The public function for direct web searching via Google CSE.
export { googleSearch } from './search.js';

webIndexLogger.info('DaitanJS Web module exports ready.');
