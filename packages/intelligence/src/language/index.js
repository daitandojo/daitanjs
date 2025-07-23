// packages/intelligence/src/language/index.js (version 1.0.1)
// --- DEFINITIVE FIX: Change ../intelligence to ../intelligence/core/llmOrchestrator.js ---
import { generateIntelligence } from '../intelligence/core/llmOrchestrator.js';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanOperationError,
} from '@daitanjs/error';

const languageLogger = getLogger('daitan-language-services');

/**
 * @typedef {Object} TranslateParams
 * @property {string} language - Target ISO language code (e.g., 'es', 'fr').
 * @property {string | string[] | Object} body - The text, array of texts, or object with string values to translate.
 * @property {string} [sourceLanguage] - Optional: Source language ISO code. If not provided, LLM will attempt to auto-detect.
 * @property {string} [llmTarget] - The LLM target, as an expert profile name (e.g., 'TRANSLATION_MULTILINGUAL') or 'provider|model' string.
 * @property {import('../../services/llmService.js').LLMServiceConfig} [llmConfigOptions] - Additional LLM config options.
 * @property {boolean} [verbose] - Verbosity for this specific translation call.
 */

/**
 * Translates text, an array of texts, or string values within an object to a target language.
 *
 * @param {TranslateParams} params - Parameters for translation.
 * @returns {Promise<string | string[] | Object>} The translated text, array, or object.
 * @throws {DaitanConfigurationError} if required parameters are missing.
 * @throws {DaitanOperationError} if translation fails.
 */
export const translate = async ({
  language,
  body,
  sourceLanguage,
  llmTarget,
  llmConfigOptions = {},
  verbose: callSpecificVerbose,
}) => {
  const configManager = getConfigManager(); // Lazy-load
  const callId = `translate-${Date.now()}`;
  const effectiveVerbose =
    callSpecificVerbose ??
    (configManager.get('DEBUG_TRANSLATION', false) ||
      configManager.get('DEBUG_INTELLIGENCE', false));

  if (!language || typeof language !== 'string' || language.trim().length < 2) {
    throw new DaitanConfigurationError(
      'Target language code (e.g., "es", "fr") is required.'
    );
  }
  if (body === undefined || body === null) {
    return body;
  }

  const effectiveTarget =
    llmTarget ||
    configManager.get('LLM_TARGET_TRANSLATE') ||
    'TRANSLATION_MULTILINGUAL';

  const translateDataItem = async (textToTranslate, itemKey = 'text') => {
    if (typeof textToTranslate !== 'string' || textToTranslate.trim() === '') {
      return textToTranslate;
    }

    const taskInstructions = [
      `Translate the provided text accurately into ${language} (ISO language code).`,
      sourceLanguage
        ? `The source text is in ${sourceLanguage}.`
        : 'The source language will be auto-detected.',
      'Respond ONLY with the translated text.',
      'Do not add any explanations, apologies, or phrases like "Here is the translation:".',
      'Preserve the original meaning, tone, and nuances as much as possible.',
    ];

    try {
      if (effectiveVerbose) {
        languageLogger.debug(`Translating text to ${language}.`, {
          callId,
          itemKey,
          textPreview: textToTranslate.substring(0, 70) + '...',
        });
      }
      const { response: translatedText, usage } = await generateIntelligence({
        prompt: {
          system: {
            persona: 'You are an expert multilingual translator.',
            task: taskInstructions.join(' '),
          },
          user: textToTranslate,
        },
        config: {
          response: { format: 'text' },
          llm: {
            target: effectiveTarget,
            temperature: llmConfigOptions.temperature ?? 0.1,
            maxTokens:
              llmConfigOptions.maxTokens ??
              Math.max(256, Math.floor(textToTranslate.length * 2.8)),
            apiKey: llmConfigOptions.apiKey,
            baseURL: llmConfigOptions.baseURL,
          },
          verbose: effectiveVerbose,
          trackUsage:
            llmConfigOptions.trackUsage ??
            configManager.get('LLM_TRACK_USAGE', true),
        },
        metadata: {
          summary: `Translate to ${language}: ${textToTranslate.substring(
            0,
            30
          )}...`,
        },
      });

      if (effectiveVerbose && usage) {
        languageLogger.debug('LLM usage for translation step:', {
          callId,
          itemKey,
          usage,
        });
      }
      return String(translatedText || '');
    } catch (error) {
      languageLogger.error(
        `Error translating item "${itemKey}" to ${language}.`,
        { callId, errorName: error.name, errorMessage: error.message }
      );
      return `[[TRANSLATION_ERROR: ${textToTranslate.substring(0, 30)}...]]`;
    }
  };

  try {
    if (typeof body === 'string') {
      return await translateDataItem(body, 'string_body');
    } else if (Array.isArray(body)) {
      if (effectiveVerbose)
        languageLogger.info(
          `Translating an array of ${body.length} items to ${language}.`,
          { callId }
        );
      return Promise.all(
        body.map((item, index) =>
          translateDataItem(item, `array_item_${index}`)
        )
      );
    } else if (body && typeof body === 'object') {
      if (effectiveVerbose)
        languageLogger.info(
          `Translating string values in an object to ${language}.`,
          { callId, objectKeys: Object.keys(body) }
        );

      const translatedObject = {};
      const keys = Object.keys(body);
      const translationPromises = keys.map((key) =>
        translateDataItem(body[key], `object_key_${key}`)
      );
      const translatedValues = await Promise.all(translationPromises);

      keys.forEach((key, index) => {
        translatedObject[key] = translatedValues[index];
      });
      return translatedObject;
    } else {
      return body;
    }
  } catch (error) {
    languageLogger.error(
      `Top-level error in translate function for language ${language}.`,
      { callId, errorName: error.name },
      error
    );
    throw new DaitanOperationError(
      `Translation to ${language} failed: ${error.message}`,
      { targetLanguage: language },
      error
    );
  }
};