// speech/src/index.js
/**
 * @file Main entry point for the @daitanjs/speech package.
 * @module @daitanjs/speech
 *
 * @description
 * This package offers functionalities for speech synthesis (Text-to-Speech, TTS)
 * and speech recognition (Speech-to-Text, STT).
 *
 * Current capabilities:
 * - **TTS**: Synthesizes speech from text using Google Cloud Text-to-Speech API,
 *   saving the output as an MP3 file. Supports various languages and voice options.
 * - **STT**: Transcribes audio files to text using OpenAI's Whisper API.
 *   Supports multiple audio formats and transcription options.
 *
 * Configuration for cloud provider API keys and credentials (e.g., `OPENAI_API_KEY` for STT,
 * `GOOGLE_APPLICATION_CREDENTIALS` for TTS) is managed via the DaitanJS ConfigManager
 * or environment variables.
 *
 * All operations are asynchronous and return Promises. Errors are handled using
 * custom DaitanJS error types for consistent error management across the DaitanJS ecosystem.
 * Logging is provided via `@daitanjs/development`.
 */

import { getLogger } from '@daitanjs/development';

const speechIndexLogger = getLogger('daitan-speech-index');

speechIndexLogger.debug('Exporting DaitanJS Speech module functionalities...');

// --- Speech-to-Text (STT) ---
// JSDoc for this function is in `src/stt/index.js`.
export { transcribeAudio } from './stt/index.js';
// If there were other STT related exports (e.g., for different providers or utility functions),
// they would be listed here.
// Example:
// export { transcribeAudioWithProviderX } from './stt/providerX.js';
// export { listSttModels } from './stt/utils.js';

// --- Text-to-Speech (TTS) ---
// JSDoc for this function is in `src/tts/index.js`.
export { tts } from './tts/index.js';
// The `voices.json` data is imported and used internally by `src/tts/index.js`.
// It is not typically re-exported from the main index unless consumers need direct,
// raw access to the default voice map for some reason.
// If direct access were needed:
// import defaultGoogleTtsVoiceMapForExport from './tts/voices.json' assert { type: 'json' };
// export { defaultGoogleTtsVoiceMapForExport as defaultGoogleTtsVoices };

speechIndexLogger.info('DaitanJS Speech module exports ready.');
