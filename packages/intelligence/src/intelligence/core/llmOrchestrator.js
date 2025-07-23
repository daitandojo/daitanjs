// intelligence/src/intelligence/core/llmOrchestrator.js
/**
 * @file The final, stable, and feature-complete LLM orchestrator.
 * @module @daitanjs/intelligence/core/llmOrchestrator
 *
 * @description
 * This file contains the fully restored logic for the intelligence orchestrator.
 * It is built on a proven stable core and safely integrates multi-provider support,
 * expert profile resolution, configuration, and robust error handling.
 * For architectural guidance, see the README.md in this directory.
 */
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGroq } from '@langchain/groq';
import {
  StringOutputParser,
  JsonOutputParser,
} from '@langchain/core/output_parsers';
import { getConfigManager } from '@daitanjs/config';
import { DaitanApiError, DaitanConfigurationError } from '@daitanjs/error';
import { buildLlmMessages } from './promptBuilder.js';
import { getExpertModelDefinition } from './expertModels.js';
import { estimateLlmCost } from './llmPricing.js';
import { countTokensForMessages, countTokens } from './tokenUtils.js';
import { getLogger } from '@daitanjs/development';

const logger = getLogger('daitan-llm-orchestrator');

/**
 * Extracts a JSON object from a string, especially if it's wrapped in markdown code fences.
 * @param {string} text - The input string which might contain a JSON object.
 * @returns {string} - The extracted JSON string or the original text if no JSON is found.
 */
function extractJsonFromString(text) {
  if (typeof text !== 'string') return text;

  // This regex finds JSON within ```json ... ``` or just the first valid { ... } or [ ... ]
  const jsonRegex = /```(?:json)?\s*([\s\S]+?)\s*```|({[\s\S]*}|\[[\s\S]*\])/m;
  const match = text.match(jsonRegex);

  // If a match is found, return the captured group (either from the code block or the raw object/array).
  // Otherwise, return the original text to let the parser try.
  return match ? match[1] || match[2] || text : text;
}

export const generateIntelligence = async ({
  prompt = {},
  config = {},
  callbacks,
  metadata = {}, // Add metadata to destructuring
}) => {
  const {
    llm: llmConfig = {},
    response: responseConfig = {},
    ...otherConfigs
  } = config;

  if (!prompt.user && (!prompt.shots || prompt.shots.length === 0)) {
    throw new DaitanConfigurationError(
      'A `prompt.user` message or messages in `prompt.shots` are required.'
    );
  }

  let llm;
  let providerName;
  let modelName;
  let temperature;

  try {
    const configManager = getConfigManager();
    const rawTarget =
      llmConfig.target ||
      configManager.get('DEFAULT_EXPERT_PROFILE') ||
      configManager.get('LLM_PROVIDER') ||
      'FAST_TASKER';

    const expertDef = getExpertModelDefinition(rawTarget);
    if (expertDef) {
      providerName = expertDef.provider.toLowerCase();
      modelName = expertDef.model;
      temperature = expertDef.temperature;
    } else {
      const [p, m] = rawTarget.split('|');
      providerName = p ? p.toLowerCase() : 'openai';
      modelName = m;
    }

    const commonConfig = {
      temperature: temperature ?? llmConfig.temperature ?? 0.7,
      maxRetries: config.retry?.maxAttempts ?? 2,
      timeout: llmConfig.requestTimeout,
      modelName: modelName,
    };

    switch (providerName) {
      case 'openai': {
        const apiKey = llmConfig.apiKey || configManager.get('OPENAI_API_KEY');
        if (!apiKey)
          throw new DaitanConfigurationError('OPENAI_API_KEY not found.');
        llm = new ChatOpenAI({ ...commonConfig, apiKey });
        break;
      }
      case 'anthropic': {
        const apiKey =
          llmConfig.apiKey || configManager.get('ANTHROPIC_API_KEY');
        if (!apiKey)
          throw new DaitanConfigurationError('ANTHROPIC_API_KEY not found.');
        llm = new ChatAnthropic({ ...commonConfig, apiKey });
        break;
      }
      case 'groq': {
        const apiKey = llmConfig.apiKey || configManager.get('GROQ_API_KEY');
        if (!apiKey)
          throw new DaitanConfigurationError('GROQ_API_KEY not found.');
        llm = new ChatGroq({ ...commonConfig, apiKey });
        break;
      }
      default:
        throw new DaitanConfigurationError(
          `Unsupported provider in orchestrator: '${providerName}'`
        );
    }

    // --- DEFINITIVE FIX: Use the new `buildLlmMessages` which correctly parses the structured prompt object ---
    const messages = buildLlmMessages(prompt);
    // --- END OF FIX ---

    const result = await llm.invoke(messages, { callbacks });
    const rawContent = result.content ?? '';

    let contentToParse = rawContent;
    if (responseConfig.format === 'json') {
      contentToParse = extractJsonFromString(rawContent);
    }

    const parser =
      responseConfig.format === 'json'
        ? new JsonOutputParser()
        : new StringOutputParser();

    const finalResponse = await parser.parse(contentToParse);

    const usageMetadata = result.usage_metadata ?? {};
    const usage = {
      inputTokens:
        usageMetadata.inputTokens ??
        (await countTokensForMessages(messages, modelName, providerName)),
      outputTokens:
        usageMetadata.outputTokens ??
        (await countTokens(
          typeof finalResponse === 'string'
            ? finalResponse
            : JSON.stringify(finalResponse ?? ''),
          modelName,
          providerName
        )),
    };
    usage.totalTokens = (usage.inputTokens || 0) + (usage.outputTokens || 0);
    const cost = estimateLlmCost(
      providerName,
      modelName,
      usage.inputTokens,
      usage.outputTokens
    );

    return {
      response: finalResponse,
      usage: { ...usage, ...cost },
      rawResponse: rawContent,
    };
  } catch (error) {
    logger.error(
      `LLM Interaction Failed. Summary: ${
        metadata.summary || 'N/A'
      }. Provider: ${providerName}, Model: ${modelName}. Error: ${
        error.message
      }`,
      { errorStack: error.stack }
    );

    throw new DaitanApiError(
      `An unrecoverable error occurred during the LLM interaction with provider '${
        providerName || 'unknown'
      }'.`,
      providerName || 'unknown',
      error?.status,
      { model: modelName, summary: metadata.summary },
      error
    );
  }
};
