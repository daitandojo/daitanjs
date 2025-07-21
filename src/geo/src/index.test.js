// src/media/src/youtube.test.js
import { query as apiQuery } from '@daitanjs/apiqueries';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import {
  fetchVideoDetails,
  searchVideos,
  fetchChannelDetails,
  convertURLtoMP3,
} from './index.js';
import {
  DaitanInvalidInputError,
  DaitanConfigurationError,
  DaitanNotFoundError,
  DaitanApiError,
  DaitanOperationError,
} from '@daitanjs/error';
import { getConfigManager } from '@daitanjs/config';
import { EventEmitter } from 'events'; // Import EventEmitter for better mocking

// --- Mocking Setup ---

jest.mock('@daitanjs/apiqueries');
jest.mock('child_process');
jest.mock('fs/promises');

jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('@daitanjs/config', () => ({
  getConfigManager: jest.fn(() => ({
    get: jest.fn((key) => {
      if (key === 'YOUTUBE_API_KEY') return 'DUMMY_YOUTUBE_KEY';
      if (key === 'YT_DLP_PATH') return 'yt-dlp'; // Use the default command name
      return undefined;
    }),
  })),
}));

describe('@daitanjs/media/youtube', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('YouTube Data API Functions', () => {
    describe('fetchVideoDetails', () => {
      it('should fetch and return video details for a valid ID', async () => {
        const mockResponse = {
          items: [
            {
              id: 'dQw4w9WgXcQ',
              snippet: { title: 'Never Gonna Give You Up' },
            },
          ],
        };
        apiQuery.mockResolvedValue(mockResponse);

        const details = await fetchVideoDetails('dQw4w9WgXcQ');

        expect(apiQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://www.googleapis.com/youtube/v3/videos',
            params: expect.objectContaining({ id: 'dQw4w9WgXcQ' }),
          })
        );
        expect(details).toEqual(mockResponse.items[0]);
      });

      it('should throw DaitanNotFoundError if no items are returned', async () => {
        apiQuery.mockResolvedValue({ items: [] });
        await expect(fetchVideoDetails('nonexistent_id')).rejects.toThrow(
          DaitanNotFoundError
        );
      });

      it('should throw DaitanInvalidInputError for an invalid video ID', async () => {
        await expect(fetchVideoDetails(' ')).rejects.toThrow(
          DaitanInvalidInputError
        );
      });
    });

    describe('searchVideos', () => {
      it('should perform a search and return formatted results', async () => {
        const mockResponse = {
          items: [{ id: { videoId: '123' } }],
          nextPageToken: 'token123',
        };
        apiQuery.mockResolvedValue(mockResponse);

        const results = await searchVideos('daitanjs', { maxResults: 5 });

        expect(apiQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://www.googleapis.com/youtube/v3/search',
            params: expect.objectContaining({ q: 'daitanjs', maxResults: 5 }),
          })
        );
        expect(results.items).toEqual(mockResponse.items);
        expect(results.nextPageToken).toBe('token123');
      });
    });

    describe('fetchChannelDetails', () => {
      it('should fetch and return channel details for a valid ID', async () => {
        const mockResponse = {
          items: [
            { id: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw', snippet: { title: 'Google' } },
          ],
        };
        apiQuery.mockResolvedValue(mockResponse);

        const details = await fetchChannelDetails('UC-lHJZR3Gqxm24_Vd_AJ5Yw');

        expect(apiQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://www.googleapis.com/youtube/v3/channels',
            params: expect.objectContaining({ id: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw' }),
          })
        );
        expect(details).toEqual(mockResponse.items[0]);
      });
    });
  });

  describe('convertURLtoMP3 (yt-dlp)', () => {
    let mockChildProcess;

    beforeEach(() => {
      // Setup mock for spawn using a proper EventEmitter
      mockChildProcess = new EventEmitter();
      mockChildProcess.stdout = new EventEmitter();
      mockChildProcess.stderr = new EventEmitter();
      spawn.mockReturnValue(mockChildProcess);

      // Setup mock for fs
      fs.mkdir.mockResolvedValue(undefined);
      fs.stat.mockResolvedValue({ isFile: () => true, size: 1024 });
    });

    it('should spawn yt-dlp with the correct arguments', async () => {
      const promise = convertURLtoMP3({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        outputDir: './audio',
        baseName: 'rick',
      });

      // Simulate successful close
      mockChildProcess.emit('close', 0);

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'yt-dlp',
        expect.arrayContaining([
          '--extract-audio',
          '--audio-format',
          'mp3',
          '--output',
          expect.stringContaining('rick.%(ext)s'),
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        ])
      );
    });

    it('should resolve with the correct output file path on success', async () => {
      const promise = convertURLtoMP3({
        url: 'https://www.youtube.com/watch?v=abc',
        outputDir: '/tmp/audio',
        baseName: 'song',
      });

      // Simulate successful process exit
      mockChildProcess.emit('close', 0);

      const outputPath = await promise;

      const expectedPath = require('path').resolve('/tmp/audio', 'song.mp3');
      expect(outputPath).toBe(expectedPath);
    });

    it('should reject with DaitanOperationError if yt-dlp exits with a non-zero code', async () => {
      const promise = convertURLtoMP3({
        url: 'https://www.youtube.com/watch?v=abc',
        outputDir: '/tmp',
        baseName: 'fail',
      });

      // Simulate error exit
      mockChildProcess.emit('close', 1);

      await expect(promise).rejects.toThrow(DaitanOperationError);
    });

    it('should reject with DaitanOperationError if the spawn command fails', async () => {
      const spawnError = new Error('Command not found');
      const promise = convertURLtoMP3({
        url: 'https://www.youtube.com/watch?v=abc',
        outputDir: '/tmp',
        baseName: 'fail',
      });

      // Simulate spawn error
      mockChildProcess.emit('error', spawnError);

      await expect(promise).rejects.toThrow(DaitanOperationError);
      await expect(promise).rejects.toThrow(/Failed to start yt-dlp/);
    });

    it('should reject if the output file is empty after successful process exit', async () => {
      fs.stat.mockResolvedValue({ isFile: () => true, size: 0 }); // Simulate empty file

      const promise = convertURLtoMP3({
        url: 'https://www.youtube.com/watch?v=abc',
        outputDir: '/tmp',
        baseName: 'empty_file',
      });

      mockChildProcess.emit('close', 0);

      await expect(promise).rejects.toThrow(DaitanOperationError);
      await expect(promise).rejects.toThrow(/is empty/);
    });
  });
});
