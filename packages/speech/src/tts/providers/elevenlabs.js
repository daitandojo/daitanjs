// speech/src/tts/providers/elevenlabs.js
/**
 * @file Contains the TTS synthesis logic specifically for the ElevenLabs provider.
 * @module @daitanjs/speech/tts/providers/elevenlabs
 * @private
 */
import fs from 'fs';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { query as apiQuery } from '@daitanjs/apiqueries';
import {
  DaitanConfigurationError,
  DaitanFileOperationError,
  DaitanApiError,
  DaitanError,
} from '@daitanjs/error';

const logger = getLogger('daitan-tts-provider-elevenlabs');

const ELEVENLABS_API_BASE_URL = 'https://api.elevenlabs.io/v1';

/**
 * Synthesizes speech using ElevenLabs API.
 * @param {object} params - The synthesis parameters.
 * @returns {Promise<string>} The path to the created audio file.
 */
export async function synthesizeWithElevenLabs(params) {
  const { text, outputFile, voiceId, audioConfigOverrides, callId } = params;
  const configManager = getConfigManager();
  const apiKey = configManager.get('ELEVENLABS_API_KEY');
  if (!apiKey) {
    throw new DaitanConfigurationError(
      'ELEVENLABS_API_KEY is required but not configured.'
    );
  }

  const effectiveVoiceId = voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default to 'Rachel'
  const url = `${ELEVENLABS_API_BASE_URL}/text-to-speech/${effectiveVoiceId}`;

  const requestBody = {
    text: text.trim(),
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: audioConfigOverrides?.stability ?? 0.5,
      similarity_boost: audioConfigOverrides?.similarity_boost ?? 0.75,
      style: audioConfigOverrides?.style ?? 0.0,
      use_speaker_boost: audioConfigOverrides?.use_speaker_boost ?? true,
    },
  };

  logger.debug(`[${callId}] ElevenLabs API Request to ${url}`, {
    body: requestBody,
  });

  try {
    const responseStream = await apiQuery({
      url,
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      data: requestBody,
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(outputFile);
    responseStream.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        logger.info(
          `[${callId}] ElevenLabs audio content successfully written to: ${outputFile}`
        );
        resolve(outputFile);
      });
      writer.on('error', (err) => {
        logger.error(
          `[${callId}] Error writing ElevenLabs audio stream to file: ${err.message}`
        );
        reject(
          new DaitanFileOperationError(
            `Failed to write audio stream to file: ${err.message}`,
            {
              path: outputFile,
            },
            err
          )
        );
      });
      responseStream.on('error', (err) => {
        logger.error(
          `[${callId}] Error in ElevenLabs API response stream: ${err.message}`
        );
        reject(
          new DaitanApiError(
            `ElevenLabs API stream error: ${err.message}`,
            'ElevenLabs',
            undefined,
            {},
            err
          )
        );
      });
    });
  } catch (error) {
    logger.error(`[${callId}] Error calling ElevenLabs API: ${error.message}`, {
      errorDetails: error.details,
    });
    if (error instanceof DaitanError) throw error;
    throw new DaitanApiError(
      `ElevenLabs API call failed: ${error.message}`,
      'ElevenLabs',
      error.response?.status,
      {},
      error
    );
  }
}
