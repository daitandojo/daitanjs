// senses/src/index.js
/**
 * @file Main entry point for the @daitanjs/senses package.
 * @module @daitanjs/senses
 *
 * @description
 * This package provides a suite of utilities for AI-powered sensory tasks,
 * bridging the gap between digital content and machine perception.
 *
 * Key Features:
 * - **Image Generation**: `generateImage` function to create images from text
 *   prompts using OpenAI's DALL-E models.
 * - **Image Analysis**: `analyzeImage` function to interpret and describe images
 *   using OpenAI's vision-capable models (e.g., GPT-4o).
 * - **Media Capture (Browser-only)**:
 *   - `captureAudio`: Captures audio from a user's microphone.
 *   - `captureVideo`: Captures video (and optionally audio) from a user's webcam.
 *
 * It integrates with the DaitanJS ecosystem for configuration, logging, and error handling.
 */

import { getLogger } from '@daitanjs/development';

const sensesIndexLogger = getLogger('daitan-senses-index');

sensesIndexLogger.debug('Exporting DaitanJS Senses module functionalities...');

// --- Image Generation (DALL-E) ---
export { generateImage } from './imagegeneration.js';

// --- Image Analysis (Vision API - e.g., GPT-4o, GPT-4V) ---
export { analyzeImage } from './vision.js';

// --- Media Capture (Browser-only) ---
export { captureAudio, captureVideo } from './capture.js';

sensesIndexLogger.info('DaitanJS Senses module exports ready.');