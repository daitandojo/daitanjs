// speech/src/tts/providers/google.js
/**
 * @file Contains the TTS synthesis logic specifically for the Google Cloud Text-to-Speech provider.
 * @module @daitanjs/speech/tts/providers/google
 * @private
 */
import TextToSpeech from '@google-cloud/text-to-speech';
import fsPromises from 'fs/promises';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanExternalDependencyError,
  DaitanApiError,
  DaitanError,
} from '@daitanjs/error';
import defaultVoiceMapData from '../voices.json' with { type: 'json' };

const logger = getLogger('daitan-tts-provider-google');

let googleTtsClientInstance = null;
let googleTtsClientInitializationAttempted = false;
const DEFAULT_VOICE_MAP = defaultVoiceMapData;

/**
 * Initializes and returns the Google Cloud TextToSpeechClient.
 * @private
 */
const getGoogleTtsClient = () => {
  const configManager = getConfigManager();
  if (googleTtsClientInstance) {
    return googleTtsClientInstance;
  }
  if (googleTtsClientInitializationAttempted) {
    throw new DaitanConfigurationError(
      'Google Cloud TTS client previously failed to initialize. Review logs and GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }
  googleTtsClientInitializationAttempted = true;

  const googleCredentialsSource = configManager.get(
    'GOOGLE_APPLICATION_CREDENTIALS'
  );
  const clientOptions = {};
  if (googleCredentialsSource) {
    try {
      const credsObject = JSON.parse(googleCredentialsSource);
      if (credsObject.project_id && credsObject.private_key) {
        clientOptions.credentials = credsObject;
        logger.info('TTS Client (Google): Using direct JSON credentials.');
      } else {
        clientOptions.keyFilename = googleCredentialsSource;
        logger.info(
          `TTS Client (Google): Using keyFilename: "${googleCredentialsSource}"`
        );
      }
    } catch (e) {
      clientOptions.keyFilename = googleCredentialsSource;
      logger.info(
        `TTS Client (Google): Using keyFilename: "${googleCredentialsSource}" (assumed path).`
      );
    }
  } else {
    logger.warn(
      'TTS Client (Google): GOOGLE_APPLICATION_CREDENTIALS not set. Attempting to use Application Default Credentials.'
    );
  }

  try {
    googleTtsClientInstance = new TextToSpeech.TextToSpeechClient(
      clientOptions
    );
    logger.info('Google Cloud TextToSpeechClient initialized successfully.');
    return googleTtsClientInstance;
  } catch (e) {
    const errorMsg = `Google TTS client initialization failed: ${e.message}.`;
    logger.error(`CRITICAL - ${errorMsg}`);
    throw new DaitanExternalDependencyError(
      `${errorMsg} Ensure GOOGLE_APPLICATION_CREDENTIALS is set correctly or Application Default Credentials are configured.`,
      {},
      e
    );
  }
};

/**
 * Synthesizes speech using Google Cloud TTS.
 * @param {object} params - The synthesis parameters.
 * @returns {Promise<string>} The path to the created audio file.
 */
export async function synthesizeWithGoogle(params) {
  const {
    text,
    outputFile,
    languageCode,
    ssmlGender,
    customVoiceMap,
    audioConfigOverrides,
    callId,
  } = params;
  const client = getGoogleTtsClient();
  const effectiveVoiceMap = customVoiceMap || DEFAULT_VOICE_MAP;

  let selectedVoiceName;
  const languageVoices = effectiveVoiceMap[languageCode];
  if (languageVoices) {
    selectedVoiceName =
      languageVoices[ssmlGender.toUpperCase()] ||
      languageVoices['NEUTRAL'] ||
      languageVoices['FEMALE'] ||
      languageVoices['MALE'];
  }
  if (!selectedVoiceName) {
    logger.warn(
      `[${callId}] No specific voice found in map for ${languageCode}/${ssmlGender}. Google will select a default.`
    );
  }

  const request = {
    input: {
      text: text.trim(),
    },
    voice: {
      languageCode,
      ssmlGender: ssmlGender.toUpperCase(),
      ...(selectedVoiceName && {
        name: selectedVoiceName,
      }),
    },
    audioConfig: {
      audioEncoding: 'MP3',
      ...audioConfigOverrides,
    },
  };

  logger.debug(`[${callId}] Google Cloud TTS API Request:`, {
    voice: request.voice,
    audioConfig: request.audioConfig,
  });

  try {
    const [synthesisResponse] = await client.synthesizeSpeech(request);
    if (!synthesisResponse?.audioContent?.length) {
      throw new DaitanApiError(
        'No audio content received from Google Cloud TTS API.',
        'GoogleCloudTTS'
      );
    }
    logger.info(
      `[${callId}] Received ${synthesisResponse.audioContent.length} bytes from Google. Writing to file.`
    );
    await fsPromises.writeFile(
      outputFile,
      synthesisResponse.audioContent,
      'binary'
    );
    return outputFile;
  } catch (error) {
    logger.error(
      `[${callId}] Error in Google Cloud TTS process: ${error.message}`,
      {
        errorCode: error.code,
      }
    );
    if (error instanceof DaitanError) throw error;
    throw new DaitanApiError(
      `Google Cloud TTS API error: ${error.details || error.message}`,
      'GoogleCloudTTS',
      error.code,
      {},
      error
    );
  }
}