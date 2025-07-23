// intelligence/src/intelligence/tools/toolFactory.js
/**
 * @file Contains the factory function for creating DaitanJS tools.
 * @module @daitanjs/intelligence/tools/toolFactory
 * @private
 */
import { DynamicTool } from '@langchain/core/tools';
import { getLogger } from '@daitanjs/development';
import {
  DaitanInvalidInputError,
  DaitanValidationError,
  DaitanOperationError,
} from '@daitanjs/error';
import { ZodError } from 'zod';

const toolFactoryLogger = getLogger('daitan-tool-factory');

/**
 * Creates a LangChain-compatible custom tool (`DynamicTool`) from an asynchronous function.
 * This factory wraps the provided function with robust input parsing, validation, logging, and error handling.
 *
 * @public
 * @param {string} name - The unique, snake_case name of the tool.
 * @param {string} description - A detailed description for the LLM.
 * @param {(input: any, callId?: string) => Promise<string | any>} func - The async function that implements the tool's logic. It receives the validated input.
 * @param {import('zod').ZodSchema} [argsSchema] - Optional Zod schema for input validation.
 * @returns {DynamicTool} A LangChain DynamicTool instance.
 */
export const createDaitanTool = (
  name,
  description,
  func,
  argsSchema = undefined
) => {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new DaitanInvalidInputError(
      'Tool `name` must be a non-empty string for createDaitanTool.'
    );
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    throw new DaitanInvalidInputError(
      'Tool `description` must be a non-empty string for createDaitanTool.'
    );
  }
  if (typeof func !== 'function') {
    throw new DaitanInvalidInputError(
      'Tool `func` must be a callable function for createDaitanTool.'
    );
  }
  if (!/^[a-z0-9_]+$/.test(name.trim())) {
    toolFactoryLogger.warn(
      `Tool name "${name.trim()}" for createDaitanTool is not in snake_case. This is strongly recommended for optimal LLM compatibility.`
    );
  }

  // This wrapper function contains the standardized logic from BaseTool.run
  const daitanToolWrapperFunc = async (rawInput) => {
    const callId = `tool-run-${name}-${Date.now().toString(36)}`;
    const logger = getLogger(`daitan-tool-${name}`);
    logger.info(`Tool "${name}" execution: START`, { callId, rawInput });

    let processedInput = rawInput;
    let inputForRun = rawInput;

    try {
      // Handle cases where input is a stringified JSON
      if (typeof rawInput === 'string') {
        try {
          const parsed = JSON.parse(rawInput);
          // If the schema expects a string but gets a parsed object, it could fail.
          // We only use the parsed object if it seems intentional (i.e., it's an object).
          if (typeof parsed === 'object' && parsed !== null) {
            inputForRun = parsed;
          }
        } catch (e) {
          // Ignore if not a valid JSON string, proceed with the raw string.
        }
      }

      // If a Zod schema is provided, parse and validate the input.
      if (argsSchema) {
        // Zod's .parse will throw a ZodError on failure, which we catch below.
        processedInput = argsSchema.parse(inputForRun);
        inputForRun = processedInput;
      }

      // Execute the core tool logic with the (potentially validated) input.
      const result = await func(inputForRun, callId);

      // Format the output to be a string, as expected by LangChain's DynamicTool observation.
      const outputString =
        typeof result === 'string' ? result : JSON.stringify(result, null, 2);

      logger.info(`Tool "${name}" execution: SUCCESS`, {
        callId,
        outputPreview: outputString.substring(0, 150) + '...',
      });

      return outputString;
    } catch (error) {
      logger.error(`Execution error in tool "${name}": ${error.message}`, {
        callId,
        errorName: error.name,
        // errorStack: error.stack // can be too verbose
      });

      // Format a user-friendly error message for the agent to observe.
      if (error instanceof ZodError) {
        const validationErrorMessage =
          'Invalid input. ' +
          error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join('; ');
        return `Error: ${validationErrorMessage}`;
      }
      if (
        error instanceof DaitanValidationError ||
        error instanceof DaitanOperationError
      ) {
        return `Error: ${error.message}`;
      }
      return `Error executing tool "${name}": An unexpected error occurred. ${error.message}`;
    }
  };

  const toolConfig = {
    name: name.trim(),
    description: description.trim(),
    func: daitanToolWrapperFunc,
  };

  // LangChain's DynamicTool uses 'schema' for the Zod schema directly.
  if (argsSchema) {
    toolConfig.schema = argsSchema;
  }

  return new DynamicTool(toolConfig);
};
