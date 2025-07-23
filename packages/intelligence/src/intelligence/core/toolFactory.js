// intelligence/src/intelligence/core/toolFactory.js
/**
 * @file Contains the factory function for creating DaitanJS tools.
 * @module @daitanjs/intelligence/core/toolFactory
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
 * @param {(input: any, callId?: string) => Promise<string | any>} func - The async function that implements the tool's logic.
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
      'Tool `name` must be a non-empty string.'
    );
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    throw new DaitanInvalidInputError(
      'Tool `description` must be a non-empty string.'
    );
  }
  if (typeof func !== 'function') {
    throw new DaitanInvalidInputError(
      'Tool `func` must be a callable function.'
    );
  }

  const daitanToolWrapperFunc = async (rawInput) => {
    const callId = `tool-run-${name}-${Date.now().toString(36)}`;
    const logger = getLogger(`daitan-tool-${name}`);
    logger.info(`Tool "${name}" execution: START`, { callId, rawInput });

    let inputForRun = rawInput;
    try {
      if (typeof rawInput === 'string') {
        try {
          inputForRun = JSON.parse(rawInput);
        } catch (e) {
          // Ignore if not a valid JSON string.
        }
      }

      if (argsSchema) {
        inputForRun = argsSchema.parse(inputForRun);
      }

      const result = await func(inputForRun, callId);
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
      });

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
    schema: argsSchema,
  };

  return new DynamicTool(toolConfig);
};
