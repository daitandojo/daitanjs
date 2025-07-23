// intelligence/src/intelligence/prompts/index.js
/**
 * @file Re-exports prompt management functionalities for the @daitanjs/intelligence package.
 * @module @daitanjs/intelligence/prompts
 *
 * @description
 * This index file serves as the public interface for the prompt management system.
 * It re-exports all key functions from `promptManager.js`, allowing applications to
 * register, retrieve, format, and manage versions of prompt templates used for
 * LLM interactions.
 *
 * By using this centralized prompt management, applications can:
 * - Maintain a versioned library of prompts.
 * - Easily switch between prompt versions (e.g., for A/B testing or rollbacks).
 * - Standardize prompt creation and formatting.
 * - Abstract the underlying LangChain prompt template objects.
 *
 * JSDoc for the exported functions can be found in `src/intelligence/prompts/promptManager.js`.
 */

// Re-export all named exports from promptManager.js
export {
  registerPrompt,
  getPromptTemplate,
  getPromptMetadata,
  formatPrompt,
  listAllPrompts, // Renamed from listPrompts for clarity
  setLatestPromptVersion,
  clearAllPrompts,
  // getPromptEvaluationMetrics, // If the conceptual evaluation metric function was to be exported
} from './promptManager.js';

// No default export is typically needed for a module that primarily re-exports named utilities.
