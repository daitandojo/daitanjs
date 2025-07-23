// src/routes/src/otherRoutes.test.js
import { NextResponse } from 'next/server';
import {
  handleLlmChat,
  handleImageGeneration,
  handleImageAnalysis,
} from './intelligenceRoutes.js';
import { handleYoutubeSearch } from './mediaRoutes.js';
import { handleCreatePaymentIntent } from './paymentRoutes.js';
import { handleGetJobStatus } from './queueRoutes.js';

// --- Mock Service Imports ---
import { generateIntelligence } from '@daitanjs/intelligence';
import { generateImage, analyzeImage } from '@daitanjs/senses';
import { searchVideos } from '@daitanjs/media';
import { createPaymentIntent } from '@daitanjs/payments';
import { createQueue } from '@daitanjs/queues';

// --- Mocking Setup ---
jest.mock('@daitanjs/intelligence');
jest.mock('@daitanjs/senses');
jest.mock('@daitanjs/media');
jest.mock('@daitanjs/payments');
jest.mock('@daitanjs/queues');
jest.mock('@daitanjs/middleware', () => ({
  withAuth: jest.fn((handler) => (req, context) => {
    req.user = { id: 'mock-user-id' };
    return handler(req, context);
  }),
}));
jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({ error: jest.fn() })),
}));

const createMockRequest = (
  method,
  body,
  url = 'http://localhost/api/test'
) => ({
  method,
  url: new URL(url),
  json: async () => body,
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('@daitanjs/routes (Other Routes)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Intelligence Routes', () => {
    it('handleLlmChat should call generateIntelligence with the full payload', async () => {
      const mockResponse = {
        response: 'Hello there!',
        usage: { total_tokens: 20 },
      };
      generateIntelligence.mockResolvedValue(mockResponse);
      const requestPayload = {
        prompt: { user: 'Hi' },
        config: { llm: { target: 'FAST_TASKER' } },
      };
      const req = createMockRequest('POST', requestPayload);
      const response = await handleLlmChat(req);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data).toEqual(mockResponse);
      expect(generateIntelligence).toHaveBeenCalledWith(requestPayload);
    });

    it('handleImageGeneration should call generateImage with payload', async () => {
      const mockResponse = { urls: ['http://example.com/image.png'] };
      generateImage.mockResolvedValue(mockResponse);
      const requestPayload = { prompt: 'A cat' };
      const req = createMockRequest('POST', requestPayload);
      const response = await handleImageGeneration(req);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data).toEqual(mockResponse);
      expect(generateImage).toHaveBeenCalledWith({
        ...requestPayload,
        response_format: 'url',
      });
    });

    it('handleImageAnalysis should call analyzeImage with payload', async () => {
      const mockResponse = { analysis: 'This is a cat.' };
      analyzeImage.mockResolvedValue(mockResponse);
      const requestPayload = {
        imageSource: 'http://example.com/cat.png',
        prompt: 'What is this?',
      };
      const req = createMockRequest('POST', requestPayload);
      const response = await handleImageAnalysis(req);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data).toEqual(mockResponse);
      expect(analyzeImage).toHaveBeenCalledWith(requestPayload);
    });
  });

  describe('Media Routes', () => {
    it('should call searchVideos with query params and return results', async () => {
      const mockResults = { items: [{ title: 'Test Video' }] };
      searchVideos.mockResolvedValue(mockResults);
      const req = createMockRequest(
        'GET',
        null,
        'http://localhost/api/media/youtube?query=daitanjs&maxResults=5'
      );
      const response = await handleYoutubeSearch(req);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data).toEqual(mockResults);
      expect(searchVideos).toHaveBeenCalledWith({
        query: 'daitanjs',
        maxResults: 5,
      });
    });
  });

  describe('Payment Routes', () => {
    it('should create a payment intent and return the client secret', async () => {
      const mockPI = {
        id: 'pi_123',
        client_secret: 'pi_123_secret_abc',
        status: 'requires_payment_method',
      };
      createPaymentIntent.mockResolvedValue(mockPI);
      const requestPayload = { amount: 1000, currency: 'usd' };
      const req = createMockRequest('POST', requestPayload);
      const response = await handleCreatePaymentIntent(req);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data.clientSecret).toBe('pi_123_secret_abc');
      expect(createPaymentIntent).toHaveBeenCalledWith(requestPayload);
    });
  });

  describe('Queue Routes', () => {
    it('should get and return the status of a job', async () => {
      const mockJob = {
        id: 'job_abc',
        getState: async () => 'completed',
        isCompleted: async () => true,
        isFailed: async () => false,
      };
      const mockQueue = { getJob: jest.fn().mockResolvedValue(mockJob) };
      createQueue.mockReturnValue(mockQueue);
      const req = createMockRequest(
        'GET',
        null,
        'http://localhost/api/queues/status?queueName=mail-queue&jobId=job_abc'
      );
      const response = await handleGetJobStatus(req);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data.state).toBe('completed');
    });
  });
});
