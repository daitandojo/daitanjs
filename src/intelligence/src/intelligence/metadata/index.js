// intelligence/src/intelligence/metadata/index.js
/**
 * @file Metadata generation and validation utilities for documents.
 * @module @daitanjs/intelligence/metadata
 *
 * @description
 * This module provides functions for automatically generating metadata (tags, document type, summary)
 * from text content using Large Language Models (LLMs). It also includes utilities for
 * validating and normalizing the structure of this AI-generated metadata.
 */
import { generateIntelligence } from '../core/llmOrchestrator.js';
import { validateAndNormalizeMetadata } from './parse.js';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { DaitanOperationError, DaitanInvalidInputError } from '@daitanjs/error';

const metadataGeneratorLogger = getLogger('daitan-metadata-generator');

/** @private */
const METADATA_GENERATION_SYSTEM_PROMPT_CONFIG = {
  persona:
    'You are an expert AI assistant specialized in analyzing documents and extracting relevant, structured metadata.',
  task: 'Your primary task is to identify key tags or keywords, determine an appropriate document type or category, and create a concise, informative summary based on the provided text content.',
  outputFormat:
    'You MUST respond ONLY with a single, valid JSON object with keys: "tags", "type", "summary".',
  guidelines: [
    "For 'tags', provide an array of 3-7 relevant lowercase strings representing key concepts or themes.",
    "For 'type', provide a single, general classification string (e.g., 'news_article', 'technical_document').",
    "For 'summary', create a brief, neutral overview of the document's main points, no more than 150 words.",
    'Verify your entire output is a single, valid JSON object before responding.',
  ],
};

/**
 * @typedef {Object} GeneratedMetadata
 * @property {string[]} tags - Array of lowercase keyword tags.
 * @property {string} type - A normalized string representing the document type.
 * @property {string} summary - A concise summary of the document content.
 */

/**
 * @typedef {Object} AutoTagResult
 * @property {GeneratedMetadata} metadata - The generated metadata.
 * @property {import('../core/llmOrchestrator.js').LLMUsageInfo | null} llmUsage - LLM token usage information.
 */

/**
 * @typedef {import('../core/llmOrchestrator.js').GenerateIntelligenceParams['config']} LLMCallOptions
 */

/**
 * Generates metadata (tags, document type, summary) for a given text using an LLM.
 *
 * @public
 * @async
 * @param {string} text - The input text content to analyze.
 * @param {LLMCallOptions} [llmCallOptions={}] - Options for the LLM call, conforming to the `generateIntelligence` config structure.
 * @returns {Promise<AutoTagResult>} An object containing `metadata` and `llmUsage`. On failure, returns a default error structure.
 * @throws {DaitanInvalidInputError} If `text` is not a non-empty string.
 */
export const autoTagDocument = async (text, llmCallOptions = {}) => {
  const callId = `autoTag-${Date.now().toString(36)}`;
  const configManager = getConfigManager();

  const effectiveVerbose =
    llmCallOptions.verbose ??
    (configManager.get('RAG_METADATA_VERBOSE', false) ||
      configManager.get('DEBUG_INTELLIGENCE', false));
  const effectiveTrackUsage =
    llmCallOptions.trackUsage ?? configManager.get('LLM_TRACK_USAGE', true);

  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new DaitanInvalidInputError(
      'Input text for autoTagDocument must be a non-empty string.'
    );
  }

  const maxCharsForMetadata = parseInt(
    configManager.get('RAG_METADATA_SAMPLE_CHARS', '12000'),
    10
  );
  const textSample =
    text.length > maxCharsForMetadata
      ? text.substring(0, maxCharsForMetadata)
      : text;

  if (effectiveVerbose && text.length > maxCharsForMetadata) {
    metadataGeneratorLogger.debug(
      `[${callId}] Text sample for metadata generation truncated to ${maxCharsForMetadata} chars.`
    );
  }

  try {
    const callSummaryForLog = `AI Metadata generation for document snippet (length: ${textSample.length})`;

    const { response: rawLLMParsedOutput, usage: llmUsageInfo } =
      await generateIntelligence({
        prompt: {
          system: METADATA_GENERATION_SYSTEM_PROMPT_CONFIG,
          user: `Analyze the following text content and generate structured metadata:\n\n---BEGIN CONTENT SAMPLE---\n${textSample}\n---END CONTENT SAMPLE---`,
        },
        config: {
          response: { format: 'json' },
          llm: {
            target:
              llmCallOptions.llm?.target ||
              configManager.get('LLM_TARGET_METADATA') ||
              'FAST_TASKER',
            ...(llmCallOptions.llm || {}), // Allow overriding all LLM params
          },
          trackUsage: effectiveTrackUsage,
          verbose: effectiveVerbose,
          ...(llmCallOptions || {}), // Pass other top-level configs like retry, cache etc.
        },
        metadata: { summary: callSummaryForLog },
      });

    const normalizedMetadata = validateAndNormalizeMetadata(rawLLMParsedOutput);
    metadataGeneratorLogger.info(
      `[${callId}] Metadata successfully generated.`
    );
    return {
      metadata: normalizedMetadata,
      llmUsage: effectiveTrackUsage ? llmUsageInfo : null,
    };
  } catch (error) {
    metadataGeneratorLogger.warn(
      `[${callId}] autoTagDocument failed: ${error.message}. Returning default error metadata.`
    );
    return {
      metadata: {
        tags: ['error_metadata_generation_failed'],
        type: 'metadata_generation_error',
        summary: `Automated metadata generation failed. Reason: ${String(
          error.message
        ).substring(0, 100)}...`,
      },
      llmUsage: null,
    };
  }
};

/**
 * @deprecated As of v1.1.0, use `autoTagDocument` instead. It now returns a default error structure on failure.
 *
 * @param {string} text - The input text content to analyze.
 * @param {object} [llmOpts={}] - Deprecated: Simple options for the LLM call (e.g., target, temperature).
 * @returns {Promise<GeneratedMetadata>} The generated metadata or a default error structure.
 */
export const safeGenerateMetadata = async (text, llmOpts = {}) => {
  metadataGeneratorLogger.warn(
    '`safeGenerateMetadata` is deprecated and will be removed in a future version. Please use `autoTagDocument` instead, which provides a more flexible configuration and consistent error handling.'
  );

  // Adapt the old, flat `llmOpts` to the new structured `config` for `autoTagDocument`
  const adaptedConfig = {
    llm: {
      target: llmOpts.target,
      temperature: llmOpts.temperature,
      maxTokens: llmOpts.maxTokens,
      // Add any other direct mappings from the old llmOpts structure
    },
    // You can also map other deprecated options here if they existed
    verbose: llmOpts.verbose,
    trackUsage: llmOpts.trackUsage,
  };

  try {
    const { metadata } = await autoTagDocument(text, adaptedConfig);
    return metadata;
  } catch (e) {
    // autoTagDocument now throws DaitanInvalidInputError, which is more specific.
    // However, it also has a fail-safe return, so this catch block might only
    // catch the input error. The original intent was to prevent all throws.
    // The new `autoTagDocument` handles operational errors internally by returning a default structure.
    return {
      tags: ['error_invalid_input_to_safe_generate'],
      type: 'input_error',
      summary: `Metadata generation failed due to invalid input: ${e.message.substring(
        0,
        100
      )}...`,
    };
  }
};

export { validateAndNormalizeMetadata } from './parse.js';
