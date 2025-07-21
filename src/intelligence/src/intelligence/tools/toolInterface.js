// intelligence/src/intelligence/tools/toolInterface.js
// This file defines conceptual interfaces and types using JSDoc.
// No functional changes, but ensure types are consistent with usage.

/**
 * @typedef {Object} LLMUsageInfo
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} totalTokens
 * @property {number | null} estimatedCostUSD
 * @property {string} currency
 * @property {string} [costDetails]
 * @property {string} [tokenCountMethodInput]
 * @property {string} [tokenCountMethodOutput]
 */

/**
 * @typedef {any} ToolInputData - The primary input data for the tool. Can be string, object, etc.
 */

/**
 * @typedef {Object} ToolInputWrapper
 * @property {ToolInputData} input - The primary input data for the tool.
 * @property {Object} [options] - Optional configuration for the tool execution.
 * @property {string} [callId] - Optional unique ID for this specific tool call.
 */

/**
 * @typedef {Object} ToolResponse
 * @property {any} output - The primary result of the tool (e.g., string, JSON object, number).
 * @property {string} [summary] - A brief summary of what the tool did or found.
 * @property {string} [error] - Error message if the tool execution failed.
 * @property {LLMUsageInfo | null} [llmUsage] - If the tool itself uses an LLM, this can track its usage.
 * @property {any} [rawOutput] - The raw output from an underlying service, if applicable.
 * @property {boolean} [success] - Indicates if the tool execution was successful.
 */

/**
 * @typedef {import('zod').ZodSchema} ZodSchemaType - For LangChain StructuredTool compatibility.
 */

/**
 * @interface ITool
 * Defines the contract for tools within the DaitanJS intelligence library.
 * LangChain's `DynamicTool` or custom classes can fulfill this.
 */
class ITool {
  /**
   * The unique name of the tool. Should be snake_case for LLM compatibility.
   * @type {string}
   * @abstract
   */
  name;

  /**
   * A detailed description for LLMs to understand when and how to use the tool.
   * Should clearly state what the tool does, what its input should be, and what its output represents.
   * @type {string}
   * @abstract
   */
  description;

  /**
   * Optional: A Zod schema defining the expected input structure.
   * Used by LangChain's `StructuredTool`.
   * @type {ZodSchemaType | any}
   * @abstract
   */
  // schema; // Property name in LangChain's StructuredTool for Zod schema.
  // argsSchema; // Alternative naming if preferred.

  /**
   * Executes the tool's main functionality.
   * @async
   * @abstract
   * @param {ToolInputData | string | any} input - The input for the tool.
   *        For LangChain `DynamicTool`, this is often a single string or an object if `StructuredTool`.
   *        If an object, it might be the `ToolInputWrapper.input` or directly the structured args.
   * @returns {Promise<string>} The result of the tool's execution, typically as a string for LangChain.
   *                            Internally, it might produce a `ToolResponse` object first.
   */
  async run(input) {
    throw new Error("Method 'run(input)' not implemented.");
  }

  /**
   * The core private method for tool execution, to be implemented by subclasses.
   * @async
   * @protected
   * @abstract
   * @param {ToolInputData | any} input - The processed input for the tool.
   * @returns {Promise<string | ToolResponse>} The result of the tool's execution.
   */
  async _run(input) {
    throw new Error("Method '_run(input)' not implemented by subclass.");
  }
}

// To make this file a module for import purposes when using JSDoc @implements or @type.
export {};
