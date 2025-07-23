// routes/src/speechRoutes.js
/**
 * @file Exports speech-related Next.js App Router route handlers.
 * @module @daitanjs/routes/speechRoutes
 *
 * @description
 * This module serves as the main entry point for speech synthesis (TTS) and
 * speech recognition (STT) API route handlers. It re-exports the handler
 * functions from their respective implementation files.
 *
 * @example
 * // In your `app/api/speech/tts/route.js`:
 * export { handleTTS as POST } from '@daitanjs/routes';
 *
 * // In your `app/api/speech/stt/route.js`:
 * export { handleSTT as POST } from '@daitanjs/routes';
 */

import { getLogger } from '@daitanjs/development';

const speechRoutesIndexLogger = getLogger('daitan-routes-speech-index');

speechRoutesIndexLogger.debug('Exporting DaitanJS Speech route handlers...');

// --- Text-to-Speech (TTS) Route Handler ---
export { handleTTS } from './ttsRoutes.js';

// --- Speech-to-Text (STT) Route Handler ---
export { handleSTT } from './sttRoutes.js'; // CORRECTED PATH
