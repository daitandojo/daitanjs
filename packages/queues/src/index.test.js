// src/queues/src/index.test.js
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createQueue, createWorker, addJob } from './index.js';
import { DaitanInvalidInputError, DaitanOperationError } from '@daitanjs/error';
import { getConfigManager } from '@daitanjs/config';

// --- Mocking Setup ---
jest.mock('bullmq');
jest.mock('ioredis');

jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('@daitanjs/config');
const { getConfigManager: getConfigManagerMock } =
  jest.requireMock('@daitanjs/config');

// Configure mock immediately at the top level
getConfigManagerMock.mockReturnValue({
  get: jest.fn((key, defaultValue) => {
    const config = {
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
    };
    return config[key] || defaultValue;
  }),
});

describe('@daitanjs/queues', () => {
  let mockQueueInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    IORedis.mockImplementation(() => ({
      status: 'ready',
      on: jest.fn(),
    }));

    mockQueueInstance = {
      add: jest.fn().mockResolvedValue({ id: 'job-id-123' }),
    };
    Queue.mockImplementation(() => mockQueueInstance);

    Worker.mockImplementation(() => ({
      on: jest.fn(),
    }));
  });

  describe('createQueue', () => {
    it('should create and return a BullMQ Queue instance', () => {
      const queue = createQueue('test-queue');
      expect(Queue).toHaveBeenCalledWith(
        'test-queue',
        expect.objectContaining({
          connection: expect.any(Object),
        })
      );
      expect(queue).toBe(mockQueueInstance);
    });

    it('should return a cached queue instance on subsequent calls', () => {
      const queue1 = createQueue('cached-queue');
      Queue.mockClear();
      const queue2 = createQueue('cached-queue');

      expect(Queue).not.toHaveBeenCalled();
      expect(queue1).toBe(queue2);
    });

    it('should throw DaitanInvalidInputError for an invalid queue name', () => {
      expect(() => createQueue('')).toThrow(DaitanInvalidInputError);
    });
  });

  describe('createWorker', () => {
    it('should create and return a BullMQ Worker instance', () => {
      const processor = async (job) => {};
      const worker = createWorker('test-queue', processor);
      expect(Worker).toHaveBeenCalledWith(
        'test-queue',
        processor,
        expect.objectContaining({
          connection: expect.any(Object),
        })
      );
    });

    it('should throw DaitanInvalidInputError for invalid arguments', () => {
      const processor = async () => {};
      expect(() => createWorker('', processor)).toThrow(
        DaitanInvalidInputError
      );
      expect(() => createWorker('test-queue', 'not-a-function')).toThrow(
        DaitanInvalidInputError
      );
    });
  });

  describe('addJob', () => {
    it('should get a queue and call its add method', async () => {
      const jobData = { message: 'hello' };
      const jobOptions = { attempts: 3 };
      const job = await addJob('test-queue', 'send-email', jobData, jobOptions);

      expect(Queue).toHaveBeenCalledWith('test-queue', expect.any(Object));
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'send-email',
        jobData,
        jobOptions
      );
      expect(job.id).toBe('job-id-123');
    });

    it('should throw DaitanInvalidInputError for an invalid job name', async () => {
      await expect(addJob('test-queue', '', {})).rejects.toThrow(
        DaitanInvalidInputError
      );
    });

    it('should wrap errors from queue.add in DaitanOperationError', async () => {
      const queueError = new Error('Queue is full');
      mockQueueInstance.add.mockRejectedValue(queueError);

      await expect(addJob('test-queue', 'test-job', {})).rejects.toThrow(
        DaitanOperationError
      );
    });
  });
});
