// src/intelligence/src/intelligence/rag/retrieval.test.js
import { askWithRetrieval } from './retrieval.js';
import { getVectorStore, sessionMemory } from './vectorStoreFactory.js';
import { generateIntelligence } from '../core/llmOrchestrator.js';
import { DaitanApiError } from '@daitanjs/error';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

// Mock the dependencies of the retrieval module
jest.mock('./vectorStoreFactory.js', () => ({
  getVectorStore: jest.fn(),
  sessionMemory: {
    loadMemoryVariables: jest.fn().mockResolvedValue({ history: [] }),
    saveContext: jest.fn().mockResolvedValue(undefined),
  },
  DEFAULT_COLLECTION_NAME: 'test_collection',
}));
jest.mock('../core/llmOrchestrator.js');

jest.mock('@daitanjs/development', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@daitanjs/config', () => ({
  getConfigManager: () => ({ get: jest.fn().mockReturnValue(false) }),
}));

describe('askWithRetrieval', () => {
  let mockVectorStoreAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVectorStoreAdapter = {
      similaritySearchWithScore: jest.fn(),
    };
    getVectorStore.mockResolvedValue(mockVectorStoreAdapter);
    sessionMemory.loadMemoryVariables.mockResolvedValue({ history: [] });
  });

  it('should retrieve documents and synthesize an answer', async () => {
    const mockRetrievedDocs = [
      [
        {
          pageContent: 'DaitanJS is a library for web development.',
          metadata: { source: 'doc1.txt' },
        },
        0.9,
      ],
    ];
    mockVectorStoreAdapter.similaritySearchWithScore.mockResolvedValue(
      mockRetrievedDocs
    );

    generateIntelligence.mockResolvedValue({
      response: 'DaitanJS is a JavaScript library.',
      usage: { totalTokens: 100 },
    });

    const result = await askWithRetrieval('What is DaitanJS?');

    expect(getVectorStore).toHaveBeenCalled();
    expect(
      mockVectorStoreAdapter.similaritySearchWithScore
    ).toHaveBeenCalledWith('What is DaitanJS?', 5, undefined);
    expect(generateIntelligence).toHaveBeenCalledTimes(1);
    const synthesisCall = generateIntelligence.mock.calls[0][0];
    expect(synthesisCall.prompt.user).toContain('DaitanJS is a library');
    expect(synthesisCall.prompt.user).toContain(
      "User's Original Question: What is DaitanJS?"
    );
    expect(result.text).toBe('DaitanJS is a JavaScript library.');
    expect(result.retrievedDocs.length).toBe(1);
    expect(sessionMemory.saveContext).toHaveBeenCalledWith(
      { input: 'What is DaitanJS?' },
      { output: 'DaitanJS is a JavaScript library.' }
    );
  });

  it('should use HyDE to generate a hypothetical document for searching', async () => {
    mockVectorStoreAdapter.similaritySearchWithScore.mockResolvedValue([]);

    // First call to generateIntelligence is for HyDE
    generateIntelligence.mockResolvedValueOnce({
      response: 'A hypothetical document about the DaitanJS framework.',
      usage: { totalTokens: 50 },
    });
    // Second call is for synthesis
    generateIntelligence.mockResolvedValueOnce({
      response: "I don't have enough information.",
      usage: { totalTokens: 60 },
    });

    const result = await askWithRetrieval('What is DaitanJS?', {
      useHyDE: true,
    });

    expect(generateIntelligence).toHaveBeenCalledTimes(2);
    const hydeCall = generateIntelligence.mock.calls[0][0];
    expect(hydeCall.prompt.user).toContain(
      'The user is asking: "What is DaitanJS?"'
    );

    expect(
      mockVectorStoreAdapter.similaritySearchWithScore
    ).toHaveBeenCalledWith(
      'A hypothetical document about the DaitanJS framework.',
      5,
      undefined
    );
    expect(result.transformedQuery).toBe(
      'A hypothetical document about the DaitanJS framework.'
    );
    expect(result.hydeUsage).not.toBeNull();
  });

  it('should handle retrieval errors gracefully and attempt synthesis', async () => {
    mockVectorStoreAdapter.similaritySearchWithScore.mockRejectedValue(
      new Error('Vector DB down')
    );
    generateIntelligence.mockResolvedValue({
      response:
        "I'm sorry, but based on the provided documents, I don't have enough information to answer that question.",
      usage: { totalTokens: 40 },
    });

    const result = await askWithRetrieval('What is DaitanJS?');

    expect(mockVectorStoreAdapter.similaritySearchWithScore).toHaveBeenCalled();
    expect(generateIntelligence).toHaveBeenCalledTimes(1);
    const synthesisCall = generateIntelligence.mock.calls[0][0];
    expect(synthesisCall.prompt.user).toContain('No relevant snippets found');
    expect(result.text).toContain("I don't have enough information");
    expect(result.retrievedDocs.length).toBe(0);
  });

  it('should incorporate chat history into the synthesis prompt', async () => {
    sessionMemory.loadMemoryVariables.mockResolvedValue({
      history: [
        new HumanMessage('What is DaitanJS?'),
        new AIMessage('It is a library.'),
      ],
    });
    mockVectorStoreAdapter.similaritySearchWithScore.mockResolvedValue([]);
    generateIntelligence.mockResolvedValue({
      response: 'Yes, as I said, it is a library.',
    });

    await askWithRetrieval('Can you tell me more?');

    expect(generateIntelligence).toHaveBeenCalledTimes(1);
    const synthesisCall = generateIntelligence.mock.calls[0][0];
    expect(synthesisCall.prompt.user).toContain(
      'Previous conversation context'
    );
    expect(synthesisCall.prompt.user).toContain('Human: What is DaitanJS?');
    expect(synthesisCall.prompt.user).toContain('AI: It is a library.');
    expect(synthesisCall.prompt.user).toContain(
      "User's Original Question: Can you tell me more?"
    );
  });

  it('should re-throw a DaitanError from the synthesis LLM call', async () => {
    mockVectorStoreAdapter.similaritySearchWithScore.mockResolvedValue([]);
    const apiError = new DaitanApiError('Synthesis LLM API failed');
    generateIntelligence.mockRejectedValue(apiError);

    await expect(askWithRetrieval('What is DaitanJS?')).rejects.toThrow(
      DaitanApiError
    );
    await expect(askWithRetrieval('What is DaitanJS?')).rejects.toThrow(
      'Synthesis LLM API failed'
    );
  });
});
