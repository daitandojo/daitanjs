// intelligence/src/intelligence/agents/baseAgent.js
import { getLogger } from '@daitanjs/development';
import { LLMService } from '../../services/llmService.js';
import {
  DaitanConfigurationError,
  DaitanOperationError,
} from '@daitanjs/error';

const baseAgentLogger = getLogger('daitan-base-agent');

/**
 * @typedef {import('../../services/llmService.js').LLMUsageInfo} LLMUsageInfo
 * @typedef {import('../tools/toolInterface.js').ITool} DaitanITool
 * @typedef {import('@langchain/core/tools').Tool} LangChainTool
 */

/**
 * @typedef {Object} AgentContext
 * Provides context for a DaitanJS custom agent's operation.
 * This is a generic context; specific agent implementations may extend it.
 *
 * @property {LLMService} llmService - An instance of LLMService for the agent to use.
 * @property {any} [payload] - Any primary input data or payload for the agent's task.
 * @property {Record<string, DaitanITool | LangChainTool>} [tools] - Available tools for the agent, keyed by name.
 * @property {object} [config] - Agent-specific runtime configuration options.
 * @property {string} [callId] - An optional unique identifier for the agent's current run/invocation.
 */

/**
 * @typedef {Object} AgentResponse
 * Represents the output of a DaitanJS custom agent's action.
 *
 * @property {any} output - The primary output of the agent (e.g., a string, a JSON object, structured data).
 * @property {string} [summary] - A brief summary of the agent's action or decision.
 * @property {LLMUsageInfo | null} [llmUsage] - LLM usage information if the agent directly used an LLM.
 * @property {any} [rawLLMResponse] - The raw response from the LLM, if applicable and needed for debugging.
 * @property {string | null} [error] - Error message string if the agent encountered an issue.
 * @property {boolean} success - True if the agent completed its task successfully, false otherwise.
 * @property {object} [nextStateChanges] - Suggested changes to a larger state or context, if applicable (e.g., for workflow integration).
 */

/**
 * Abstract base class for custom DaitanJS agents.
 * This class provides a common structure for agents that might not use
 * LangChain's AgentExecutor or LangGraph directly, but still require access
 * to LLM services and tools.
 */
export class BaseAgent {
  /**
   * The unique name of the agent.
   * @type {string}
   */
  name;

  /**
   * A brief description of what the agent does.
   * @type {string}
   */
  description;

  /**
   * An instance of LLMService.
   * @type {LLMService}
   * @protected
   */
  llmService;

  /**
   * Available tools for the agent.
   * @type {Record<string, DaitanITool | LangChainTool>}
   * @protected
   */
  tools;

  /**
   * Logger instance for this agent.
   * @type {import('winston').Logger}
   * @protected
   */
  logger;

