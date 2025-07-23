// intelligence/src/orchestration/daitanOrchestrator.js
/**
 * @file High-level orchestrator facade for the DaitanJS Intelligence library.
 * @module @daitanjs/orchestration/daitanOrchestrator
 *
 * @description
 * The DaitanOrchestrator provides a simplified, unified interface to the most common
 * and powerful functionalities of the @daitanjs/intelligence package. It is designed
 * to be the primary entry point for developers, abstracting away the underlying
 * complexity of service instantiation, graph compilation, and state management.
 * It now includes direct access to the most powerful research agent.
 */
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { LLMService } from '../services/llmService.js';
import {
  askWithRetrieval,
  loadAndEmbedFile,
  printStoreStats,
  runToolCallingAgent,
  runDeepResearchAgent, // NEW: Direct import of the best research agent
  getDefaultTools,
  createGraphRunner,
  createPlanAndExecuteAgentGraph,
  createReActAgentGraph,
  runAutomatedResearchWorkflow,
  InMemoryChatMessageHistoryStore,
} from '../intelligence/index.js'; // Use the main barrel file
import { HumanMessage } from '@langchain/core/messages';

const logger = getLogger('daitan-orchestrator');

/**
 * @typedef {import('../services/llmService.js').LLMServiceConfig} LLMServiceConfig
 * @typedef {import('../intelligence/rag/interfaces.js').AskWithRetrievalOptions} AskWithRetrievalOptions
 * @typedef {import('../intelligence/rag/interfaces.js').LoadAndEmbedOptions} LoadAndEmbedOptions
 * @typedef {import('../intelligence/agents/agentExecutor.js').RunDaitanAgentParams} RunToolCallingAgentParams
 * @typedef {import('../intelligence/workflows/planAndExecuteAgentGraph.js').PlanAndExecuteAgentState} PlanAndExecuteAgentState
 * @typedef {import('../intelligence/workflows/reactWithReflectionAgentGraph.js').ReActAgentState} ReActAgentState
 * @typedef {import('../intelligence/workflows/presets/automatedResearchAgent.js').ResearchState} AutomatedResearchState
 * @typedef {import('../intelligence/workflows/graphRunner.js').CreateGraphRunnerOptions} CreateGraphRunnerOptions
 */

export class DaitanOrchestrator {
  /**
   * @param {Object} [orchestratorConfig={}]
   * @param {LLMServiceConfig} [orchestratorConfig.llmServiceConfig] - Configuration for the internal LLMService.
   * @param {LLMService} [orchestratorConfig.llmServiceInstance] - An existing LLMService instance.
   * @param {boolean} [orchestratorConfig.verboseGlobal] - Global verbosity for orchestrator operations.
   */
  constructor(orchestratorConfig = {}) {
    const configManager = getConfigManager();
    this.verbose =
      orchestratorConfig.verboseGlobal ??
      (configManager.get('DEBUG_ORCHESTRATOR', false) ||
        configManager.get('DEBUG_INTELLIGENCE', false));

    this.llmService =
      orchestratorConfig.llmServiceInstance instanceof LLMService
        ? orchestratorConfig.llmServiceInstance
        : new LLMService({
            ...orchestratorConfig.llmServiceConfig,
            verbose: this.verbose,
          });

    this.compiledGraphs = {};
    this.defaultHistoryStore = new InMemoryChatMessageHistoryStore();

    logger.info('DaitanOrchestrator fully initialized.');
  }

  /**
   * Direct call to the underlying LLM service.
   * @param {import('../services/llmService.js').GenerateIntelligenceParams} params
   * @returns {Promise<import('../intelligence/core/llmOrchestrator.js').GenerateIntelligenceResult<any>>}
   */
  async llmCall(params) {
    if (this.verbose) {
      logger.info('Orchestrator: Initiating direct LLM call.', {
        summary: params.metadata?.summary,
      });
    }
    // The LLMService's generate method handles merging defaults correctly.
    return this.llmService.generate(params);
  }

  /**
   * Performs a RAG query with advanced options.
   * @param {string} query - The user's query.
   * @param {AskWithRetrievalOptions} [ragOptions] - Options for askWithRetrieval.
   * @returns {Promise<import('../intelligence/rag/retrieval.js').RetrievalResult>}
   */
  async ragQuery(query, ragOptions = {}) {
    if (this.verbose)
      logger.info(
        `Orchestrator: Initiating RAG query for: "${query.substring(
          0,
          50
        )}..."`,
        { collection: ragOptions.collectionName }
      );
    return askWithRetrieval(query, {
      localVerbose: this.verbose,
      ...ragOptions,
    });
  }

