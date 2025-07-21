// data/src/csv/index.js
import { getLogger } from '@daitanjs/development';

const csvIndexLogger = getLogger('daitan-data-csv-index');

csvIndexLogger.debug('Exporting DaitanJS CSV functionalities...');

// Export from csv.js (which contains ensureCSVExists)
export { ensureCSVExists } from './csv.js';

// Export CSVSQL class as default from csvsql.js
// If CSVSQL is the primary export of that file, it would be `export { CSVSQL } from './csvsql.js';`
// Assuming csvsql.js exports CSVSQL as a named export or default.
// Based on the previous refactor, it was `export default CSVSQL;`
export { CSVSQL } from './csvsql.js';

csvIndexLogger.info('DaitanJS Data CSV module exports ready.');
