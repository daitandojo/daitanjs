// intelligence/src/intelligence/tools/baseTool.js
/**
 * @file Abstract base class for creating tools compatible with DaitanJS and LangChain.
 * @module @daitanjs/intelligence/tools/baseTool
 *
 * @description
 * This class provides a common structure and robust execution wrapper for custom tools.
 * It integrates Zod schema validation, standardized logging, and error handling.
 *
 * NOTE: While this class is functional, the recommended modern approach is to use the
 * `createDaitanTool` factory function from `./toolFactory.js`. The factory provides
 * the same benefits with less boilerplate and is the primary pattern used throughout
 * the library. This class is maintained for compatibility or specific inheritance needs.
 */
import { getLogger } from '@daitanjs/development';
import {
  DaitanValidationError,
  DaitanOperationError,
  DaitanConfigurationError,
} from '@daitanjs/error';
import { DynamicTool } from '@langchain/core/tools';
import { ZodError } from 'zod';

/**
 * @typedef {import('./toolInterface.js').ToolInputWrapper} ToolInputWrapper
 * @typedef {import('./toolInterface.js').ToolInputData} ToolInputData
 * @typedef {import('./toolInterface.js').ToolResponse} ToolResponse
 * @typedef {import('zod').ZodSchema} ZodSchemaType
 */

/**
 * Abstract base class for DaitanJS tools.
 */
export class BaseTool {
  /** @type {string} */
  name;
  /** @type {string} */
  description;
  /** @type {ZodSchemaType | undefined} */
  schema;
  /** @type {import('winston').Logger} */
  logger;

  constructor(name, description, argsSchema = undefined) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new DaitanConfigurationError(
        'Tool name must be a non-empty string.'
      );
    }
    if (
      !description ||
      typeof description !== 'string' ||
      !description.trim()
    ) {
      throw new DaitanConfigurationError(
        'Tool description must be a non-empty string.'
      );
    }
    this.name = name;
    this.description = description;
    this.schema = argsSchema;
    this.logger = getLogger(`daitan-tool-${this.name}`);
    this.logger.info(`Tool "${this.name}" initialized.`);
  }

  /**
   * The core logic of the tool. Subclasses MUST implement this method.
   * @protected
   * @abstract
   * @param {any} processedInput - The validated and processed input for the tool.
   * @param {string} [callId] - A unique ID for logging and tracing this specific call.
   * @returns {Promise<string | any>} The result of the tool's execution.
   */
  async _run(processedInput, callId) {
    throw new DaitanOperationError(
      'Method "_run()" not implemented by subclass.',
      { toolName: this.name }
    );
  }

  /**
   * Public execution method that wraps the core logic with validation and error handling.
   * @param {any} rawInput - The raw input from the agent or caller.
   * @returns {Promise<string>} The result formatted as a string for the agent.
   */
  async run(rawInput) {
    const callId =
      (typeof rawInput === 'object' && rawInput?.callId) ||
      `tool-run-${this.name}-${Date.now().toString(36)}`;
    let inputForRun = rawInput;

    this.logger.info(`Tool "${this.name}" execution: START`, { callId });

    try {
      // Handle cases where input is a stringified JSON
      if (typeof rawInput === 'string') {
        try {
          inputForRun = JSON.parse(rawInput);
        } catch (e) {
          // Not a JSON string, proceed with the raw string.
          // This is fine if the schema expects a string.
        }
      }

      // If a Zod schema is provided, parse and validate the input.
      if (this.schema) {
        inputForRun = this.schema.parse(inputForRun);
      }

      // Execute the core tool logic with the (potentially validated) input.
      const result = await this._run(inputForRun, callId);

      // Format the output to be a string, as expected by LangChain's agent observation.
      const outputString =
        typeof result === 'string' ? result : JSON.stringify(result, null, 2);

      this.logger.info(`Tool "${this.name}" execution: SUCCESS`, {
        callId,
        outputPreview: outputString.substring(0, 150) + '...',
      });

      return outputString;
    } catch (error) {
      this.logger.error(
        `Execution error in tool "${this.name}": ${error.message}`,
        {
          callId,
          errorName: error.name,
        }
      );

      // Format a user-friendly error message for the agent.
      if (error instanceof ZodError) {
        return `Error: Invalid input. ${error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join('; ')}`;
      }
      if (
        error instanceof DaitanValidationError ||
        error instanceof DaitanOperationError
      ) {
        return `Error: ${error.message}`;
      }
      return `Error executing tool "${this.name}": An unexpected error occurred. ${error.message}`;
    }
  }

  /**
   * Synchronously gets a LangChain-compatible `DynamicTool` instance.
   * This getter is now synchronous, making it safe to use when initializing agents.
   * @returns {DynamicTool}
   */
  get lcTool() {
    return new DynamicTool({
      name: this.name,
      description: this.description,
      // The `func` property can be async, which is the correct pattern.
      func: (input) => this.run(input),
      // Pass the schema to the DynamicTool for structured input handling.
      schema: this.schema,
    });
  }
}
