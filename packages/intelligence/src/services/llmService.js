// intelligence/src/services/llmService.js
/**
 * @file Provides a service class for simplified and consistent interaction with LLMs.
 * @module @daitanjs/intelligence/services/llmService
 */
import { generateIntelligence } from '../intelligence/core/llmOrchestrator.js';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { DaitanInvalidInputError } from '@daitanjs/error';

const logger = getLogger('daitan-llm-service');

/**
 * @typedef {import('../intelligence/core/llmOrchestrator.js').LLMUsageInfo} LLMUsageInfo
 * @typedef {import('../intelligence/core/llmOrchestrator.js').LLMCallbacks} LLMCallbacks
 * @typedef {import('../intelligence/core/llmOrchestrator.js').GenerateIntelligenceParams} GenerateIntelligenceParams
 */

/**
 * @typedef {Object} LLMServiceConfig
 * @property {string} [target] - Default LLM target, as an expert profile name (e.g., 'FAST_TASKER') or a 'provider|model' string.
 * @property {string} [apiKey] - Default API key (overrides configManager).
 * @property {string} [baseURL] - Default base URL (overrides configManager).
 * @property {number} [temperature] - Default temperature.
 * @property {number} [maxTokens] - Default max_tokens.
 * @property {boolean} [verbose] - Default verbosity for LLM calls.
 * @property {boolean} [trace] - Default LangSmith tracing enablement.
 * @property {boolean} [trackUsage] - Default for tracking token usage.
 * @property {number} [requestTimeout] - Default request timeout for LLM calls.
 * @property {number} [maxRetries] - Default max retries for LLM calls.
 * @property {number} [initialDelayMs] - Default initial retry delay.
 */

export class LLMService {
  /**
   * @param {LLMServiceConfig} [defaultConfig={}] - Default configuration for this service instance.
   */

  constructor(defaultConfig = {}) {
    const configManager = getConfigManager();
    this.defaultConfig = {
      target: configManager.get('LLM_PROVIDER', 'openai'), // Default to provider if no specific target
      temperature: 0.7,
      maxTokens: 2000,
      verbose: configManager.get('DEBUG_INTELLIGENCE', false),
      trackUsage: configManager.get('LLM_TRACK_USAGE', true),
      ...defaultConfig,
    };
    this.logger = logger; // Make logger available to instances
    logger.info('LLMService initialized.');
    logger.debug('LLMService default configuration:', this.defaultConfig);
  }

  /**
   * Makes a generic call to `generateIntelligence`, merging service defaults with call-specific options.
   * @param {GenerateIntelligenceParams} options - Options for generateIntelligence, including prompt, config, metadata, and callbacks.
   * @returns {Promise<import('../intelligence/core/llmOrchestrator.js').GenerateIntelligenceResult<any>>}
   */
  async generate(options) {
    const {
      prompt = {},
      config: callConfig = {},
      metadata = {},
      callbacks,
    } = options;

    if (!prompt?.user && !(prompt?.shots && prompt.shots.length > 0)) {
      throw new DaitanInvalidInputError(
        'LLMService.generate: A `prompt.user` message or messages in `prompt.shots` are required.'
      );
    }

    const {
      llm: callLlm = {},
      response: callResponse = {},
      retry: callRetry = {},
      ...callRootConfig
    } = callConfig;

    const finalConfig = {
      verbose: this.defaultConfig.verbose,
      trackUsage: this.defaultConfig.trackUsage,
      ...callRootConfig,
      llm: {
        target: this.defaultConfig.target,
        temperature: this.defaultConfig.temperature,
        maxTokens: this.defaultConfig.maxTokens,
        apiKey: this.defaultConfig.apiKey,
        baseURL: this.defaultConfig.baseURL,
        ...callLlm,
      },
      response: { ...callResponse },
      retry: {
        maxAttempts: this.defaultConfig.maxRetries,
        ...callRetry,
      },
    };

    const finalParams = {
      prompt,
      config: finalConfig,
      metadata,
      callbacks,
    };

    const summary = metadata?.summary || 'Untitled LLMService Call';
    this.logger.info(`LLMService.generate called for summary: "${summary}"`);

    try {
      const result = await generateIntelligence(finalParams);
      this.logger.info(`LLMService.generate successful for: "${summary}"`);
      if (result.usage) {
        this.logger.debug('LLM Usage:', result.usage);
      }
      return result;
    } catch (error) {
      this.logger.error(
        `LLMService.generate failed for "${summary}": ${error.message}`,
        { error }
      );
      throw error;
    }
  }

  /**
   * Generates a JSON response from the LLM.
   * @param {Object} params
   * @returns {Promise<{response: Object, usage: LLMUsageInfo | null}>}
   */
  async generateJson({
    userPrompt,
    whoYouAre,
    whatYouDo,
    summary = 'JSON Generation',
    shots,
    ...overrideConfig
  }) {
    const { target, temperature, maxTokens, apiKey, baseURL, ...rootConfig } =
      overrideConfig;

    const params = {
      prompt: {
        system: { persona: whoYouAre, task: whatYouDo },
        user: userPrompt,
        shots,
      },
      config: {
        ...rootConfig,
        response: { format: 'json' },
        llm: { target, temperature, maxTokens, apiKey, baseURL },
      },
      metadata: { summary },
    };
    return this.generate(params);
  }

  /**
   * Generates a text response from the LLM.
   * @param {Object} params
   * @returns {Promise<{response: string, usage: LLMUsageInfo | null}>}
   */
  async generateText({
    userPrompt,
    whoYouAre,
    whatYouDo,
    summary = 'Text Generation',
    shots,
    ...overrideConfig
  }) {
    const { target, temperature, maxTokens, apiKey, baseURL, ...rootConfig } =
      overrideConfig;

    const params = {
      prompt: {
        system: { persona: whoYouAre, task: whatYouDo },
        user: userPrompt,
        shots,
      },
      config: {
        ...rootConfig,
        response: { format: 'text' },
        llm: { target, temperature, maxTokens, apiKey, baseURL },
      },
      metadata: { summary },
    };
    return this.generate(params);
  }

  /**
   * Streams a text response from the LLM.
   * @param {Object} params
   * @returns {Promise<{response: string | undefined, usage: LLMUsageInfo | null}>}
   */
  async streamText({
    userPrompt,
    whoYouAre,
    whatYouDo,
    summary = 'Text Streaming',
    shots,
    callbacks,
    returnFullResponseAfterStream = true,
    ...overrideConfig
  }) {
    if (!callbacks || typeof callbacks.onTokenStream !== 'function') {
      throw new DaitanInvalidInputError(
        'LLMService.streamText: `callbacks.onTokenStream` is required for streaming.'
      );
    }
    const { target, temperature, maxTokens, apiKey, baseURL, ...rootConfig } =
      overrideConfig;

    const params = {
      prompt: {
        system: { persona: whoYouAre, task: whatYouDo },
        user: userPrompt,
        shots,
      },
      config: {
        ...rootConfig,
        response: { format: 'text', returnFullResponseAfterStream },
        llm: { target, temperature, maxTokens, apiKey, baseURL },
      },
      metadata: { summary },
      callbacks,
    };
    return this.generate(params);
  }
}
