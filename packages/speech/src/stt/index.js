// packages/speech/src/stt/index.js
/**
 * @file Speech-to-Text (STT) functionalities, primarily using OpenAI's Whisper API.
 * @module @daitanjs/speech/stt
 *
 * @description
 * This module provides functions to transcribe audio files into text. It currently supports
 * OpenAI's Whisper model. Audio files must be provided as local file paths (Node.js).
 *
 * Configuration:
 * - `OPENAI_API_KEY`: Required for OpenAI Whisper API calls.
 *
 * Error Handling:
 * Utilizes DaitanJS custom error types for consistent error reporting.
 */
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanFileOperationError,
  DaitanApiError,
  DaitanInvalidInputError,
} from '@daitanjs/error';
import axios from 'axios';

const logger = getLogger('daitan-speech-stt');

const OPENAI_WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

/**
 * @typedef {Object} SttSource
 * @property {string} filePath - The local path to the audio file (e.g., mp3, wav, m4a).
 */

/**
 * @typedef {Object} SttConfig
 * @property {string} [model="whisper-1"] - The Whisper model to use.
 * @property {string} [language] - Optional: ISO-639-1 language code of the input audio.
 * @property {string} [prompt] - Optional: Text to guide the model's style or provide context.
 * @property {'json'|'text'|'srt'|'verbose_json'|'vtt'} [response_format="json"] - Desired output format.
 * @property {number} [temperature=0] - Sampling temperature (0 to 1).
 */

/**
 * @typedef {Object} TranscribeAudioParams
 * @property {SttSource} source - The source of the audio to transcribe.
 * @property {SttConfig} [config={}] - Configuration for the transcription process.
 */

/**
 * Transcribes an audio file using OpenAI's Whisper API.
 *
 * @public
 * @async
 * @param {TranscribeAudioParams} params - Parameters for transcription.
 * @returns {Promise<string|object>} The transcribed text or a parsed JSON object.
 * @throws {DaitanInvalidInputError} If source or file path is invalid.
 * @throws {DaitanConfigurationError} If OpenAI API key is missing.
 * @throws {DaitanFileOperationError} If the audio file cannot be accessed.
 * @throws {DaitanApiError} If the OpenAI API request fails.
 */
export const transcribeAudio = async ({ source, config = {} }) => {
  
  const configManager = getConfigManager();
  
  const callId = `stt-${path.basename(
    source?.filePath || 'unknown'
  )}-${Date.now().toString(36)}`;
  logger.info(
    `[${callId}] transcribeAudio: Initiated for file: "${source?.filePath}"`
  );

  if (typeof window !== 'undefined') {
    throw new DaitanConfigurationError(
      'transcribeAudio with local file paths is supported in Node.js environments only.'
    );
  }

  if (
    !source ||
    typeof source.filePath !== 'string' ||
    !source.filePath.trim()
  ) {
    throw new DaitanInvalidInputError(
      '`source.filePath` must be a non-empty string.'
    );
  }

  const apiKey = configManager.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new DaitanConfigurationError(
      'OpenAI API key (OPENAI_API_KEY) is not configured.'
    );
  }

  const { filePath } = source;
  let audioFileStream;
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    audioFileStream = fs.createReadStream(filePath);
  } catch (error) {
    const errMsg = `Error accessing or creating read stream for audio file "${filePath}"`;
    throw new DaitanFileOperationError(
      `${errMsg}: ${error.message}`,
      { path: filePath },
      error
    );
  }

  const formData = new FormData();
  formData.append('file', audioFileStream, {
    filename: path.basename(filePath),
  });

  const {
    model = 'whisper-1',
    language,
    prompt,
    response_format = 'json',
    temperature,
  } = config;

  formData.append('model', model);
  if (language) formData.append('language', language);
  if (prompt) formData.append('prompt', prompt);
  formData.append('response_format', response_format);
  if (temperature !== undefined && typeof temperature === 'number') {
    formData.append('temperature', temperature.toString());
  }

  const headers = {
    ...formData.getHeaders(),
    Authorization: `Bearer ${apiKey}`,
    'User-Agent': 'DaitanJS/SpeechClient/1.0',
  };

  logger.debug(`[${callId}] Sending transcription request to OpenAI.`);

  try {
    const response = await axios.post(OPENAI_WHISPER_API_URL, formData, {
      headers,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    logger.info(`[${callId}] Audio transcription successful.`);
    return response.data;
  } catch (error) {
    const errorData = error.response?.data;
    const errorMessage =
      errorData?.error?.message ||
      error.message ||
      'Unknown transcription error.';

    logger.error(
      `[${callId}] Error transcribing audio with OpenAI: ${errorMessage}`
    );

    throw new DaitanApiError(
      `OpenAI audio transcription failed: ${errorMessage}`,
      'OpenAI Whisper',
      error.response?.status,
      { apiErrorDetails: errorData?.error || errorData },
      error
    );
  }
};
