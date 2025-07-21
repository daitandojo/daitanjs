// src/intelligence/src/intelligence/core/tokenUtils.test.js
// This test now uses the actual filesystem to load tiktoken's data.
import { countTokens, countTokensForMessages } from './tokenUtils.js';

// Mock only the logger from development
jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('tokenUtils', () => {
  describe('countTokens', () => {
    it('should count tokens correctly for gpt-4o (cl100k_base)', () => {
      const text = 'Hello world! This is a test.';
      // Actual tokenization: ['Hello', ' world', '!', ' This', ' is', ' a', ' test', '.'] -> 8 tokens
      expect(countTokens(text, 'gpt-4o')).toBe(8);
    });

    it('should count tokens correctly for gpt-3.5-turbo (cl100k_base)', () => {
      const text = 'DaitanJS provides utilities for modern development.';
      // Actual tokenization: ['Daitan', 'JS', ' provides', ' utilities', ' for', ' modern', ' development', '.'] -> 8 tokens
      expect(countTokens(text, 'gpt-3.5-turbo-0125')).toBe(8);
    });

    it('should count tokens correctly for text-embedding-ada-002 (p50k_base)', () => {
      const text = 'This is an embedding test.';
      // Actual tokenization: ['This', ' is', ' an', ' embedding', ' test', '.'] -> 6 tokens
      expect(countTokens(text, 'text-embedding-ada-002')).toBe(6);
    });

    it('should return 0 for empty or non-string input', () => {
      expect(countTokens('')).toBe(0);
      expect(countTokens(null)).toBe(0);
    });

    it('should use character-based approximation for unknown providers', () => {
      const text = 'This is a sixteen-char string.'; // 30 chars
      expect(countTokens(text, 'some-model', 'unknown-provider')).toBe(8); // 30 / 4 = 7.5 -> ceil(7.5) = 8
    });
  });

  describe('countTokensForMessages', () => {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' }, // 6 tokens
      { role: 'user', content: 'Hello, what is DaitanJS?' }, // 7 tokens
    ];

    it('should count tokens for a list of messages for gpt-4 models', () => {
      // system: 3(base) + 6(content) = 9
      // user: 3(base) + 7(content) = 10
      // priming: 3
      // total = 9 + 10 + 3 = 22
      expect(countTokensForMessages(messages, 'gpt-4o')).toBe(22);
    });

    it('should handle messages with names for OpenAI models', () => {
      const messagesWithName = [
        { role: 'user', content: 'What is my name?', name: 'Alice' }, // 5 tokens
        { role: 'assistant', content: 'Your name is Alice.', name: 'Bob' }, // 5 tokens
      ];
      // msg1: 3(base) + 1(name) + 5(content) = 9
      // msg2: 3(base) + 1(name) + 5(content) = 9
      // priming: 3
      // total = 9 + 9 + 3 = 21
      expect(countTokensForMessages(messagesWithName, 'gpt-4')).toBe(21);
    });

    it('should approximate for non-OpenAI models', () => {
      // content lengths: 29 + 25 = 54. 54/4 = 13.5 -> 14.
      // 2 messages * 2 (overhead) = 4. Total = 14 + 4 = 18.
      expect(
        countTokensForMessages(messages, 'some-model', 'unknown-provider')
      ).toBe(18);
    });

    it('should handle vision model payload with image URLs (approximate)', () => {
      const visionMessages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' }, // 6 tokens
            { type: 'image_url', image_url: { url: 'data:...' } }, // 512 tokens (placeholder)
          ],
        },
      ];
      // text: 6 tokens
      // image: 512 tokens (placeholder)
      // message overhead: 3
      // priming: 3
      // grand total: 6 + 512 + 3 + 3 = 524
      const expectedTokens = countTokensForMessages(visionMessages, 'gpt-4o');
      expect(expectedTokens).toBe(524);
    });
  });
});
