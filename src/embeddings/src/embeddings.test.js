// embeddings/src/embeddings.test.js
import {
  generateEmbedding,
  generateBatchEmbeddings,
  EmbeddingCache,
} from './embeddings.js';
import { query as apiQuery } from '@daitanjs/apiqueries';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanInvalidInputError,
  DaitanApiError,
  DaitanConfigurationError,
} from '@daitanjs/error';

// --- Mocking Setup ---
jest.mock('@daitanjs/apiqueries');
jest.mock('@daitanjs/development', () => ({
  getLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  isTensorFlowSupported: jest.fn().mockReturnValue(false), // Assume no TF for these tests
}));
jest.mock('@daitanjs/config', () => ({
  getConfigManager: () => ({
    get: jest.fn((key) => {
      if (key === 'OPENAI_API_KEY') return 'DUMMY_EMBEDDING_KEY';
      if (key === 'EMBEDDING_CACHE_CAPACITY') return 100;
      return undefined;
    }),
    getApiKeyForProvider: jest.fn().mockReturnValue('DUMMY_EMBEDDING_KEY'),
  }),
}));

describe('@daitanjs/embeddings', () => {
  const mockEmbedding = [0.1, 0.2, 0.3];
  const mockApiResponse = {
    data: [{ embedding: mockEmbedding }],
    model: 'text-embedding-3-small',
    usage: { prompt_tokens: 8, total_tokens: 8 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    apiQuery.mockResolvedValue(mockApiResponse);
    // Clear the internal module cache for each test
    new EmbeddingCache().clearSharedCache();
  });

  describe('generateEmbedding', () => {
    it('should call the OpenAI API with the correct parameters for a single string', async () => {
      // --- AMENDED: Use new structured API call ---
      await generateEmbedding({
        input: 'Test string',
        config: { target: 'openai|text-embedding-3-small' },
      });

      expect(apiQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.openai.com/v1/embeddings',
          data: { input: ['Test string'], model: 'text-embedding-3-small' },
        })
      );
    });

    it('should return the correct embedding result for a single string', async () => {
      // --- AMENDED: Use new structured API call ---
      const result = await generateEmbedding({ input: 'Test string' });

      expect(result.embedding).toEqual(mockEmbedding);
      expect(result.modelUsed).toBe('text-embedding-3-small');
      expect(result.usage.total_tokens).toBe(8);
    });

    it('should handle a batch of strings correctly', async () => {
      const batchResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
        model: 'text-embedding-3-small',
      };
      apiQuery.mockResolvedValue(batchResponse);

      // --- AMENDED: Use new structured API call ---
      const result = await generateEmbedding({
        input: ['String 1', 'String 2'],
      });

      expect(apiQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { input: ['String 1', 'String 2'], model: expect.any(String) },
        })
      );
      expect(result.embedding).toBeInstanceOf(Array);
      expect(result.embedding.length).toBe(2);
      expect(result.embedding[1]).toEqual([0.4, 0.5, 0.6]);
    });

    it('should use the cache for single string inputs when enabled', async () => {
      // --- AMENDED: Use new structured API call ---
      // First call (miss)
      await generateEmbedding({
        input: 'Cache me',
        config: { useCache: true },
      });
      expect(apiQuery).toHaveBeenCalledTimes(1);

      // Second call (hit)
      const result = await generateEmbedding({
        input: 'Cache me',
        config: { useCache: true },
      });
      expect(apiQuery).toHaveBeenCalledTimes(1); // Should not have been called again
      expect(result.embedding).toEqual(mockEmbedding);
    });

    it('should throw DaitanInvalidInputError for invalid input', async () => {
      await expect(generateEmbedding({ input: '' })).rejects.toThrow(
        DaitanInvalidInputError
      );
      await expect(generateEmbedding({ input: [''] })).rejects.toThrow(
        DaitanInvalidInputError
      );
      await expect(generateEmbedding({ input: [123] })).rejects.toThrow(
        DaitanInvalidInputError
      );
    });
  });

  describe('EmbeddingCache', () => {
    it('should use the cache instance to get an embedding', async () => {
      const cache = new EmbeddingCache();

      // First call (miss)
      await cache.getEmbedding('Cache test');
      expect(apiQuery).toHaveBeenCalledTimes(1);

      // Second call (hit)
      await cache.getEmbedding('Cache test');
      expect(apiQuery).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should allow overriding the target model for a specific call', async () => {
      const cache = new EmbeddingCache({ target: 'openai|default-model' });
      await cache.getEmbedding('Override test', 'openai|special-model');

      expect(apiQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { input: ['Override test'], model: 'special-model' },
        })
      );
    });
  });
});
