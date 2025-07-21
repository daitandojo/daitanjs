// senses/src/vision.js
/**
 * @file OpenAI Vision API (e.g., GPT-4o, GPT-4 Vision) image analysis functionalities.
 * @module @daitanjs/senses/vision
 */
import fs from 'fs/promises';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanApiError,
  DaitanFileOperationError,
  DaitanInvalidInputError,
  DaitanError,
} from '@daitanjs/error';
import { generateIntelligence } from '@daitanjs/intelligence'; // CORRECTED IMPORT
import { isValidURL } from '@daitanjs/validation';
import { Buffer } from 'buffer';

const logger = getLogger('daitan-senses-vision');

const DEFAULT_OPENAI_VISION_MODEL = 'gpt-4o-mini';

/** @private */
const encodeImageLocalFileToBase64WithMime = async (imagePath) => {
  if (typeof window !== 'undefined') {
    throw new DaitanConfigurationError(
      'encodeImageLocalFileToBase64 is for Node.js only.'
    );
  }
  try {
    const buffer = await fs.readFile(imagePath);
    const mimeTypes = await import('mime-types');
    const contentType =
      mimeTypes.lookup(imagePath) || 'application/octet-stream';
    return { base64: buffer.toString('base64'), contentType };
  } catch (error) {
    throw new DaitanFileOperationError(
      `Error reading image file "${imagePath}": ${error.message}`,
      { path: imagePath },
      error
    );
  }
};

/**
 * @typedef {Object} ImageAnalysisResult
 * @property {string} analysis
 * @property {import('@daitanjs/intelligence').LLMUsageInfo | null} usage
 * @property {string} modelUsed
 * @property {object} [rawResponse]
 */

/**
 * @typedef {Object} AnalyzeImageParams
 * @property {string} imageSource
 * @property {string} [prompt="Describe this image in detail."]
 * @property {string} [model]
 * @property {number} [max_tokens=500]
 * @property {'low'|'high'|'auto'} [detailLevel='auto']
 * @property {import('@daitanjs/intelligence').LLMCallOptions} [llmConfigOptions]
 */

/**
 * Analyzes an image using an OpenAI vision-capable model.
 * @public
 * @async
 * @param {AnalyzeImageParams} params
 * @returns {Promise<ImageAnalysisResult>}
 */
export const analyzeImage = async ({
  imageSource,
  prompt = 'Describe this image in detail.',
  model,
  max_tokens = 500,
  detailLevel = 'auto',
  llmConfigOptions = {},
}) => {
  const callId = `analyzeImage-${Date.now().toString(36)}`;
  logger.info(`[${callId}] analyzeImage: Initiated.`);

  if (!imageSource || typeof imageSource !== 'string' || !imageSource.trim()) {
    throw new DaitanInvalidInputError(
      'Image source (URL, local path, or data URL) must be a non-empty string.'
    );
  }
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new DaitanInvalidInputError('Prompt must be a non-empty string.');
  }

  const configManager = getConfigManager();

  const effectiveModel =
    model ||
    configManager.get('OPENAI_VISION_MODEL') ||
    DEFAULT_OPENAI_VISION_MODEL;

  let imageDataUrlForApi;
  if (imageSource.startsWith('data:image/')) {
    imageDataUrlForApi = imageSource;
  } else if (isValidURL(imageSource)) {
    imageDataUrlForApi = imageSource;
  } else {
    const { base64, contentType } = await encodeImageLocalFileToBase64WithMime(
      imageSource
    );
    imageDataUrlForApi = `data:${contentType};base64,${base64}`;
  }

  const userPromptContent = [
    { type: 'text', text: prompt },
    {
      type: 'image_url',
      image_url: { url: imageDataUrlForApi, detail: detailLevel },
    },
  ];

  logger.debug(
    `[${callId}] Sending vision analysis request to OpenAI. Model: ${effectiveModel}`
  );

  try {
    const {
      response: analysisText,
      usage,
      rawResponse,
    } = await generateIntelligence({
      prompt: { user: userPromptContent },
      config: {
        response: { format: 'text' },
        llm: {
          target: `openai|${effectiveModel}`,
          maxTokens: max_tokens,
          ...llmConfigOptions.llm,
        },
        ...llmConfigOptions,
      },
      metadata: {
        summary: `OpenAI Vision Analysis: "${prompt.substring(0, 30)}..."`,
      },
    });

    return {
      analysis: String(analysisText || ''),
      usage,
      modelUsed: effectiveModel,
      rawResponse: rawResponse || null,
    };
  } catch (error) {
    if (error instanceof DaitanError) throw error;
    throw new DaitanApiError(
      `OpenAI Vision API request failed: ${error.message}`,
      'OpenAI Vision',
      error.response?.status || error.statusCode,
      { modelUsed: effectiveModel },
      error
    );
  }
};
