// intelligence/src/intelligence/tools/daitanTools.js
/**
 * @file Aggregates and exports all tools that wrap DaitanJS-specific functionalities.
 * @module @daitanjs/intelligence/tools/daitanTools
 *
 * @description
 * This module serves as a central registry for all tools that provide an agentic
 * interface to the various packages within the DaitanJS ecosystem. This keeps the
 * main tools/index.js file cleaner and more organized.
 */

// User & Data Tools
export { userManagementTool } from './userManagementTool.js';
export { csvQueryTool } from './csvQueryTool.js';

// Payment Tools
export { createPaymentIntentTool } from './createPaymentIntentTool.js';

// Media & Senses Tools
export { youtubeSearchTool } from './youtubeSearchTool.js';
export { processYoutubeAudioTool } from './processYoutubeAudioTool.js';
export { imageGenerationTool } from './imageGenerationTool.js';

// Note: The general-purpose tools like calculator, wikipedia_search, etc.,
// are kept in their own files and are not aggregated here, as this file is
// specifically for tools that wrap other DaitanJS packages.