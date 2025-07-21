// intelligence/src/intelligence/agents/agentRunner.js
/**
 * @file Provides a simplified, high-level function to run complex, graph-based agents.
 * @module @daitanjs/intelligence/agents/agentRunner
 *
 * @description
 * This module exports the `runGraphAgent` function, which acts as a user-friendly "one-shot"
 * interface for executing complex agentic workflows like Plan-and-Execute or ReAct.
 * It abstracts away the boilerplate of instantiating the LLMService, creating the agent graph,
 * managing the graph runner, and constructing the initial state.
 */
import { HumanMessage } from '@langchain/core/messages';
import { getLogger } from '@daitanjs/development';
import { LLMService } from '../../services/llmService.js';
// CORRECTED: Import getDefaultTools from its new, isolated location
import { getDefaultTools } from '../tools/tool-registries.js';
import { createGraphRunner } from '../workflows/graphRunner.js';
import { createPlanAndExecuteAgentGraph } from '../workflows/planAndExecuteAgentGraph.js';
import { createReActAgentGraph } from '../workflows/reactWithReflectionAgentGraph.js';
import { DaitanInvalidInputError } from '@daitanjs/error';

const agentRunnerLogger = getLogger('daitan-agent-runner');

/**
 * @typedef {import('@langchain/core/tools').BaseTool} BaseTool
 */

/**
 * @typedef {Object} RunGraphAgentParams
 * @property {string} query - The user's query or task for the agent.
 * @property {'default' | 'research' | 'react'} [agentType='default'] - The type of agent workflow.
 * @property {BaseTool[]} [tools] - An array of tools for the agent. Defaults to `getDefaultTools()`.
 * @property {string} [llmTarget] - Optional LLM target for the agent's LLMService.
 * @property {string} [sessionId] - Optional session ID for stateful conversations.
 * @property {boolean} [verbose=false] - Enable verbose logging for the entire agent run.
 */

/**
 * @typedef {Object} AgentRunResult
 * @property {string | null} finalAnswer - The final answer produced by the agent.
 * @property {object} finalState - The complete final state object of the LangGraph execution.
 */

const compiledGraphCache = new Map();

/**
 * A simplified, high-level function to run a complex, graph-based agentic workflow.
 *
 * @public
 * @async
 * @param {RunGraphAgentParams} params - The parameters for the agent run.
 * @returns {Promise<AgentRunResult>} The result of the agent's execution.
 */
export const runGraphAgent = async ({
  query,
  agentType = 'default',
  tools,
  llmTarget,
  sessionId,
  verbose = false,
}) => {
  const callId = `runGraphAgent-${agentType}-${Date.now().toString(36)}`;
  agentRunnerLogger.info(
    `[${callId}] runGraphAgent: Initiating agent workflow.`,
    {
      query: query.substring(0, 70),
      agentType,
      sessionId,
    }
  );

  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new DaitanInvalidInputError(
      'A non-empty `query` string is required to run an agent.'
    );
  }

  const llmService = new LLMService({ target: llmTarget, verbose });
  const effectiveTools = tools || getDefaultTools();

  const toolsMap = effectiveTools.reduce((map, tool) => {
    if (tool?.name) map[tool.name] = tool;
    return map;
  }, {});

  const effectiveSessionId =
    sessionId || `agent-session-${Date.now().toString(36)}`;
  let compiledGraph;
  let initialState;

  if (compiledGraphCache.has(agentType)) {
    compiledGraph = compiledGraphCache.get(agentType);
    if (verbose)
      agentRunnerLogger.debug(
        `[${callId}] Using cached compiled graph for agent type: "${agentType}"`
      );
  } else {
    agentRunnerLogger.info(
      `[${callId}] Compiling new graph for agent type: "${agentType}"`
    );
    if (agentType === 'react') {
      compiledGraph = await createReActAgentGraph(llmService, effectiveTools);
    } else {
      compiledGraph = await createPlanAndExecuteAgentGraph(
        llmService,
        effectiveTools
      );
    }
    compiledGraphCache.set(agentType, compiledGraph);
  }

  const graphRunner = createGraphRunner(compiledGraph, { verbose });

  if (agentType === 'react') {
    initialState = {
      inputMessage: new HumanMessage(query),
      llmServiceInstance: llmService,
      toolsMap: toolsMap,
      verbose: verbose,
    };
  } else {
    initialState = {
      inputMessage: new HumanMessage(query),
      originalQuery: query,
      llmServiceInstance: llmService,
      toolsMap: toolsMap,
      verbose: verbose,
    };
  }

  agentRunnerLogger.info(`[${callId}] Invoking agent graph runner...`);
  const finalState = await graphRunner(initialState, {
    configurable: { thread_id: effectiveSessionId },
  });

  agentRunnerLogger.info(`[${callId}] Agent workflow completed.`);
  return {
    finalAnswer: finalState.finalAnswer || null,
    finalState: finalState,
  };
};
