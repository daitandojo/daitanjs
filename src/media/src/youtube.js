import { query } from '@daitanjs/apiqueries';
import { safeExecute } from '@daitanjs/utilities';
import { spawn } from 'child_process';

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

const BASE_URL = 'https://www.googleapis.com/youtube/v3';
const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
  console.error('❌ Missing YOUTUBE_API_KEY in environment variables. Please check your .env file.');
  process.exit(1);
}

// console.log(`YouTube API key initialized: ${API_KEY ? 'Key Found' : 'Key Missing'}`);

/**
 * Fetch video details for a given video ID.
 * @param {string} videoId - The YouTube video ID.
 * @returns {Promise<object|null>} Video details or null if not found.
 */
export const fetchVideoDetails = async (videoId) => {
  return safeExecute(async () => {
    const url = `${BASE_URL}/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${API_KEY}`;
    const response = await query({ url, method: 'GET' });

    if (!response?.items || response.items.length === 0) {
      console.error(`No video details found for videoId: ${videoId}`);
      return null;
    }

    return response.items[0];
  });
};

/**
 * Search for videos on YouTube by query string.
 * @param {string} queryStr - The search query.
 * @param {object} options - Optional parameters (maxResults, type).
 * @returns {Promise<array|null>} Array of search results or null if no results.
 */
export const searchVideos = async (queryStr, options = {}) => {
  const { maxResults = 10, type = 'video' } = options;
  return safeExecute(async () => {
    const url = `${BASE_URL}/search?part=snippet&q=${encodeURIComponent(queryStr)}&type=${type}&maxResults=${maxResults}&key=${API_KEY}`;
    // console.log(`Querying YouTube API with URL: ${url}`);
    const response = await query({ url, method: 'GET' });

    if (!response?.items || response.items.length === 0) {
      console.error('No videos found for the given query.');
      return null; // Explicitly return null if no results are found
    }

    return response.items;
  });
};

/**
 * Fetch comments for a specific video.
 * @param {string} videoId - The YouTube video ID.
 * @param {object} options - Optional parameters (maxResults, pageToken).
 * @returns {Promise<object>} Object containing comments and nextPageToken.
 */
export const fetchVideoComments = async (videoId, options = {}) => {
  const { maxResults = 10, pageToken } = options;
  return safeExecute(async () => {
    const url = `${BASE_URL}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const response = await query({ url, method: 'GET' });

    return {
      comments: response?.items?.map(item => item.snippet.topLevelComment.snippet) || [],
      nextPageToken: response?.nextPageToken || null,
    };
  });
};

/**
 * Fetch channel details for a given channel ID.
 * @param {string} channelId - The YouTube channel ID.
 * @returns {Promise<object|null>} Channel details or null if not found.
 */
export const fetchChannelDetails = async (channelId) => {
  return safeExecute(async () => {
    const url = `${BASE_URL}/channels?part=snippet,contentDetails,statistics&id=${channelId}&key=${API_KEY}`;
    const response = await query({ url, method: 'GET' });

    if (!response?.items || response.items.length === 0) {
      console.error(`No channel details found for channelId: ${channelId}`);
      return null;
    }

    return response.items[0];
  });
};

/**
 * Fetch videos from a channel.
 * @param {string} channelId - The YouTube channel ID.
 * @param {object} options - Optional parameters (maxResults, pageToken).
 * @returns {Promise<object>} Object containing videos and nextPageToken.
 */
export const fetchChannelVideos = async (channelId, options = {}) => {
  const { maxResults = 10, pageToken } = options;
  return safeExecute(async () => {
    const url = `${BASE_URL}/search?part=snippet&channelId=${channelId}&maxResults=${maxResults}&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const response = await query({ url, method: 'GET' });

    return {
      videos: response?.items || [],
      nextPageToken: response?.nextPageToken || null,
    };
  });
};

export function convertURLtoMP3({ url, outputDir, baseName }) {
  const outputTemplate = path.join(outputDir, `${baseName}.%(ext)s`);
  const args = [
    '--extract-audio',
    '--audio-format', 'mp3',
    '--no-playlist',
    '-o', outputTemplate,
    url,
  ];

  const ytDlp = spawn('yt-dlp', args, { cwd: outputDir });

  ytDlp.stdout.on('data', (data) => console.log(data.toString()));
  ytDlp.stderr.on('data', (data) => console.error(data.toString()));
  ytDlp.on('close', (code) => {
    if (code === 0) {
      console.log(`Download and conversion complete: ${outputDir}/${baseName}.mp3`);
    } else {
      console.error(`yt-dlp exited with code ${code}`);
    }
  });
}
