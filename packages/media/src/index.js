// media/src/index.js
/**
 * @file Main entry point for the @daitanjs/media package.
 * @module @daitanjs/media
 *
 * @description
 * This package provides utilities for interacting with media sources, primarily focusing
 * on YouTube. It allows fetching video and channel information, searching for videos,
 * retrieving comments, and converting YouTube videos to MP3 audio using `yt-dlp`.
 * A high-level `transcribeYoutubeVideo` function orchestrates the download and
 * transcription of a video's audio in a single call.
 *
 * All operations are asynchronous and return Promises. Errors are handled using
 * custom DaitanJS error types for consistency.
 *
 * For YouTube Data API interactions, ensure `YOUTUBE_API_KEY` is configured.
 * For `convertURLtoMP3`, ensure `yt-dlp` is installed and accessible, or its path
 * is set via the `YT_DLP_PATH` environment variable.
 */
import { getLogger } from '@daitanjs/development';

const mediaIndexLogger = getLogger('daitan-media-index');

mediaIndexLogger.debug('Exporting DaitanJS Media module functionalities...');

// All functions related to YouTube, including the new high-level one.
export {
  fetchVideoDetails,
  searchVideos,
  fetchVideoComments,
  fetchChannelDetails,
  fetchChannelVideos,
  convertURLtoMP3,
  transcribeYoutubeVideo,
} from './youtube.js';

mediaIndexLogger.info('DaitanJS Media module exports ready.');
