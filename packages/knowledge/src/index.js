// knowledge/src/index.js
/**
 * @file Main entry point for the @daitanjs/knowledge package.
 * @module @daitanjs/knowledge
 *
 * @description
 * The `@daitanjs/knowledge` package serves as a repository for various structured
 * datasets and information commonly used in applications. This includes data related to
 * countries, languages, education levels, UI translations, and potentially other
 * domain-specific knowledge.
 *
 * The package aims to provide readily accessible, well-structured data that can be
 * imported and utilized directly by other DaitanJS packages or consuming applications,
 * reducing the need to redefine or fetch this common information repeatedly.
 *
 * Currently Exported Datasets:
 * - **`countryData`**: Detailed information about countries (from `./countries/index.js`).
 * - **`educationLevels`**: A list of common education levels (from `./education/index.js`).
 * - **`initialUser`**: A template/default object structure for new users (from `./initials/index.js`).
 * - **`languageData`**: Information about various world languages (from `./languages/index.js`).
 * - **`translationsData`**: Key-value translations for UI strings (from `./translations/index.js`, originally `words`).
 * - **`wikiData`**: Placeholder data for future Wikipedia-related information (from `./wiki/index.js`).
 *
 * Each data module contains JSDoc descriptions of its specific data structure.
 * Logging for this index file is handled by `@daitanjs/development`.
 */
import { getLogger } from '@daitanjs/development';

const knowledgeIndexLogger = getLogger('daitan-knowledge-index');

knowledgeIndexLogger.debug('Exporting DaitanJS Knowledge module datasets...');

// --- Country Data ---
// JSDoc for countryData structure is in `src/countries/index.js`.
export { countryData } from './countries/index.js';

// --- Education Levels ---
// JSDoc for educationLevels structure is in `src/education/index.js`.
export { educationLevels } from './education/index.js';

// --- Initial Object Templates (e.g., for new users) ---
// JSDoc for initialUser structure is in `src/initials/index.js`.
export { initialUser } from './initials/index.js';

// --- Language Data ---
// JSDoc for languageData structure is in `src/languages/index.js`.
export { languageData } from './languages/index.js';

// --- UI Translations Data ---
// JSDoc for translationsData (originally `words`) structure is in `src/translations/index.js`.
// Aliasing `words` to `translationsData` for better clarity at the package export level.
export { words as translationsData } from './translations/index.js';

// --- Wikipedia Placeholder Data ---
// JSDoc for wikiData structure is in `src/wiki/index.js`.
export { wikiData } from './wiki/index.js';

// --- Future Utility Functions ---
// If this package were to include utility functions for working with its data
// (e.g., `getCountryByCode(code)`, `getLanguageName(code, targetLang)`),
// they would be exported here from their respective utility modules.
// Example:
// export { findCountryByISOName } from './countries/utils.js'; // (If such a util existed)
// export { getLanguageLocalName } from './languages/utils.js'; // (If such a util existed)

knowledgeIndexLogger.info(
  'DaitanJS Knowledge module datasets and utilities exported.'
);
