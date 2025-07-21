// src/intelligence/src/intelligence/core/llmOrchestrator.test.js

// Mock dependencies at the very top
jest.mock('@langchain/openai');
jest.mock('../core/providerConfigs.js');
jest.mock('../../caching/cacheManager.js');
jest.mock('../core/tokenUtils.js');
jest.mock('@daitanjs/utilities');
jest.mock('@daitanjs/error'); // Mock the whole module
jest.mock('@daitanjs/development', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));
jest.mock('@daitanjs/config', () => ({
  getConfigManager: () => ({
    get: jest.fn((key, def) => def),
  }),
}));

import { generateIntelligence } from './llmOrchestrator.js';
import * as providerConfigs from '../core/providerConfigs.js';
import * as cacheManager from '../../caching/cacheManager.js';
import * as tokenUtils from '../core/tokenUtils.js';
import * as utilities from '@daitanjs/utilities';
import * as errorUtils from '@daitanjs/error';
import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { DaitanApiError, DaitanConfigurationError } from '@daitanjs/error';

describe('generateIntelligence (LLM Orchestrator)', () => {
  let mockLlmInstance;
  let mockCacheInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLlmInstance = {
      invoke: jest.fn(),
      stream: jest.fn(),
      _llmType: () => 'mock_openai',
      modelName: 'mock-model',
    };
    ChatOpenAI.mockImplementation(() => mockLlmInstance);

    providerConfigs.resolveProviderConfig.mockResolvedValue({
      providerName: 'openai',
      modelName: 'gpt-mock',
      apiKey: 'dummy-key',
      chatClass: ChatOpenAI,
      supportsJsonMode: true,
      llmInstance: mockLlmInstance,
    });

    mockCacheInstance = { get: jest.fn(), set: jest.fn() };
    cacheManager.getCache.mockReturnValue(mockCacheInstance);
    cacheManager.generateCacheKey.mockReturnValue('mock-cache-key');

    tokenUtils.countTokens.mockReturnValue(10);
    tokenUtils.countTokensForMessages.mockReturnValue(50);
    utilities.delay.mockResolvedValue(undefined);
    errorUtils.isRetryableError.mockReturnValue(true);
  });

  describe('Core Functionality', () => {
    it('should call the LLM with a correctly constructed prompt from parts', async () => {
      mockLlmInstance.invoke.mockResolvedValue({ content: '{"status": "ok"}' });

      await generateIntelligence({
        prompt: {
          system: {
            persona: 'You are a bot.',
            task: 'You respond with JSON.',
          },
          user: 'Are you working?',
        },
        config: {
          response: { format: 'json' },
        },
      });

      expect(mockLlmInstance.invoke).toHaveBeenCalledTimes(1);
      const messages = mockLlmInstance.invoke.mock.calls[0][0];
      expect(messages[0]).toBeInstanceOf(SystemMessage);
      expect(messages[0].content).toContain(
        'You are a bot.\n\nYou respond with JSON.'
      );
      expect(messages[1]).toBeInstanceOf(HumanMessage);
      expect(messages[1].content).toBe('Are you working?');
    });

    it('should correctly handle few-shot examples (shots)', async () => {
      mockLlmInstance.invoke.mockResolvedValue({ content: '4' });

      await generateIntelligence({
        prompt: {
          user: '2+2',
          shots: [
            { role: 'user', content: '1+1' },
            { role: 'assistant', content: '2' },
          ],
        },
        config: {
          response: { format: 'text' },
        },
      });

      const messages = mockLlmInstance.invoke.mock.calls[0][0];
      expect(messages[1]).toBeInstanceOf(HumanMessage);
      expect(messages[1].content).toBe('1+1');
      expect(messages[2]).toBeInstanceOf(AIMessage);
      expect(messages[2].content).toBe('2');
      expect(messages[3]).toBeInstanceOf(HumanMessage);
      expect(messages[3].content).toBe('2+2');
    });

    it('should parse a JSON response successfully', async () => {
      mockLlmInstance.invoke.mockResolvedValue({
        content: '{"status": "success", "data": 42}',
      });

      const { response } = await generateIntelligence({
        prompt: { user: 'Give me JSON' },
        config: { response: { format: 'json' } },
      });
      expect(response).toEqual({ status: 'success', data: 42 });
    });

    it('should throw DaitanConfigurationError if userPrompt is missing', async () => {
      await expect(
        generateIntelligence({ prompt: { system: { persona: 'test' } } })
      ).rejects.toThrow(DaitanConfigurationError);
    });
  });

  describe('Caching Logic', () => {
    it('should use the cache if enabled and key is found', async () => {
      const cachedResponse = { response: { cached: true }, usage: null };
      mockCacheInstance.get.mockReturnValue(cachedResponse);

      const result = await generateIntelligence({
        prompt: { user: 'test' },
        config: { cache: { enabled: true } },
      });

      expect(cacheManager.getCache).toHaveBeenCalledWith(
        'llmResponses',
        expect.any(Object)
      );
      expect(cacheManager.generateCacheKey).toHaveBeenCalled();
      expect(mockCacheInstance.get).toHaveBeenCalledWith('mock-cache-key');
      expect(mockLlmInstance.invoke).not.toHaveBeenCalled();
      expect(result).toEqual(cachedResponse);
    });

    it('should store a response in the cache if enabled', async () => {
      mockCacheInstance.get.mockReturnValue(undefined);
      mockLlmInstance.invoke.mockResolvedValue({
        content: '{"cached": false}',
      });

      await generateIntelligence({
        prompt: { user: 'test' },
        config: { cache: { enabled: true } },
      });

      expect(mockCacheInstance.set).toHaveBeenCalledWith(
        'mock-cache-key',
        expect.objectContaining({ response: { cached: false } })
      );
    });
  });

  describe('Streaming Logic', () => {
    it('should handle streaming text responses with callbacks', async () => {
      async function* mockStream() {
        yield { content: 'Hello' };
        yield { content: ' World' };
      }
      mockLlmInstance.stream.mockReturnValue(mockStream());
      const onTokenStream = jest.fn();
      const onStreamEnd = jest.fn();

      const result = await generateIntelligence({
        prompt: { user: 'stream this' },
        config: { response: { format: 'text' } },
        callbacks: { onTokenStream, onStreamEnd },
      });

      expect(onTokenStream).toHaveBeenCalledTimes(2);
      expect(onTokenStream).toHaveBeenCalledWith('Hello');
      expect(onTokenStream).toHaveBeenCalledWith(' World');
      expect(onStreamEnd).toHaveBeenCalledWith('Hello World', undefined);
      expect(result.response).toBe('Hello World');
    });
  });

  describe('Retry and Error Handling', () => {
    it('should retry a failed operation that is retryable', async () => {
      mockLlmInstance.invoke
        .mockRejectedValueOnce(new Error('Transient API error'))
        .mockResolvedValue({ content: '{"status":"ok"}' });
      errorUtils.isRetryableError.mockReturnValue(true);

      await generateIntelligence({
        prompt: { user: 'test retry' },
        config: { retry: { maxAttempts: 1, initialDelayMs: 1 } },
      });

      expect(mockLlmInstance.invoke).toHaveBeenCalledTimes(2);
      expect(utilities.delay).toHaveBeenCalledTimes(1);
    });

    it('should throw DaitanApiError after exhausting all retries', async () => {
      mockLlmInstance.invoke.mockRejectedValue(new Error('Server busy'));
      errorUtils.isRetryableError.mockReturnValue(true);

      await expect(
        generateIntelligence({
          prompt: { user: 'exhaust retries' },
          config: { retry: { maxAttempts: 2, initialDelayMs: 1 } },
        })
      ).rejects.toThrow(DaitanApiError);
      expect(mockLlmInstance.invoke).toHaveBeenCalledTimes(3);
    });
  });
});
