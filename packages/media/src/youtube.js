// media/src/youtube.js
/**
 * @file YouTube Data API and yt-dlp interaction utilities.
 * @module @daitanjs/media/youtube
 */

import { query as apiQuery } from '@daitanjs/apiqueries';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanApiError,
  DaitanConfigurationError,
  DaitanNotFoundError,
  DaitanOperationError,
  DaitanInvalidInputError,
  DaitanError,
} from '@daitanjs/error';
import { transcribeAudio } from '@daitanjs/speech';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const logger = getLogger('daitan-media-youtube');

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
let YOUTUBE_API_KEY_CACHE = null;

const getYoutubeApiKey = () => {
  const configManager = getConfigManager();

  if (YOUTUBE_API_KEY_CACHE) return YOUTUBE_API_KEY_CACHE;
  const apiKey = configManager.get('YOUTUBE_API_KEY');
  if (!apiKey)
    throw new DaitanConfigurationError(
      'YOUTUBE_API_KEY is required but not configured.'
    );
  YOUTUBE_API_KEY_CACHE = apiKey;
  return apiKey;
};

export const fetchVideoDetails = async (videoId) => {
  const apiKey = getYoutubeApiKey();
  if (!videoId || typeof videoId !== 'string' || !videoId.trim()) {
    throw new DaitanInvalidInputError('Invalid videoId provided.');
  }
  const url = `${YOUTUBE_API_BASE_URL}/videos`;
  const params = {
    part: 'snippet,contentDetails,statistics,status',
    id: videoId,
    key: apiKey,
  };
  try {
    const response = await apiQuery({
      url,
      params,
      summary: `Fetch YouTube video details for ${videoId}`,
    });
    if (!response?.items?.[0])
      throw new DaitanNotFoundError(`Video not found for ID: ${videoId}`);
    return response.items[0];
  } catch (error) {
    if (error instanceof DaitanError) throw error;
    throw new DaitanApiError(
      `Failed to fetch video details for ${videoId}: ${error.message}`,
      'YouTube Data API',
      error.response?.status,
      { videoId },
      error
    );
  }
};

export const searchVideos = async (queryStr, options = {}) => {
  const apiKey = getYoutubeApiKey();
  if (!queryStr || typeof queryStr !== 'string' || !queryStr.trim()) {
    throw new DaitanInvalidInputError(
      'Search query must be a non-empty string.'
    );
  }
  const url = `${YOUTUBE_API_BASE_URL}/search`;
  const params = {
    part: 'snippet',
    q: queryStr,
    type: 'video',
    maxResults: 10,
    order: 'relevance',
    key: apiKey,
    ...options,
  };
  try {
    const response = await apiQuery({
      url,
      params,
      summary: `YouTube search for: ${queryStr}`,
    });
    return {
      items: response?.items || [],
      nextPageToken: response.nextPageToken,
      pageInfo: response.pageInfo,
    };
  } catch (error) {
    if (error instanceof DaitanError) throw error;
    throw new DaitanApiError(
      `YouTube search failed for query "${queryStr}": ${error.message}`,
      'YouTube Data API',
      error.response?.status,
      { query: queryStr },
      error
    );
  }
};

export const fetchVideoComments = async (videoId, options = {}) => {
  const apiKey = getYoutubeApiKey();
  if (!videoId) throw new DaitanInvalidInputError('Invalid videoId provided.');
  const url = `${YOUTUBE_API_BASE_URL}/commentThreads`;
  const params = {
    part: 'snippet,replies',
    videoId,
    maxResults: 20,
    order: 'relevance',
    key: apiKey,
    ...options,
  };
  const response = await apiQuery({
    url,
    params,
    summary: `Fetch comments for ${videoId}`,
  });
  return {
    comments: response?.items || [],
    nextPageToken: response.nextPageToken,
    pageInfo: response.pageInfo,
  };
};

export const fetchChannelDetails = async (channelId) => {
  const apiKey = getYoutubeApiKey();
  if (!channelId)
    throw new DaitanInvalidInputError('Invalid channelId provided.');
  const url = `${YOUTUBE_API_BASE_URL}/channels`;
  const params = { part: 'snippet,statistics', id: channelId, key: apiKey };
  const response = await apiQuery({
    url,
    params,
    summary: `Fetch channel details for ${channelId}`,
  });
  if (!response?.items?.[0])
    throw new DaitanNotFoundError(`Channel not found for ID: ${channelId}`);
  return response.items[0];
};

