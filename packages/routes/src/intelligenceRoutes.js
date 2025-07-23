// routes/src/intelligenceRoutes.js
/**
 * @file Reusable Next.js App Router route handlers for AI intelligence services.
 * @module @daitanjs/routes/intelligenceRoutes
 *
 * @description
 * This module provides API route handlers for core functionalities from the
 * `@daitanjs/intelligence` and `@daitanjs/senses` packages. It exposes
 * endpoints for direct LLM chat, image generation, and image analysis.
 */
import { generateIntelligence } from '@daitanjs/intelligence';
import { generateImage, analyzeImage } from '@daitanjs/senses';
import {
  handleApiError,
  createSuccessResponse,
  getJsonBody,
} from './helpers.js';
import { withAuth } from '@daitanjs/middleware';

/**
 * Route handler for direct, stateful chat with an LLM.
 * Expects a POST request with a JSON body matching `GenerateIntelligenceParams`.
 * e.g., { "prompt": { "user": "Hi" }, "config": { "llm": { "target": "..." } } }
 *
 * @param {import('next/server').NextRequest} req - The Next.js request object.
 * @returns {Promise<import('next/server').NextResponse>}
 */
async function llmChatHandler(req) {
  try {
    const payload = await getJsonBody(req);
    // The payload from the request body should now match the structured
    // `GenerateIntelligenceParams` object.
    const result = await generateIntelligence(payload);
    return createSuccessResponse(result);
  } catch (error) {
    return handleApiError(error, 'llmChatHandler');
  }
}
export const handleLlmChat = withAuth(llmChatHandler);

/**
 * Route handler for AI image generation (DALL-E).
 * Expects a POST request with a JSON body matching `GenerateImageParams`.
 * e.g., `{ "prompt": "...", "size": "..." }`.
 *
 * @param {import('next/server').NextRequest} req - The Next.js request object.
 * @returns {Promise<import('next/server').NextResponse>}
 */
async function imageGenerationHandler(req) {
  try {
    // The `generateImage` function now expects a single parameter object.
    const payload = await getJsonBody(req);
    const result = await generateImage({
      ...payload,
      response_format: 'url', // Force URL format for API delivery
    });
    return createSuccessResponse(result);
  } catch (error) {
    return handleApiError(error, 'imageGenerationHandler');
  }
}
export const handleImageGeneration = withAuth(imageGenerationHandler);

/**
 * Route handler for AI image analysis (Vision).
 * Expects a POST request with a JSON body matching `AnalyzeImageParams`.
 * e.g., `{ "imageSource": "...", "prompt": "..." }`.
 *
 * @param {import('next/server').NextRequest} req - The Next.js request object.
 * @returns {Promise<import('next/server').NextResponse>}
 */
async function imageAnalysisHandler(req) {
  try {
    // The `analyzeImage` function was refactored to accept a single parameter object.
    const payload = await getJsonBody(req);
    const result = await analyzeImage(payload);
    return createSuccessResponse(result);
  } catch (error) {
    return handleApiError(error, 'imageAnalysisHandler');
  }
}
export const handleImageAnalysis = withAuth(imageAnalysisHandler);