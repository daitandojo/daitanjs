// senses/src/imagegeneration.js
/**
 * @file OpenAI DALL-E image generation functionalities.
 * @module @daitanjs/senses/imagegeneration
 */
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanApiError,
  DaitanFileOperationError,
  DaitanInvalidInputError,
  DaitanError,
} from '@daitanjs/error';
import { query as apiQuery } from '@daitanjs/apiqueries'; // Retained for now if needed, though generateIntelligence is preferred
import fs from 'fs/promises';
import path from 'path';
import { Buffer } from 'buffer';

const logger = getLogger('daitan-senses-imagegen');

const OPENAI_IMAGE_GENERATION_API_URL =
  'https://api.openai.com/v1/images/generations';

/**
 * @typedef {Object} ImageGenerationResult
 * @property {string | string[]} [outputPath]
 * @property {string | string[]} [base64Data]
 * @property {string[]} [urls]
 * @property {string | string[]} [revisedPrompt]
 * @property {number} created
 * @property {Array<object>} rawData
 */

/**
 * @typedef {Object} GenerateImageParams
 * @property {string} prompt
 * @property {string} [outputPath]
 * @property {number} [n=1]
 * @property {'256x256'|'512x512'|'1024x1024'|'1792x1024'|'1024x1792'} [size='1024x1024']
 * @property {'url'|'b64_json'} [response_format='b64_json']
 * @property {string} [model='dall-e-3']
 * @property {'standard'|'hd'} [quality]
 * @property {'vivid'|'natural'} [style]
 * @property {string} [user]
 */

/**
 * Generates an image using OpenAI's DALL-E API.
 * @public
 * @async
 * @param {GenerateImageParams} params
 * @returns {Promise<ImageGenerationResult>}
 */
export const generateImage = async ({
  prompt,
  outputPath,
  n = 1,
  size = '1024x1024',
  response_format = 'b64_json',
  model = 'dall-e-3',
  quality,
  style,
  user,
}) => {
  const callId = `imageGen-${Date.now().toString(36)}`;
  logger.info(`[${callId}] generateImage: Initiated.`, {
    model,
    n,
    size,
    promptPreview: String(prompt).substring(0, 50) + '...',
  });

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new DaitanInvalidInputError('Prompt must be a non-empty string.');
  }
  if (model === 'dall-e-3' && n > 1) {
    logger.warn(`[${callId}] DALL-E 3 only supports n=1. Setting n to 1.`);
    n = 1;
  }
  const dalle2_sizes = ['256x256', '512x512', '1024x1024'];
  const dalle3_sizes = ['1024x1024', '1792x1024', '1024x1792'];
  if (model === 'dall-e-2' && !dalle2_sizes.includes(size)) {
    throw new DaitanInvalidInputError(
      `DALL-E 2 does not support size ${size}.`
    );
  }
  if (model === 'dall-e-3' && !dalle3_sizes.includes(size)) {
    throw new DaitanInvalidInputError(
      `DALL-E 3 does not support size ${size}.`
    );
  }

  const configManager = getConfigManager();

  const apiKey = configManager.getApiKeyForProvider('openai');
  if (!apiKey) {
    throw new DaitanConfigurationError('OpenAI API key is not configured.');
  }

  const requestBody = { prompt, n, size, response_format, model };
  if (quality && model === 'dall-e-3') requestBody.quality = quality;
  if (style && model === 'dall-e-3') requestBody.style = style;
  if (user) requestBody.user = user;

  try {
    // Using apiQuery directly as this is a specific non-LLM OpenAI endpoint
    const responseData = await apiQuery({
      url: OPENAI_IMAGE_GENERATION_API_URL,
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      data: requestBody,
      summary: `OpenAI Image Generation: ${prompt.substring(0, 30)}`,
    });

    if (!responseData?.data?.[0]) {
      throw new DaitanApiError(
        'OpenAI API returned an unexpected successful response structure.',
        'OpenAI Image Generation'
      );
    }

    const results = {
      revisedPrompt: responseData.data
        .map((item) => item.revised_prompt)
        .filter(Boolean),
      created: responseData.created,
      rawData: responseData.data,
    };
    if (results.revisedPrompt.length === 1)
      results.revisedPrompt = results.revisedPrompt[0];
    if (results.revisedPrompt.length === 0) delete results.revisedPrompt;

    if (response_format === 'b64_json') {
      results.base64Data = responseData.data.map((item) => item.b64_json);
      if (results.base64Data.length === 1)
        results.base64Data = results.base64Data[0];

      if (outputPath && typeof window === 'undefined') {
        const savedPaths = await saveBase64Images(
          outputPath,
          results.base64Data
        );
        results.outputPath =
          savedPaths.length === 1 ? savedPaths[0] : savedPaths;
      }
    } else {
      // response_format === 'url'
      results.urls = responseData.data.map((item) => item.url);
    }

    return results;
  } catch (error) {
    logger.error(
      `[${callId}] Error during OpenAI image generation: ${error.message}`
    );
    if (error instanceof DaitanError) throw error;
    throw new DaitanApiError(
      `OpenAI image generation failed: ${error.message}`,
      'OpenAI Image Generation',
      error.response?.status,
      { responseData: error.response?.data },
      error
    );
  }
};

/** @private */
async function saveBase64Images(outputPath, base64Data) {
  const imagesToSave = Array.isArray(base64Data) ? base64Data : [base64Data];
  const savedPaths = [];
  for (let i = 0; i < imagesToSave.length; i++) {
    const imageBuffer = Buffer.from(imagesToSave[i], 'base64');
    let currentOutputPath = outputPath;
    if (imagesToSave.length > 1) {
      const ext = path.extname(outputPath) || '.png';
      const base = path.basename(outputPath, ext);
      const dir = path.dirname(outputPath);
      currentOutputPath = path.join(dir, `${base}_${i}${ext}`);
    }
    try {
      await fs.mkdir(path.dirname(currentOutputPath), { recursive: true });
      await fs.writeFile(currentOutputPath, imageBuffer);
      savedPaths.push(currentOutputPath);
    } catch (fileError) {
      throw new DaitanFileOperationError(
        `Failed to save image to ${currentOutputPath}: ${fileError.message}`,
        { path: currentOutputPath },
        fileError
      );
    }
  }
  return savedPaths;
}