export const fetchChannelVideos = async (channelId, options = {}) => {
  const apiKey = getYoutubeApiKey();
  if (!channelId)
    throw new DaitanInvalidInputError('Invalid channelId provided.');
  const url = `${YOUTUBE_API_BASE_URL}/search`;
  const params = {
    part: 'snippet',
    channelId,
    maxResults: 10,
    order: 'date',
    type: 'video',
    key: apiKey,
    ...options,
  };
  const response = await apiQuery({
    url,
    params,
    summary: `Fetch videos for channel ${channelId}`,
  });
  return {
    videos: response?.items || [],
    nextPageToken: response.nextPageToken,
    pageInfo: response.pageInfo,
  };
};

export function convertURLtoMP3({ url: videoUrl, outputDir, baseName }) {
  const configManager = getConfigManager();

  return new Promise(async (resolve, reject) => {
    if (!videoUrl || !outputDir || !baseName)
      return reject(
        new DaitanInvalidInputError(
          'URL, outputDir, and baseName are required.'
        )
      );
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (dirError) {
      return reject(
        new DaitanFileOperationError(
          `Failed to create output directory: ${dirError.message}`,
          { path: outputDir },
          dirError
        )
      );
    }
    const outputTemplate = path.resolve(outputDir, `${baseName}.%(ext)s`);
    const ytDlpCommand = configManager.get('YT_DLP_PATH', 'yt-dlp');
    const args = [
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--output',
      outputTemplate,
      videoUrl,
    ];
    const ytDlpProcess = spawn(ytDlpCommand, args);
    ytDlpProcess.on('close', async (code) => {
      if (code === 0) {
        const finalPath = path.resolve(outputDir, `${baseName}.mp3`);
        try {
          const stats = await fs.stat(finalPath);
          if (stats.isFile() && stats.size > 0) resolve(finalPath);
          else
            reject(
              new DaitanOperationError(
                'yt-dlp succeeded but output file is empty or missing.'
              )
            );
        } catch (statError) {
          reject(
            new DaitanOperationError(
              `yt-dlp succeeded but output file verification failed: ${statError.message}`
            )
          );
        }
      } else {
        reject(new DaitanOperationError(`yt-dlp failed with code ${code}.`));
      }
    });
    ytDlpProcess.on('error', (err) =>
      reject(
        new DaitanOperationError(
          `Failed to start yt-dlp: ${err.message}`,
          {},
          err
        )
      )
    );
  });
}

/**
 * @typedef {import('@daitanjs/speech').SttConfig} SttConfig
 */

/**
 * @typedef {Object} TranscribeYoutubeVideoParams
 * @property {string} url - The full URL of the YouTube video.
 * @property {SttConfig} [config] - Configuration options for the speech-to-text process.
 */

/**
 * Downloads a YouTube video's audio, transcribes it, and cleans up the temporary audio file.
 * @public
 * @async
 * @param {TranscribeYoutubeVideoParams} params - The parameters for the transcription workflow.
 * @returns {Promise<string|object>} The transcribed text or JSON object from the STT service.
 */
export const transcribeYoutubeVideo = async ({ url, config = {} }) => {
  const callId = `transcribe-yt-${Date.now().toString(36)}`;
  logger.info(
    `[${callId}] Initiating YouTube transcription workflow for URL: ${url}`
  );

  if (!url || typeof url !== 'string' || !url.includes('youtube.com')) {
    throw new DaitanInvalidInputError('A valid YouTube video URL is required.');
  }

  const tempDir = path.join(os.tmpdir(), 'daitanjs-yt-transcripts');
  const baseName = `audio_${callId}`;
  let tempAudioPath = null;

  try {
    logger.debug(
      `[${callId}] Step 1: Downloading audio to temporary directory...`
    );
    tempAudioPath = await convertURLtoMP3({
      url,
      outputDir: tempDir,
      baseName,
    });
    logger.info(
      `[${callId}] Audio downloaded successfully to: ${tempAudioPath}`
    );

    logger.debug(`[${callId}] Step 2: Transcribing audio file...`);
    const transcriptionResult = await transcribeAudio({
      source: { filePath: tempAudioPath },
      config,
    });
    logger.info(`[${callId}] Transcription successful.`);

    return transcriptionResult;
  } catch (error) {
    logger.error(
      `[${callId}] YouTube transcription workflow failed: ${error.message}`
    );
    if (error instanceof DaitanError) throw error;
    throw new DaitanOperationError(
      `YouTube transcription workflow failed for URL "${url}": ${error.message}`,
      { url },
      error
    );
  } finally {
    if (tempAudioPath) {
      try {
        await fs.unlink(tempAudioPath);
        logger.debug(
          `[${callId}] Step 3: Successfully cleaned up temporary audio file: ${tempAudioPath}`
        );
      } catch (cleanupError) {
        logger.error(
          `[${callId}] CRITICAL: Failed to clean up temporary audio file at ${tempAudioPath}. Manual cleanup may be required. Error: ${cleanupError.message}`
        );
      }
    }
  }
};
