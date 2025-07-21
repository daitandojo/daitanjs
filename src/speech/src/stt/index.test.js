// src/speech/src/stt/index.test.js
import { transcribeAudio } from './index.js';
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import {
  DaitanInvalidInputError,
  DaitanConfigurationError,
  DaitanApiError,
  DaitanFileOperationError,
} from '@daitanjs/error';
import { getConfigManager } from '@daitanjs/config';

// --- Mocking Setup ---
jest.mock('axios');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: { access: jest.fn() },
  createReadStream: jest.fn(),
}));
jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => {
    const formDataInstance = {
      _data: {},
      _files: {},
      append: (key, value, options) => {
        if (options && options.filename) {
          formDataInstance._files[key] = { value, options };
        } else {
          formDataInstance._data[key] = value;
        }
      },
      getHeaders: () => ({
        'Content-Type': 'multipart/form-data; boundary=---...',
      }),
      getAppendedData: () => ({
        ...formDataInstance._data,
        ...formDataInstance._files,
      }),
    };
    return formDataInstance;
  });
});
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
      if (key === 'OPENAI_API_KEY') return 'DUMMY_WHISPER_KEY';
      return undefined;
    }),
  })),
}));

describe('@daitanjs/speech/stt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.promises.access.mockResolvedValue(undefined);
    fs.createReadStream.mockReturnValue({ on: jest.fn(), pipe: jest.fn() });
  });

  const mockAudioPath = '/path/to/test_audio.mp3';

  describe('transcribeAudio', () => {
    it('should successfully transcribe an audio file and return JSON', async () => {
      const mockApiResponse = {
        data: { text: 'Hello, this is a test transcription.' },
      };
      axios.post.mockResolvedValue(mockApiResponse);

      const result = await transcribeAudio({
        source: { filePath: mockAudioPath },
      });

      expect(fs.createReadStream).toHaveBeenCalledWith(mockAudioPath);
      expect(axios.post).toHaveBeenCalled();
      const formDataInstance = FormData.mock.results[0].value;
      const appendedData = formDataInstance.getAppendedData();
      expect(appendedData.model).toBe('whisper-1');
      expect(appendedData.file.options.filename).toBe('test_audio.mp3');
      expect(result).toEqual(mockApiResponse.data);
    });

    it('should include optional parameters like language and prompt in the request', async () => {
      axios.post.mockResolvedValue({ data: { text: 'Hola' } });

      await transcribeAudio({
        source: { filePath: mockAudioPath },
        config: { language: 'es', prompt: 'DaitanJS' },
      });

      const formDataInstance = FormData.mock.results[0].value;
      const appendedData = formDataInstance.getAppendedData();
      expect(appendedData.language).toBe('es');
      expect(appendedData.prompt).toBe('DaitanJS');
    });

    it('should throw DaitanFileOperationError if the audio file cannot be accessed', async () => {
      fs.promises.access.mockRejectedValue(new Error('Permission denied'));
      await expect(
        transcribeAudio({ source: { filePath: mockAudioPath } })
      ).rejects.toThrow(DaitanFileOperationError);
    });

    it('should throw DaitanInvalidInputError if source or filePath is invalid', async () => {
      await expect(
        transcribeAudio({ source: { filePath: '' } })
      ).rejects.toThrow(DaitanInvalidInputError);
      await expect(transcribeAudio({ source: null })).rejects.toThrow(
        DaitanInvalidInputError
      );
    });

    it('should wrap an axios API error in a DaitanApiError', async () => {
      const apiError = {
        isAxiosError: true,
        response: {
          status: 401,
          data: { error: { message: 'Incorrect API key provided' } },
        },
      };
      axios.post.mockRejectedValue(apiError);

      await expect(
        transcribeAudio({ source: { filePath: mockAudioPath } })
      ).rejects.toThrow(DaitanApiError);
    });

    it('should throw a DaitanConfigurationError if API key is not configured', async () => {
      getConfigManager().get.mockImplementation((key) => undefined);
      await expect(
        transcribeAudio({ source: { filePath: mockAudioPath } })
      ).rejects.toThrow(DaitanConfigurationError);
    });
  });
});
