// intelligence/src/intelligence/workflows/index.js
/**
 * @file Main entry point for AI agentic workflows using LangGraph.
 * @module @daitanjs/intelligence/workflows
 *
 * @description
 * This module provides tools and pre-defined graphs for creating and running
 * complex, multi-step AI workflows based on LangChain's LangGraph library.
 * It abstracts away the complexity of agent creation, offering high-level,
 * powerful preset workflows.
 *
 * Key Exports:
 * - **High-Level Preset Workflows**:
 *   - `runDeepResearchAgent`: A multi-hop, "plan-and-execute" agent that can answer complex questions requiring several steps of reasoning and searching. This is the most powerful research tool.
 *   - `searchAndUnderstand`: A powerful one-shot function to get a direct answer to a simple query from the web, with sources.
 *   - `runAutomatedResearchWorkflow`: An agent that researches a topic and generates a structured report.
 *
 * - **Graph Management & Execution**:
 *   - `DaitanLangGraph`: A wrapper around LangGraph's `StateGraph` to simplify graph definition.
 *   - `createGraphRunner`: A factory function that takes a compiled graph and returns an async function to execute it.
 *
 * - **Lower-Level Agentic Workflow Graphs**:
 *   - Factories like `createPlanAndExecuteAgentGraph` and `createReActAgentGraph` for building custom agents from scratch.
 */
import { getLogger } from '@daitanjs/development';

const workflowsIndexLogger = getLogger('daitan-workflows-index');

workflowsIndexLogger.debug(
  'Exporting DaitanJS Intelligence Workflows module...'
);

// --- High-Level Preset Workflows ---
export { runDeepResearchAgent } from './presets/deepResearchAgent.js';
export { searchAndUnderstand } from './presets/searchAndUnderstand.js';
export { runAutomatedResearchWorkflow } from './presets/automatedResearchAgent.js';

// --- Core LangGraph Management and Execution ---
export { DaitanLangGraph, createChatAgentState } from './langGraphManager.js';
export { createGraphRunner } from './graphRunner.js';

// --- Pre-defined Agentic Workflow Graph Factories ---
export {
  createParticipantAgentGraph,
  participantAgentStateSchema,
} from './participantAgentGraph.js';
export {
  createPlanAndExecuteAgentGraph,
  planAndExecuteAgentStateSchema,
} from './planAndExecuteAgentGraph.js';
export {
  createReActAgentGraph,
  reactAgentStateSchema,
} from './reactWithReflectionAgentGraph.js';

workflowsIndexLogger.info(
  'DaitanJS Intelligence Workflows module exports ready.'
);
