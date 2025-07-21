// src/index.js
/**
 * @file Main public entry point for the @daitanjs/intelligence package.
 * @module @daitanjs/intelligence
 */
import { getLogger } from '@daitanjs/development';

const mainIndexLogger = getLogger('daitan-intelligence-main-index');

mainIndexLogger.debug(
  'Initializing DaitanJS Intelligence main package exports...'
);

// --- Core Abstractions & Services ---
export { DaitanOrchestrator } from './orchestration/daitanOrchestrator.js';
export { LLMService } from './services/llmService.js';

// --- Configuration Management ---
export {
  getConfigManager,
  initializeConfigManager,
  DaitanConfigManagerClass,
} from '@daitanjs/config';

// --- Core Intelligence & Utilities ---
export {
  generateIntelligence,
  generateEmbedding,
  askWithRetrieval,
  createRagChatInstance,
  loadAndEmbedFile,
  printStoreStats,
  getVectorStore,
  vectorStoreCollectionExists,
  checkChromaConnection,
  runToolCallingAgent,
  runGraphAgent,
  runDeepResearchAgent,
  runAutomatedResearchWorkflow,
  searchAndUnderstand,
  // --- New Export for Specialized Search ---
  searchNews,
  searchGeneralWeb,
  searchAcademic,
  BaseAgent,
  ChoreographerAgent,
  CoachAgent,
  OpeningPhraseAgent,
  ParticipantAgent,
  createDaitanTool,
  getDefaultTools,
  getDaitanPlatformTools,
  BaseTool,
  DaitanLangGraph,
  createGraphRunner,
  estimateLlmCost,
  countTokens,
  countTokensForMessages,
  checkOllamaStatus,
} from './intelligence/index.js';

// --- Caching ---
export {
  getCache,
  generateCacheKey,
  clearCache,
} from './caching/cacheManager.js';

// --- Memory Management ---
export { InMemoryChatMessageHistoryStore } from './memory/inMemoryChatHistoryStore.js';

// --- Language Services ---
export { translate } from './language/index.js';

mainIndexLogger.info(
  'DaitanJS Intelligence package main exports configured and ready.'
);
