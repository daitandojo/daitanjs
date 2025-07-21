// intelligence/src/intelligence/core/index.js
/**
 * @file Main entry point for core intelligence functionalities in @daitanjs/intelligence.
 * @module @daitanjs/intelligence/core
 *
 * @description
 * This module serves as the central export point for core components related to
 * Large Language Model (LLM) interactions and embedding generation. It aggregates
 * key functionalities from submodules within the `core` directory.
 *
 * Core Exports:
 * - **LLM Orchestration (`llmOrchestrator.js`)**:
 *   - `generateIntelligence`: The primary function for making calls to LLMs.
 *
 * - **Embedding Generation (`embeddingGenerator.js`)**:
 *   - `generateEmbedding`: Function to create text embeddings.
 *
 * - **Provider & Model Configuration (`providerConfigs.js`, `expertModels.js`)**:
 *   - `PROVIDER_CLASSES`, `resolveProviderConfig`, `EXPERT_MODELS`, etc.
 *
 * - **Token Utilities (`tokenUtils.js`, `llmPricing.js`)**:
 *   - `countTokens`, `estimateLlmCost`, and the `PROVIDER_MODEL_PRICING` data.
 *
 * - **Ollama Utilities (`ollamaUtils.js`)**:
 *   - `checkOllamaStatus`: Checks the reachability of an Ollama server instance.
 */

import { getLogger } from '@daitanjs/development';

const coreIndexLogger = getLogger('daitan-intelligence-core-index');
coreIndexLogger.debug(
  'Exporting DaitanJS Intelligence Core functionalities...'
);

// --- Main LLM Orchestration and Embedding Generation ---
export { generateIntelligence } from './llmOrchestrator.js';
export { generateEmbedding } from './embeddingGenerator.js';

// --- Provider, Model, and Expert Configuration ---
export { PROVIDER_CLASSES, resolveProviderConfig } from './providerConfigs.js';
export {
  EXPERT_MODELS,
  getExpertModelDefinition,
  getDefaultExpertProfile,
  DEFAULT_EXPERT_PROFILE_NAME,
} from './expertModels.js';

// --- Token Counting & Pricing Utilities ---
// This is the key line. It ensures PROVIDER_MODEL_PRICING is correctly exported.
export { estimateLlmCost, PROVIDER_MODEL_PRICING } from './llmPricing.js';
export { countTokens, countTokensForMessages } from './tokenUtils.js';

// --- Ollama Utilities ---
export { checkOllamaStatus } from './ollamaUtils.js';

coreIndexLogger.info('DaitanJS Intelligence Core module exports ready.');