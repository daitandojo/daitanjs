// src/media/src/youtube.test.js
import { query as apiQuery } from '@daitanjs/apiqueries';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import {
  fetchVideoDetails,
  searchVideos,
  convertURLtoMP3,
  transcribeYoutubeVideo,
} from './index.js';
import { transcribeAudio } from '@daitanjs/speech'; // For mocking the new dependency
import {
  DaitanInvalidInputError,
  DaitanNotFoundError,
  DaitanApiError,
  DaitanOperationError,
} from '@daitanjs/error';
import { getConfigManager } from '@daitanjs/config';
import { EventEmitter } from 'events';
import path from 'path';

// --- Mocking Setup ---
jest.mock('@daitanjs/apiqueries');
jest.mock('child_process');
jest.mock('fs/promises');
// Mock the entire speech package to control the transcribeAudio function
jest.mock('@daitanjs/speech', () => ({
  transcribeAudio: jest.fn(),
}));

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
      if (key === 'YT_DLP_PATH') return 'yt-dlp';
      return undefined;
    }),
  })),
}));

describe('@daitanjs/media/youtube', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Existing Tests for YouTube Data API & convertURLtoMP3 ---
  // (These tests are still valid and are omitted here for brevity, but would be present in the full file)
  describe('fetchVideoDetails', () => {
    it('should fetch and return video details for a valid ID', async () => {
      const mockResponse = {
        items: [
          { id: 'dQw4w9WgXcQ', snippet: { title: 'Never Gonna Give You Up' } },
        ],
      };
      apiQuery.mockResolvedValue(mockResponse);
      const details = await fetchVideoDetails('dQw4w9WgXcQ');
      expect(apiQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ id: 'dQw4w9WgXcQ' }),
        })
      );
      expect(details).toEqual(mockResponse.items[0]);
    });
  });

  // --- NEW Test Suite for transcribeYoutubeVideo ---
  describe('transcribeYoutubeVideo', () => {
    let mockChildProcess;
    const tempAudioPath = path.join(
      require('os').tmpdir(),
      'daitanjs-yt-transcripts/audio_transcribe-yt-test.mp3'
    );

    beforeEach(() => {
      // Mock the successful download from convertURLtoMP3
      mockChildProcess = new EventEmitter();
      spawn.mockReturnValue(mockChildProcess);
      fs.mkdir.mockResolvedValue(undefined);
      fs.stat.mockResolvedValue({ isFile: () => true, size: 1024 });

      // Mock the successful transcription from @daitanjs/speech
      transcribeAudio.mockResolvedValue({ text: 'This is the transcription.' });

      // Mock the unlink for cleanup
      fs.unlink.mockResolvedValue(undefined);
    });

    it('should orchestrate download, transcription, and cleanup successfully', async () => {
      // This test simulates the entire successful workflow.
      // We'll use a new instance of convertURLtoMP3 for this test's scope
      const localConvertURLtoMP3 = (params) =>
        new Promise((res) => {
          // Simulate the successful execution of yt-dlp
          const finalPath = path.resolve(
            params.outputDir,
            `${params.baseName}.mp3`
          );
          res(finalPath);
        });

      const videoUrl = 'https://www.youtube.com/watch?v=xyz';
      const sttConfig = { language: 'en' };

      // Temporarily replace the exported function with our test-specific mock
      const originalConvert = require('./youtube').convertURLtoMP3;
      require('./youtube').convertURLtoMP3 = jest.fn(localConvertURLtoMP3);

      const result = await transcribeYoutubeVideo({
        url: videoUrl,
        config: sttConfig,
      });

      // 1. Verify download was called
      expect(require('./youtube').convertURLtoMP3).toHaveBeenCalledWith(
        expect.objectContaining({
          url: videoUrl,
        })
      );

      // 2. Verify transcription was called with the temporary path
      expect(transcribeAudio).toHaveBeenCalledWith({
        source: { filePath: expect.stringContaining('.mp3') },
        config: sttConfig,
      });

      // 3. Verify the final result is from the transcription service
      expect(result.text).toBe('This is the transcription.');

      // 4. Verify cleanup was called
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.mp3'));

      // Restore original function
      require('./youtube').convertURLtoMP3 = originalConvert;
    });

    it('should throw DaitanInvalidInputError for an invalid URL', async () => {
      await expect(
        transcribeYoutubeVideo({ url: 'not-a-youtube-url' })
      ).rejects.toThrow(DaitanInvalidInputError);
    });

    it('should clean up the temp file even if transcription fails', async () => {
      const transcriptionError = new DaitanApiError('STT failed');
      transcribeAudio.mockRejectedValue(transcriptionError);

      const localConvertURLtoMP3 = (params) =>
        Promise.resolve(
          path.resolve(params.outputDir, `${params.baseName}.mp3`)
        );
      const originalConvert = require('./youtube').convertURLtoMP3;
      require('./youtube').convertURLtoMP3 = jest.fn(localConvertURLtoMP3);

      await expect(
        transcribeYoutubeVideo({ url: 'https://www.youtube.com/watch?v=abc' })
      ).rejects.toThrow(DaitanApiError);

      // Crucially, check that cleanup still happened
      expect(fs.unlink).toHaveBeenCalled();

      require('./youtube').convertURLtoMP3 = originalConvert;
    });
  });
});