  /**
   * Loads and embeds a file into the vector store.
   * @param {string} filePath - Path to the file.
   * @param {Object} [customMetadata={}] - Custom metadata to add.
   * @param {LoadAndEmbedOptions} [embedOptions={}] - Options for loadAndEmbedFile.
   * @returns {Promise<object>} An object indicating success and embedding stats.
   */
  async embedFile(filePath, customMetadata = {}, embedOptions = {}) {
    if (this.verbose)
      logger.info(
        `Orchestrator: Initiating file embedding for: "${filePath}"`,
        { collection: embedOptions.collectionName }
      );
    return loadAndEmbedFile({
      filePath,
      customMetadata,
      options: { localVerbose: this.verbose, ...embedOptions },
    });
  }

  /**
   * Prints statistics for a RAG collection.
   * @param {string} [collectionName] - Name of the collection.
   * @returns {Promise<void>}
   */
  async getRagStats(collectionName) {
    if (this.verbose)
      logger.info(
        `Orchestrator: Requesting RAG stats for collection: "${
          collectionName || 'default'
        }"`
      );
    return printStoreStats({ collectionName, localVerbose: this.verbose });
  }

  /**
   * Runs the most advanced, multi-step research agent to answer a complex query.
   * @param {string} query - The complex question or research topic.
   * @param {import('../intelligence/workflows/presets/deepResearchAgent.js').runDeepResearchAgent} options - Options for the deep research agent, including `thinkingLevel`, `collectionName`, `onProgress`, and `chatHistory`.
   * @returns {Promise<{finalAnswer: string, sources: string[], plan: any[]}>} The comprehensive answer and its sources.
   */
  async research(query, options) {
    if (this.verbose) {
      logger.info(
        `Orchestrator: Initiating deep research for topic: "${query}"`
      );
    }
    // Directly call the powerful, imported research agent
    return runDeepResearchAgent(query, options);
  }

  /**
   * Runs a general-purpose tool-using agent.
   * @param {RunToolCallingAgentParams} params - The parameters for the agent run.
   * @returns {Promise<Object>}
   */
  async runToolAgent(params) {
    if (this.verbose)
      logger.info(`Orchestrator: Running tool-calling Agent.`, {
        input: params.input.substring(0, 50) + '...',
        sessionId: params.sessionId,
      });

    return runToolCallingAgent({
      historyStore: this.defaultHistoryStore,
      verbose: this.verbose,
      ...params,
    });
  }

  // The more granular agent runners below are kept for advanced use cases or backward compatibility.
  // The top-level `research` method is now the recommended entry point for research tasks.

  /**
   * Runs the Plan-and-Execute agent graph.
   * @param {string} query - The user's original query.
   * @param {object} [options={}] - Options for the run.
   * @returns {Promise<PlanAndExecuteAgentState>}
   */
  async runPlanAndExecuteAgent(query, options = {}) {
    const { tools, initialState = {}, sessionId, onStateUpdate } = options;
    const effectiveSessionId = sessionId || `plan-exec-${Date.now()}`;
    if (this.verbose)
      logger.info(
        `Orchestrator: Running Plan-and-Execute Agent for query: "${query.substring(
          0,
          50
        )}..."`,
        { sessionId: effectiveSessionId }
      );

    if (!this.compiledGraphs.planAndExecute) {
      this.compiledGraphs.planAndExecute = await createPlanAndExecuteAgentGraph(
        this.llmService,
        tools || getDefaultTools()
      );
      logger.info('Compiled Plan-and-Execute graph for the first time.');
    }

    const runner = createGraphRunner(this.compiledGraphs.planAndExecute, {
      verbose: this.verbose,
      onStateUpdate,
    });
    const effectiveTools = tools || getDefaultTools();

    const finalInitialState = {
      originalQuery: query,
      inputMessage: new HumanMessage(query),
      llmServiceInstance: this.llmService,
      toolsMap: effectiveTools.reduce(
        (map, tool) => ({ ...map, [tool.name]: tool }),
        {}
      ),
      verbose: this.verbose,
      ...initialState,
    };
    return runner(finalInitialState, {
      configurable: { thread_id: effectiveSessionId },
    });
  }
}