  /**
   * @param {string} name - The unique name of the agent.
   * @param {string} description - A brief description of what the agent does.
   * @param {LLMService} llmServiceInstance - An instance of LLMService.
   * @param {Record<string, DaitanITool | LangChainTool>} [toolsMap={}] - Available tools, keyed by name.
   * @throws {DaitanConfigurationError} If name, description, or llmServiceInstance is invalid.
   */
  constructor(name, description, llmServiceInstance, toolsMap = {}) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new DaitanConfigurationError(
        'Agent name must be a non-empty string.'
      );
    }
    if (
      !description ||
      typeof description !== 'string' ||
      !description.trim()
    ) {
      throw new DaitanConfigurationError(
        'Agent description must be a non-empty string.'
      );
    }
    if (!(llmServiceInstance instanceof LLMService)) {
      throw new DaitanConfigurationError(
        'An instance of LLMService must be provided to BaseAgent.'
      );
    }

    this.name = name;
    this.description = description;
    this.llmService = llmServiceInstance;
    this.tools = toolsMap;
    this.logger = getLogger(`daitan-agent-${this.name}`); // Agent-specific logger

    this.logger.info(`Agent "${this.name}" initialized.`);
    if (Object.keys(this.tools).length > 0) {
      this.logger.debug(
        `Agent "${this.name}" initialized with tools:`,
        Object.keys(this.tools)
      );
    }
  }

  /**
   * The main method for an agent to perform its action based on the given context.
   * This method MUST be implemented by subclasses.
   *
   * @abstract
   * @param {AgentContext} context - The context for the agent's operation.
   * @returns {Promise<AgentResponse>} The result of the agent's action.
   */
  async run(context) {
    this.logger.error(
      `Agent "${this.name}": run(context) method not implemented. Subclasses must override this method.`,
      { contextPayloadKeys: Object.keys(context?.payload || {}) }
    );
    throw new DaitanOperationError(
      'Method "run(context)" not implemented by agent subclass.',
      { agentName: this.name }
    );
  }

  /**
   * Utility to create a standard success response for this agent.
   * @param {any} output - The primary output of the agent.
   * @param {string} [summary] - Summary of the action.
   * @param {LLMUsageInfo | null} [llmUsage=null] - LLM usage details, if any.
   * @param {any} [rawLLMResponse] - Raw LLM response, if applicable.
   * @param {object} [nextStateChanges] - Suggested state changes.
   * @returns {AgentResponse}
   */
  createSuccessResponse(
    output,
    summary,
    llmUsage = null,
    rawLLMResponse = undefined,
    nextStateChanges = undefined
  ) {
    return {
      output,
      summary:
        summary || `Agent "${this.name}" completed its task successfully.`,
      llmUsage,
      rawLLMResponse,
      error: null,
      success: true,
      nextStateChanges,
    };
  }

  /**
   * Utility to create a standard error response for this agent.
   * @param {string} errorMessage - The error message.
   * @param {string} [summary] - Summary of the error situation.
   * @param {any} [output=null] - Any partial output that might still be relevant.
   * @returns {AgentResponse}
   */
  createErrorResponse(errorMessage, summary, output = null) {
    return {
      output,
      summary: summary || `Agent "${this.name}" encountered an error.`,
      llmUsage: null,
      rawLLMResponse: undefined,
      error: errorMessage,
      success: false,
    };
  }

  /**
   * Gets a tool by its name from the agent's toolset.
   * @param {string} toolName
   * @returns {DaitanITool | LangChainTool | undefined} The tool instance, or undefined if not found.
   */
  getTool(toolName) {
    const tool = this.tools[toolName];
    if (!tool) {
      this.logger.warn(
        `Tool "${toolName}" not found for agent "${
          this.name
        }". Available tools: ${Object.keys(this.tools).join(', ')}`
      );
    }
    return tool;
  }

  /**
   * Helper to execute a tool safely within an agent.
   * @param {string} toolName - The name of the tool to execute.
   * @param {any} toolInput - The input for the tool.
   * @param {string} [callId] - Optional call ID for tracing.
   * @returns {Promise<{output: string | null, error: string | null}>}
   */
  async safeExecuteTool(toolName, toolInput, callId) {
    const tool = this.getTool(toolName);
    if (!tool) {
      const errorMsg = `Tool "${toolName}" not found or not configured for agent "${this.name}".`;
      this.logger.error(errorMsg, { callId });
      return { output: null, error: errorMsg };
    }

    this.logger.debug(`Executing tool "${toolName}" via safeExecuteTool.`, {
      callId,
      toolInput,
    });
    try {
      let output;
      if (typeof tool.call === 'function') {
        output = await tool.call(toolInput);
      } else if (typeof tool.run === 'function') {
        output = await tool.run(toolInput);
      } else {
        throw new DaitanConfigurationError(
          `Tool "${toolName}" is not callable (missing call/run method).`
        );
      }
      this.logger.debug(`Tool "${toolName}" execution successful.`, {
        callId,
        outputPreview: String(output).substring(0, 100),
      });
      return { output: String(output), error: null };
    } catch (error) {
      this.logger.error(
        `Error executing tool "${toolName}" via safeExecuteTool: ${error.message}`,
        { callId, toolInput, errorName: error.name },
        error
      );
      return {
        output: null,
        error: `Tool "${toolName}" execution failed: ${error.message}`,
      };
    }
  }
}
