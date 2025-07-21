// src/cli/src/commands/ai_rag.test.js
import { Command } from 'commander';
import { registerAiCommands } from './ai.js';
import { registerRagCommands } from './rag.js';
import * as intelligence from '@daitanjs/intelligence';
import inquirer from 'inquirer';
import ora from 'ora';

// --- Mocking Setup ---
jest.mock('@daitanjs/intelligence');
jest.mock('inquirer');
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
  getLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));
global.console = { ...global.console, log: jest.fn(), error: jest.fn() };

describe('@daitanjs/cli AI and RAG Commands', () => {
  let program;

  beforeEach(() => {
    program = new Command();
    registerAiCommands(program);
    registerRagCommands(program);
    jest.clearAllMocks();
  });

  describe('ai chat command', () => {
    it('should start an interactive chat and call generateIntelligence', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ userInput: 'Hello AI' })
        .mockResolvedValueOnce({ userInput: 'exit' });
      intelligence.generateIntelligence.mockResolvedValue({
        response: 'Hello Human!',
      });

      await program.parseAsync(['node', 'daitan', 'ai', 'chat']);

      expect(intelligence.generateIntelligence).toHaveBeenCalledTimes(1);
      expect(intelligence.generateIntelligence).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.objectContaining({
            shots: [{ role: 'user', content: 'Hello AI' }],
          }),
          config: expect.objectContaining({
            response: { format: 'text' },
          }),
        })
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Hello Human!')
      );
    });
  });

  describe('ai agent command', () => {
    it('should run a plan-and-execute agent', async () => {
      const mockGraphRunner = jest
        .fn()
        .mockResolvedValue({ finalAnswer: 'The plan is complete.' });
      intelligence.createGraphRunner.mockReturnValue(mockGraphRunner);
      intelligence.createPlanAndExecuteAgentGraph.mockResolvedValue(
        'mock-graph'
      );
      intelligence.getDefaultTools.mockReturnValue([]);

      await program.parseAsync([
        'node',
        'daitan',
        'ai',
        'agent',
        'plan',
        'plan a trip',
      ]);

      expect(intelligence.createPlanAndExecuteAgentGraph).toHaveBeenCalled();
      expect(mockGraphRunner).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('The plan is complete.')
      );
    });
  });

  describe('rag add command', () => {
    it('should call loadAndEmbedFile with the correct path and options', async () => {
      intelligence.loadAndEmbedFile.mockResolvedValue(undefined);

      await program.parseAsync([
        'node',
        'daitan',
        'rag',
        'add',
        './my-doc.pdf',
        '--collection',
        'my-collection',
        '--chunk-size',
        '500',
      ]);

      expect(intelligence.loadAndEmbedFile).toHaveBeenCalledWith(
        expect.stringContaining('my-doc.pdf'),
        expect.any(Object),
        expect.objectContaining({
          collectionName: 'my-collection',
          chunkSize: 500,
        })
      );
    });
  });

  describe('rag query command', () => {
    it('should call askWithRetrieval with the correct question and options', async () => {
      intelligence.vectorStoreCollectionExists.mockResolvedValue(true);
      intelligence.askWithRetrieval.mockResolvedValue({
        text: 'The answer is 42.',
      });

      await program.parseAsync([
        'node',
        'daitan',
        'rag',
        'query',
        'what is the meaning of life?',
        '--collection',
        'life-docs',
        '--top-k',
        '3',
      ]);

      expect(intelligence.askWithRetrieval).toHaveBeenCalledWith(
        'what is the meaning of life?',
        expect.objectContaining({ collectionName: 'life-docs', topK: 3 })
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('The answer is 42.')
      );
    });
  });
});
