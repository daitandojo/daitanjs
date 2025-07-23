// src/speech/src/tts/index.js
/**
 * @file Text-to-Speech (TTS) functionalities using Google Cloud and ElevenLabs APIs.
 * @module @daitanjs/speech/tts
 *
 * @description
 * This module provides a function to synthesize speech from text and save it as an MP3 file.
 * It supports multiple providers, defaulting to Google Cloud Text-to-Speech, by acting
 * as a dispatcher to provider-specific implementation files.
 *
 * Configuration is managed via `@daitanjs/config`.
 */
import fsPromises from 'fs/promises';
import path from 'path';
import { getLogger } from '@daitanjs/development';
import {
  DaitanConfigurationError,
  DaitanInvalidInputError,
  DaitanFileOperationError,
} from '@daitanjs/error';
import { synthesizeWithGoogle } from './providers/google.js';
import { synthesizeWithElevenLabs } from './providers/elevenlabs.js';

const logger = getLogger('daitan-speech-tts');

/**
 * @typedef {Object} TtsContent
 * @property {string} text - The text to be synthesized into speech.
 */

/**
 * @typedef {Object} TtsVoiceConfig
 * @property {'google' | 'elevenlabs'} [provider='google'] - The TTS provider to use.
 * @property {string} [languageCode] - The BCP-47 language code (e.g., 'en-US', 'es-ES').
 * @property {string} [ssmlGender] - The preferred voice gender (e.g., 'NEUTRAL', 'MALE', 'FEMALE').
 * @property {string} [voiceId] - (ElevenLabs) The specific voice ID to use.
 * @property {object} [audioConfigOverrides] - Provider-specific audio configuration.
 */

/**
 * @typedef {Object} TtsOutputConfig
 * @property {string} filePath - The full path where the output MP3 file will be saved.
 */

/**
 * @typedef {Object} TtsParams
 * @property {TtsContent} content - The content to be synthesized.
 * @property {TtsVoiceConfig} [voiceConfig={}] - Configuration for the voice and provider.
 * @property {TtsOutputConfig} output - Configuration for the output file.
 */

/**
 * Synthesizes speech from text and saves it to an MP3 file, supporting multiple providers.
 *
 * @public
 * @async
 * @param {TtsParams} params - The parameters for text-to-speech synthesis.
 * @returns {Promise<string>} A promise that resolves with the full path to the saved MP3 file.
 */
export const tts = async (params) => {
  const { content, voiceConfig = {}, output } = params;
  const { provider = 'google', ...voiceOptions } = voiceConfig;
  const callId = `tts-${path.basename(
    output?.filePath || 'unknown'
  )}-${Date.now().toString(36)}`;

  if (!content || typeof content.text !== 'string' || !content.text.trim()) {
    throw new DaitanInvalidInputError(
      '`content.text` must be a non-empty string.'
    );
  }
  if (
    !output ||
    typeof output.filePath !== 'string' ||
    !output.filePath.trim()
  ) {
    throw new DaitanInvalidInputError(
      '`output.filePath` must be a non-empty string.'
    );
  }
  if (!output.filePath.toLowerCase().endsWith('.mp3')) {
    logger.warn(
      `[${callId}] Provided output.filePath "${output.filePath}" does not end with .mp3. The output will still be MP3 format.`
    );
  }

  const resolvedOutputPath = path.resolve(output.filePath);
  const outputDir = path.dirname(resolvedOutputPath);
  try {
    await fsPromises.mkdir(outputDir, { recursive: true });
    logger.debug(`[${callId}] Ensured output directory exists: ${outputDir}`);
  } catch (dirError) {
    throw new DaitanFileOperationError(
      `Failed to create output directory "${outputDir}": ${dirError.message}`,
      { path: outputDir },
      dirError
    );
  }

  const synthesisParams = {
    text: content.text,
    outputFile: resolvedOutputPath,
    callId,
    ...voiceOptions, // Pass languageCode, ssmlGender, voiceId, etc.
  };

  logger.info(`[${callId}] Routing TTS request to provider: "${provider}"`);

  switch (provider.toLowerCase()) {
    case 'google':
      return synthesizeWithGoogle(synthesisParams);
    case 'elevenlabs':
      return synthesizeWithElevenLabs(synthesisParams);
    default:
      throw new DaitanConfigurationError(
        `Unsupported TTS provider: "${provider}". Supported providers: 'google', 'elevenlabs'.`
      );
  }
};
