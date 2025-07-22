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
import { query as apiQuery } from '@daitanjs/apiqueries'; // FIXED: Using apiqueries instead of intelligence
import { isValidURL } from '@daitanjs/validation';
import { Buffer } from 'buffer';

const logger = getLogger('daitan-senses-vision');

const OPENAI_VISION_API_URL = 'https://api.openai.com/v1/chat/completions';
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
 * @property {object | null} usage
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
 * @property {object} [llmConfigOptions]
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
  llmConfigOptions = {}, // Kept for API consistency but not used in this direct call
}) => {
  const callId = `analyzeImage-${Date.now().toString(36)}`;
  logger.info(`[${callId}] analyzeImage: Initiated.`);

  if (!imageSource || typeof imageSource !== 'string' || !imageSource.trim()) {
    throw new DaitanInvalidInputError(
      'Image source (URL, local path, or data URL) must be a non-empty string.'
    );
  }

  const configManager = getConfigManager();
  const apiKey = configManager.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new DaitanConfigurationError('OpenAI API key is not configured.');
  }

  const effectiveModel =
    model ||
    configManager.get('OPENAI_VISION_MODEL') ||
    DEFAULT_OPENAI_VISION_MODEL;

  let imageUrlObject;
  if (imageSource.startsWith('data:image/')) {
    imageUrlObject = { url: imageSource, detail: detailLevel };
  } else if (isValidURL(imageSource)) {
    imageUrlObject = { url: imageSource, detail: detailLevel };
  } else {
    const { base64, contentType } = await encodeImageLocalFileToBase64WithMime(
      imageSource
    );
    imageUrlObject = { url: `data:${contentType};base64,${base64}`, detail: detailLevel };
  }

  const requestBody = {
    model: effectiveModel,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: imageUrlObject },
        ],
      },
    ],
    max_tokens: max_tokens,
  };

  logger.debug(
    `[${callId}] Sending vision analysis request to OpenAI. Model: ${effectiveModel}`
  );

  try {
    const responseData = await apiQuery({
        url: OPENAI_VISION_API_URL,
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        data: requestBody,
        summary: `OpenAI Vision Analysis: "${prompt.substring(0, 30)}..."`,
      });

    const analysisText = responseData?.choices?.[0]?.message?.content;
    if (typeof analysisText !== 'string') {
        throw new DaitanApiError('Invalid response structure from OpenAI Vision API.', 'OpenAI Vision', 200, { responseData });
    }
    
    return {
      analysis: analysisText,
      usage: responseData.usage || null,
      modelUsed: responseData.model || effectiveModel,
      rawResponse: responseData,
    };
  } catch (error) {
    if (error instanceof DaitanError) throw error;
    throw new DaitanApiError(
      `OpenAI Vision API request failed: ${error.message}`,
      'OpenAI Vision',
      error.httpStatusCode || 500,
      { modelUsed: effectiveModel },
      error
    );
  }
};