// intelligence/src/intelligence/index.js
/**
 * @file Main entry point for core AI/LLM functionalities in the @daitanjs/intelligence package.
 * @module @daitanjs/intelligence
 */
import { getLogger } from '@daitanjs/development';

const intelligenceIndexLogger = getLogger('daitan-intelligence-index');

intelligenceIndexLogger.debug(
  'Initializing DaitanJS Intelligence module exports...'
);

// --- Core LLM, Embedding, and Factory Exports ---
export { generateIntelligence } from './core/llmOrchestrator.js';
export { generateEmbedding } from './core/embeddingGenerator.js';
export { createDaitanTool } from './core/toolFactory.js';

// --- Prompt Management ---
export * from './prompts/index.js';

// --- RAG (Retrieval Augmented Generation) ---
export * from './rag/index.js';

// --- Metadata Extraction ---
export * from './metadata/index.js';

// --- Specialized Search (New Export) ---
export {
  searchNews,
  searchGeneralWeb,
  searchAcademic,
} from './search/specializedSearch.js';

// --- Tool Exports ---
export {
  getDefaultTools,
  getDaitanPlatformTools,
} from './tools/tool-registries.js';
export { BaseTool } from './tools/baseTool.js';
export { calculatorTool } from './tools/calculatorTool.js';
export { wikipediaSearchTool } from './tools/wikipediaSearchTool.js';
export { cliTool } from './tools/cliTool.js';
export { webSearchTool } from './tools/webSearchTool.js';
export { ragTool } from './tools/ragTool.js';
export { userManagementTool } from './tools/userManagementTool.js';
export { csvQueryTool } from './tools/csvQueryTool.js';
export { createPaymentIntentTool } from './tools/createPaymentIntentTool.js';
export { youtubeSearchTool } from './tools/youtubeSearchTool.js';
export { processYoutubeAudioTool } from './tools/processYoutubeAudioTool.js';
export { imageGenerationTool } from './tools/imageGenerationTool.js';
export {
  searchGmailTool,
  readEmailContentTool,
  createGmailDraftTool,
} from './tools/gmailTools.js';
export { calendarTool } from './tools/calendarTool.js';
export {
  createGoogleDocTool,
  createGoogleSheetTool,
} from './tools/googleDriveTools.js';

// --- Agent Exports ---
export { runGraphAgent } from './agents/agentRunner.js';
export { runToolCallingAgent } from './agents/agentExecutor.js';
export { BaseAgent } from './agents/baseAgent.js';
export * from './agents/prompts/index.js';
export * from './agents/chat/index.js';

// --- Workflow Exports ---
export * from './workflows/index.js';

// --- Memory Management ---
export { InMemoryChatMessageHistoryStore } from '../memory/inMemoryChatHistoryStore.js';

// --- Core Utilities (re-exported for convenience) ---
export { estimateLlmCost } from './core/llmPricing.js';
export { countTokens, countTokensForMessages } from './core/tokenUtils.js';
export { checkOllamaStatus } from './core/ollamaUtils.js';
export {
  EXPERT_MODELS,
  getExpertModelDefinition,
  getDefaultExpertProfile,
} from './core/expertModels.js';

intelligenceIndexLogger.info(
  'DaitanJS Intelligence module main exports configured and ready.'
);
