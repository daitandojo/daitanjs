// math/src/index.js
/**
 * @file Main entry point for the @daitanjs/math package.
 * @module @daitanjs/math
 *
 * @description
 * This package provides a powerful, Pandas-like DataFrame and Series API for data
 * manipulation and analysis in JavaScript, built on top of Danfo.js. It is designed
 * to integrate seamlessly with the DaitanJS ecosystem, especially for preparing
 * data for model training with `@daitanjs/training`.
 *
 * Key Exports:
 * - `DataFrame`: The primary data structure, a 2D labeled array with powerful manipulation methods.
 * - `Series`: A 1D labeled array, the building block of a DataFrame.
 * - Other utilities from Danfo.js are re-exported for convenience.
 */
import { getLogger } from '@daitanjs/development';
import { readCSV, readJSON } from 'danfojs-node';

const mathIndexLogger = getLogger('daitan-math-index');

mathIndexLogger.debug('Exporting DaitanJS Math module functionalities...');

// Export our custom DataFrame and the Danfo.js Series
export { DataFrame, Series } from './DataFrame.js';

// Re-export useful I/O functions from Danfo.js for convenience
export { readCSV, readJSON };

// As this package matures, we could add more standalone math or statistical functions here.
// export * from './statistics.js';
// export * from './linearAlgebra.js';

mathIndexLogger.info('DaitanJS Math module exports ready.');
