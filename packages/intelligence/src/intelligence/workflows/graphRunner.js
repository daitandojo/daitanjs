// intelligence/src/intelligence/workflows/graphRunner.js
/**
 * @file Contains the factory function for creating DaitanJS graph runners.
 * @module @daitanjs/intelligence/workflows/graphRunner
 *
 * @description
 * This module provides `createGraphRunner`, a factory for executing compiled LangGraphs.
 * The runner handles invocation, advanced streaming of state updates with structured
 * event types, detailed logging, and robust error handling, making it a cornerstone
 * for building observable and debuggable agentic workflows.
 */
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanOperationError,
  DaitanConfigurationError,
} from '@daitanjs/error';

/**
 * @typedef {import('@langchain/langgraph').CompiledGraph} CompiledGraph
 * @typedef {import('@langchain/core/callbacks/manager').Callbacks} Callbacks
 * @typedef {{ configurable?: Record<string, any>, callbacks?: Callbacks, recursionLimit?: number, [key: string]: any }} LangGraphRuntimeConfig
 */

/**
 * @typedef {'node_start' | 'node_finish' | 'stream_end' | 'error'} GraphStreamEventType
 */

/**
 * @typedef {Object} GraphStreamEvent
 * @property {GraphStreamEventType} event - The type of the streaming event.
 * @property {string} node - The name of the node the event relates to.
 * @property {any} [data] - The data payload of the event (e.g., state changes).
 * @property {object} [state] - A snapshot of the accumulated graph state.
 */

/**
 * @typedef {Object} CreateGraphRunnerOptions
 * @property {(event: GraphStreamEvent) => void | Promise<void>} [onStateUpdate] - Callback for each streamed state event.
 * @property {boolean} [verbose] - Verbosity for this specific runner instance. Overrides ConfigManager settings.
 * @property {import('winston').Logger} [loggerInstance] - Optional logger instance for the runner.
 */

/**
 * Creates a runner function for a pre-compiled LangGraph.
 *
 * @param {CompiledGraph} compiledGraph - The compiled LangGraph instance.
 * @param {CreateGraphRunnerOptions} [options={}] - Options for the runner.
 * @returns {(initialInputs: object, runtimeConfig?: LangGraphRuntimeConfig) => Promise<object>} An async function that executes the graph.
 */
export const createGraphRunner = (compiledGraph, options = {}) => {
  if (
    !compiledGraph ||
    typeof compiledGraph.invoke !== 'function' ||
    typeof compiledGraph.stream !== 'function'
  ) {
    throw new DaitanConfigurationError(
      'Invalid compiledGraph provided. Must be a LangGraph compiled graph instance.'
    );
  }

  const {
    onStateUpdate,
    verbose: runnerSpecificVerbose,
    loggerInstance,
  } = options;

  const currentLogger = loggerInstance || getLogger('daitan-graph-runner');
  const configManager = getConfigManager();
  const effectiveVerbose =
    runnerSpecificVerbose !== undefined
      ? runnerSpecificVerbose
      : configManager.get('DEBUG_LANGGRAPH', false) ||
        configManager.get('DEBUG_INTELLIGENCE', false);

  const enableStreaming = typeof onStateUpdate === 'function';

  /**
   * Executes the compiled LangGraph.
   * @param {object} initialInputs - The initial state for the graph.
   * @param {LangGraphRuntimeConfig} [runtimeConfig={}] - LangGraph runtime configuration.
   * @returns {Promise<object>} The final state of the graph.
   */
  return async (initialInputs, runtimeConfig = {}) => {
    const graphId =
      compiledGraph?.graph?.id || compiledGraph?.id || 'UnnamedGraph';
    const threadId =
      runtimeConfig?.configurable?.thread_id || `default-thread-${Date.now()}`;
    const runIdentifier = `${graphId}-run-${String(threadId).substring(0, 12)}`;

    const logContext = { graphId, threadId, runIdentifier };
    const overallStartTime = Date.now();

    currentLogger.info(`Graph run: START for "${runIdentifier}"`, {
      ...logContext,
      initialInputKeys: Object.keys(initialInputs || {}),
      streaming: enableStreaming,
    });

    try {
      if (enableStreaming) {
        let accumulatedState = { ...(initialInputs || {}) };

        const stream = await compiledGraph.stream(initialInputs, runtimeConfig);
        let lastNode = null;

        for await (const chunk of stream) {
          const nodeName = Object.keys(chunk || {})[0];
          if (nodeName && nodeName !== lastNode) {
            if (lastNode) {
              await onStateUpdate({
                event: 'node_finish',
                node: lastNode,
                state: accumulatedState,
              });
            }
            await onStateUpdate({
              event: 'node_start',
              node: nodeName,
              state: accumulatedState,
            });
            lastNode = nodeName;
          }

          if (typeof chunk === 'object' && chunk !== null && chunk[nodeName]) {
            accumulatedState = { ...accumulatedState, ...chunk[nodeName] };
          }

          if (effectiveVerbose) {
            currentLogger.debug(`Graph stream chunk for "${runIdentifier}":`, {
              ...logContext,
              node: nodeName,
              data: chunk[nodeName],
            });
          }
        }

        await onStateUpdate({
          event: 'stream_end',
          node: 'END',
          state: accumulatedState,
        });

        currentLogger.info(`Graph stream: COMPLETED for "${runIdentifier}".`, {
          ...logContext,
          durationMs: Date.now() - overallStartTime,
        });

        // Invoke is still needed to get the absolute final, merged state reliably.
        return await compiledGraph.invoke(initialInputs, runtimeConfig);
      } else {
        // Non-streaming execution
        const finalOutputState = await compiledGraph.invoke(
          initialInputs,
          runtimeConfig
        );
        currentLogger.info(`Graph run: SUCCESS for "${runIdentifier}".`, {
          ...logContext,
          durationMs: Date.now() - overallStartTime,
        });
        return finalOutputState;
      }
    } catch (error) {
      currentLogger.error(
        `Graph run: FAILED for "${runIdentifier}". Error: ${error.message}`,
        {
          ...logContext,
          durationMs: Date.now() - overallStartTime,
          errorName: error.name,
          errorStack: effectiveVerbose ? error.stack : undefined,
        }
      );
      if (enableStreaming) {
        await onStateUpdate({
          event: 'error',
          node: 'ERROR',
          data: { message: error.message, name: error.name },
          state: {},
        });
      }
      throw new DaitanOperationError(
        `Graph run for "${runIdentifier}" failed: ${error.message}`,
        logContext,
        error
      );
    }
  };
};
