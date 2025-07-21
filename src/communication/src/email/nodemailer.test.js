// src/speech/src/tts/index.test.js
import { tts } from './index.js';
import { query as apiQuery } from '@daitanjs/apiqueries';
import TextToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs';
import fsPromises from 'fs/promises';
import {
  DaitanInvalidInputError,
  DaitanConfigurationError,
} from '@daitanjs/error';
import { getConfigManager } from '@daitanjs/config';

// --- Mocking Setup ---
jest.mock('@daitanjs/apiqueries');
jest.mock('@google-cloud/text-to-speech');
jest.mock('fs');
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
    get: jest.fn((key, defaultValue) => {
      if (key === 'GOOGLE_APPLICATION_CREDENTIALS') return '{"is_mock": true}';
      if (key === 'ELEVENLABS_API_KEY') return 'DUMMY_ELEVENLABS_KEY';
      return defaultValue;
    }),
  })),
}));

describe('@daitanjs/speech/tts', () => {
  let synthesizeSpeechMock;
  let createWriteStreamMock;

  beforeEach(() => {
    jest.clearAllMocks();

    synthesizeSpeechMock = jest
      .fn()
      .mockResolvedValue([
        { audioContent: Buffer.from('mock-google-audio-content') },
      ]);
    TextToSpeech.TextToSpeechClient.mockImplementation(() => ({
      synthesizeSpeech: synthesizeSpeechMock,
    }));

    const mockStream = {
      pipe: jest.fn((writer) => {
        setTimeout(() => writer.emit('finish'), 10);
        return writer;
      }),
      on: jest.fn(),
    };
    apiQuery.mockResolvedValue(mockStream);

    const mockWriter = {
      on: jest.fn((event, callback) => {
        if (event === 'finish') mockWriter.finishCallback = callback;
      }),
      emit: jest.fn((event) => {
        if (event === 'finish' && mockWriter.finishCallback)
          mockWriter.finishCallback();
      }),
      finishCallback: null,
    };
    fs.createWriteStream.mockReturnValue(mockWriter);

    fsPromises.mkdir.mockResolvedValue(undefined);
    fsPromises.writeFile.mockResolvedValue(undefined);
  });

  describe('tts function', () => {
    // --- AMENDED: Use the new structured parameter format ---
    const defaultParams = {
      content: { text: 'Hello world' },
      output: { filePath: './output/test.mp3' },
    };

    it('should call the Google provider by default', async () => {
      await tts(defaultParams);
      expect(TextToSpeech.TextToSpeechClient).toHaveBeenCalled();
      expect(synthesizeSpeechMock).toHaveBeenCalled();
      expect(apiQuery).not.toHaveBeenCalled();
    });

    it('should construct the correct request for Google Cloud TTS', async () => {
      // --- AMENDED: Use new structured parameters ---
      await tts({
        ...defaultParams,
        voiceConfig: {
          provider: 'google',
          languageCode: 'en-US',
          ssmlGender: 'FEMALE',
        },
      });

      expect(synthesizeSpeechMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { text: 'Hello world' },
          voice: expect.objectContaining({
            languageCode: 'en-US',
            ssmlGender: 'FEMALE',
            name: expect.any(String),
          }),
          audioConfig: { audioEncoding: 'MP3' },
        })
      );
    });

    it('should call the ElevenLabs provider when specified', async () => {
      // --- AMENDED: Use new structured parameters ---
      await tts({
        ...defaultParams,
        voiceConfig: {
          provider: 'elevenlabs',
          voiceId: 'test_voice_id',
        },
      });

      expect(apiQuery).toHaveBeenCalled();
      expect(synthesizeSpeechMock).not.toHaveBeenCalled();
    });

    it('should construct the correct request for ElevenLabs', async () => {
      const voiceId = 'custom-voice-123';
      // --- AMENDED: Use new structured parameters ---
      await tts({
        ...defaultParams,
        voiceConfig: {
          provider: 'elevenlabs',
          voiceId: voiceId,
        },
      });

      expect(apiQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining(voiceId),
          method: 'POST',
          data: {
            text: 'Hello world',
            model_id: 'eleven_multilingual_v2',
            voice_settings: expect.any(Object),
          },
          headers: expect.objectContaining({
            'xi-api-key': 'DUMMY_ELEVENLABS_KEY',
          }),
        })
      );
    });

    it('should throw DaitanInvalidInputError for invalid text or outputFile', async () => {
      await expect(
        tts({ content: { text: '' }, output: { filePath: './test.mp3' } })
      ).rejects.toThrow(DaitanInvalidInputError);
      await expect(
        tts({ content: { text: 'hello' }, output: { filePath: '  ' } })
      ).rejects.toThrow(DaitanInvalidInputError);
    });

    it('should throw DaitanConfigurationError for an unsupported provider', async () => {
      await expect(
        tts({
          ...defaultParams,
          voiceConfig: { provider: 'unsupported_provider' },
        })
      ).rejects.toThrow(DaitanConfigurationError);
    });

    it('should ensure the output directory exists before writing', async () => {
      const outputPath = '/tmp/daitan/test/audio.mp3';
      const expectedDir = '/tmp/daitan/test';
      // --- AMENDED: Use new structured parameters ---
      await tts({
        content: { text: 'hello' },
        output: { filePath: outputPath },
      });
      expect(fsPromises.mkdir).toHaveBeenCalledWith(expectedDir, {
        recursive: true,
      });
    });
  });
});
