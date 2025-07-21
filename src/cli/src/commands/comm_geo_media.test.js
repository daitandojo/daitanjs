// src/cli/src/commands/comm_geo_media.test.js
import { Command } from 'commander';
import { registerCommCommands } from './communication.js';
import { registerGeoCommands } from './geo.js';
import { registerImageCommands } from './images.js';
import { registerMediaCommands } from './media.js';
import { registerSensesCommands } from './senses.js';

// --- Mock Service Imports ---
import * as communication from '@daitanjs/communication';
import * as geo from '@daitanjs/geo';
import * as images from '@daitanjs/images';
import * as media from '@daitanjs/media';
import * as senses from '@daitanjs/senses';

import ora from 'ora';

// --- Mocking Setup ---
jest.mock('@daitanjs/communication');
jest.mock('@daitanjs/geo');
jest.mock('@daitanjs/images');
jest.mock('@daitanjs/media');
jest.mock('@daitanjs/senses');

jest.mock('ora', () => {
  const mockOraInstance = {
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: '',
  };
  return jest.fn(() => mockOraInstance);
});
jest.mock('@daitanjs/development', () => ({
  getLogger: () => ({ error: jest.fn() }),
}));

global.console = { ...global.console, log: jest.fn(), error: jest.fn() };

describe('@daitanjs/cli Assorted Commands', () => {
  let program;

  beforeEach(() => {
    program = new Command();
    registerCommCommands(program);
    registerGeoCommands(program);
    registerImageCommands(program);
    registerMediaCommands(program);
    registerSensesCommands(program);
    jest.clearAllMocks();
  });

  describe('comm send-email', () => {
    it('should call sendMail with correct parameters', async () => {
      communication.sendMail.mockResolvedValue({ id: 'job-123' });

      await program.parseAsync([
        'node',
        'daitan',
        'comm',
        'send-email',
        '--to',
        'test@example.com',
        '--subject',
        'CLI Test',
        '--body',
        '<p>Hello</p>',
      ]);

      expect(communication.sendMail).toHaveBeenCalledWith({
        message: {
          to: 'test@example.com',
          subject: 'CLI Test',
          html: '<p>Hello</p>',
        },
      });
      expect(ora().succeed).toHaveBeenCalledWith(
        expect.stringContaining('successfully queued')
      );
    });
  });

  describe('geo forward', () => {
    it('should call forwardGeocode with address and limit', async () => {
      geo.forwardGeocode.mockResolvedValue([{ place_name: 'Paris, France' }]);

      await program.parseAsync([
        'node',
        'daitan',
        'geo',
        'forward',
        'Paris',
        '--limit',
        '1',
      ]);

      expect(geo.forwardGeocode).toHaveBeenCalledWith({
        locationQuery: 'Paris',
        limit: 1,
      });
      expect(ora().succeed).toHaveBeenCalledWith(
        expect.stringContaining('Geocoding successful')
      );
    });
  });

  describe('image upload', () => {
    it('should call uploadImage with file path and provider options', async () => {
      images.uploadImage.mockResolvedValue('http://example.com/image.png');

      await program.parseAsync([
        'node',
        'daitan',
        'image',
        'upload',
        './my-image.jpg',
        '--provider',
        'firebase',
        '--prefix',
        'avatars/',
      ]);

      expect(images.uploadImage).toHaveBeenCalledWith({
        fileSource: expect.stringContaining('my-image.jpg'),
        options: {
          provider: 'firebase',
          providerOptions: {
            firebasePathPrefix: 'avatars/',
            folder: 'avatars/',
          },
        },
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('http://example.com/image.png')
      );
    });
  });

  describe('media download-mp3', () => {
    it('should call convertURLtoMP3 with URL and output options', async () => {
      media.convertURLtoMP3.mockResolvedValue('/output/audio/test_audio.mp3');

      await program.parseAsync([
        'node',
        'daitan',
        'media',
        'download-mp3',
        'http://youtube.com/watch?v=123',
        '--output',
        './audio_out',
        '--name',
        'my_song',
      ]);

      expect(media.convertURLtoMP3).toHaveBeenCalledWith({
        url: 'http://youtube.com/watch?v=123',
        outputDir: expect.stringContaining('audio_out'),
        baseName: 'my_song',
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('/output/audio/test_audio.mp3')
      );
    });
  });

  describe('senses generate-image', () => {
    it('should call generateImage with prompt and DALL-E options', async () => {
      senses.generateImage.mockResolvedValue({
        outputPath: '/path/to/image.png',
      });

      await program.parseAsync([
        'node',
        'daitan',
        'senses',
        'generate-image',
        'a red cat',
        '--model',
        'dall-e-3',
        '--size',
        '1024x1024',
        '--style',
        'vivid',
      ]);

      expect(senses.generateImage).toHaveBeenCalledWith({
        prompt: 'a red cat',
        outputPath: expect.any(String),
        model: 'dall-e-3',
        size: '1024x1024',
        style: 'vivid',
        quality: 'standard',
        response_format: 'b64_json',
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('/path/to/image.png')
      );
    });
  });

  describe('senses analyze-image', () => {
    it('should call analyzeImage with image path and prompt', async () => {
      senses.analyzeImage.mockResolvedValue({ analysis: 'This is a cat.' });

      await program.parseAsync([
        'node',
        'daitan',
        'senses',
        'analyze-image',
        './cat.jpg',
        'what is this?',
      ]);

      expect(senses.analyzeImage).toHaveBeenCalledWith({
        imageSource: './cat.jpg',
        prompt: 'what is this?',
        model: undefined,
        llmConfigOptions: { verbose: false },
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('This is a cat.')
      );
    });
  });
});
