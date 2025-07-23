// intelligence/src/intelligence/rag/retrieval.js
/**
 * @file Contains the core RAG (Retrieval-Augmented Generation) pipeline logic.
 * @module @daitanjs/intelligence/rag/retrieval
 *
 * @description
 * This is the central function for querying the RAG system. It orchestrates a
 * multi-step process that can include query transformation (HyDE), initial
 * document retrieval from a vector store, relevance re-ranking with an LLM,
 * and final answer synthesis. It also manages chat history for stateful conversations.
 */
import path from 'path';
import { getVectorStore } from './vectorStoreFactory.js';
import { getSessionMemoryHistory, saveSessionContext } from './chatMemory.js';
import { generateIntelligence } from '../core/llmOrchestrator.js';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanApiError,
  DaitanError,
  DaitanInvalidInputError,
} from '@daitanjs/error';

const retrievalLogger = getLogger('daitan-rag-retrieval');

/**
 * Generates a hypothetical document to improve retrieval accuracy (HyDE).
 * @private
 */
async function generateHydeDocumentInternal(query, options, logger) {
  const { hydeLlmConfig = {}, localVerbose: verbose, trackUsage } = options;
  try {
    const { response: hypotheticalDocument, usage: hydeUsage } =
      await generateIntelligence({
        prompt: {
          system: {
            persona: 'You are an expert assistant that writes documents.',
            task: "Generate a full, detailed, hypothetical document that perfectly answers the user's question. This document will be used to improve semantic search; it should not be shown to the user.",
          },
          user: `The user is asking: "${query}"`,
        },
        config: {
          response: { format: 'text' },
          llm: {
            target: hydeLlmConfig.target || 'FAST_TASKER',
            temperature: hydeLlmConfig.temperature ?? 0.3,
            maxTokens: hydeLlmConfig.maxTokens ?? 500,
          },
          verbose,
          trackUsage,
        },
        metadata: { summary: 'RAG HyDE Generation' },
      });
    return {
      document: String(hypotheticalDocument || query),
      usage: hydeUsage,
    };
  } catch (error) {
    logger.error(
      `HyDE: Error generating hypothetical document: ${error.message}`
    );
    // Fallback to the original query if HyDE fails
    return { document: query, usage: null };
  }
}

/**
 * Re-ranks retrieved documents using an LLM for better relevance.
 * @private
 */
async function reRankDocsWithLlm(query, documents, options, logger) {
  if (!documents || documents.length === 0) return { docs: [], usage: null };
  const { reRankerLlmConfig = {}, localVerbose: verbose, trackUsage } = options;
  const docsWithContent = documents.filter(
    (doc) => doc.pageContent && doc.pageContent.trim()
  );

  const snippetsForReranking = docsWithContent
    .map(
      (doc, i) =>
        `DOCUMENT ${i}:\n${doc.pageContent.substring(0, 1500)}...\n---`
    )
    .join('\n');

  try {
    const { response, usage } = await generateIntelligence({
      prompt: {
        system: {
          persona: 'You are an expert relevance-ranking assistant.',
          task: 'Analyze the provided documents and score their relevance to the user query on a scale of 0 to 100 (0=irrelevant, 100=perfect match).',
          outputFormat:
            'You MUST respond with a single JSON object. Keys are document indices (e.g., "0", "1"), values are relevance scores (e.g., 85). Example: {"0": 95, "1": 20, "2": 80}',
        },
        user: `User Query: "${query}"\n\nDocuments to rank:\n${snippetsForReranking}`,
      },
      config: {
        response: { format: 'json' },
        llm: {
          target: reRankerLlmConfig.target || 'FAST_TASKER', // FAST_TASKER is fine for this
          temperature: reRankerLlmConfig.temperature ?? 0.0,
          maxTokens: reRankerLlmConfig.maxTokens ?? 500,
        },
        verbose,
        trackUsage,
      },
      metadata: { summary: 'RAG Re-ranking' },
    });

    if (typeof response !== 'object' || response === null) {
      logger.warn(
        'LLM Re-ranker returned non-object response. Skipping re-ranking.'
      );
      return { docs: docsWithContent, usage };
    }

    docsWithContent.forEach((doc, i) => {
      doc.relevanceScore =
        typeof response[String(i)] === 'number' ? response[String(i)] : 0;
    });

    const rerankedDocs = docsWithContent.sort(
      (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0)
    );

    return { docs: rerankedDocs, usage };
  } catch (error) {
    logger.error(
      `LLM Re-ranker failed: ${error.message}. Returning original order.`
    );
    return { docs: docsWithContent, usage: null };
  }
}

/**
 * The main RAG pipeline function.
 * @param {string} query The user's question.
 * @param {import('./interfaces.js').AskWithRetrievalOptions} [options={}]
 * @returns {Promise<import('./interfaces.js').RetrievalResult>}
 */
export const askWithRetrieval = async (query, options = {}) => {
  const configManager = getConfigManager();
  if (!query)
    throw new DaitanInvalidInputError("A valid 'query' string is required.");

  const {
    topK = 5,
    useHyDE = false,
    useLlmReRanker = false,
    synthesisLlmConfig = {},
    callbacks,
    sessionId,
    useAnalysisPrompt = false,
    allowGeneralKnowledge = false,
    ...adapterOptions
  } = options;
  const currentCallVerbose =
    adapterOptions.localVerbose ??
    configManager.get('RAG_RETRIEVAL_VERBOSE', false);
  const trackUsageOverall =
    adapterOptions.trackUsage ?? configManager.get('LLM_TRACK_USAGE', true);

  let queryForRetrieval = query;
  let hydeUsageInfo = null;
  if (useHyDE) {
    /* ... */
  }

  let retrievedDocs = [];
  try {
    retrievalLogger.info(
      `RAG Step: Retrieving documents for query: "${queryForRetrieval.substring(
        0,
        70
      )}..."`
    );
    const adapter = await getVectorStore(adapterOptions);
    const initialK = useLlmReRanker ? Math.max(10, topK * 2) : topK;
    const vectorDocs = await adapter.similaritySearchWithScore(
      queryForRetrieval,
      initialK,
      adapterOptions.filter
    );
    retrievedDocs = vectorDocs.map(([doc, score]) => ({
      ...doc,
      score,
      retrieverType: 'vector_store_adapter',
    }));
  } catch (error) {
    retrievalLogger.warn(
      `askWithRetrieval: Vector search failed. Error: ${error.message}. Proceeding without retrieved docs.`
    );
  }

  let reRankerUsageInfo = null;
  if (useLlmReRanker && retrievedDocs.length > 0) {
    /* ... */
  }

  const finalDocsForLLM = retrievedDocs.slice(0, topK);

  retrievalLogger.info(
    `RAG Step: Synthesizing answer from ${finalDocsForLLM.length} documents...`
  );
  const snippets =
    finalDocsForLLM.length > 0
      ? finalDocsForLLM
          .map(
            (doc, i) =>
              `Snippet ${i + 1} (Source: ${
                doc.metadata.source_filename ||
                path.basename(String(doc.metadata.source || ''))
              }):\n${doc.pageContent}`
          )
          .join('\n\n---\n\n')
      : 'No relevant snippets found in the knowledge base.';

  const memoryHistory = sessionId
    ? await getSessionMemoryHistory(sessionId)
    : [];
  const historyText = memoryHistory
    .map((m) => `${m._getType()}: ${String(m.content).substring(0, 150)}...`)
    .join('\n');

  let systemPrompt, userPrompt;

  // --- THE DEFINITIVE FIX: A SMARTER SYNTHESIS PROMPT ---
  if (useAnalysisPrompt) {
    systemPrompt = {
      persona: 'You are a meticulous data analyst and research assistant.',
      task: 'Carefully read all provided "Context Snippets" and provide a detailed, factual analysis that directly answers the user\'s request. Synthesize information from multiple snippets if necessary, and present it clearly, for example in a list or table.',
      guidelines: [
        'Base your entire analysis STRICTLY on the provided snippets.',
        'If the snippets do not contain the answer, state that clearly.',
      ],
    };
    userPrompt = `CONTEXT SNIPPETS:\n---\n${snippets}\n---\nUSER'S ANALYTICAL REQUEST:\n${query}\n\nANALYSIS RESULT:`;
  } else {
    // This is the new, more intelligent default prompt.
    systemPrompt = {
      persona:
        'You are a helpful AI assistant that answers questions by reasoning over the provided context.',
      // It now encourages synthesis and reasoning, not just strict extraction.
      task: `Answer the user's question by synthesizing and reasoning over the provided "Context Snippets". Connect information from multiple snippets if necessary to form a complete answer. If the information is not in the snippets, you MUST state that clearly.`,
      guidelines: [
        'Be concise and directly answer the question.',
        'When you use information from a snippet, cite its source (e.g., "[Source: doc1.pdf]").',
      ],
    };
    userPrompt = `CONTEXT SNIPPETS:\n---\n${snippets}\n---\nCHAT HISTORY:\n---\n${
      historyText || 'No previous conversation history.'
    }\n---\nQUESTION:\n${query}\n\nANSWER:`;
  }

  try {
    const { response: answerText, usage: synthesisUsageInfo } =
      await generateIntelligence({
        prompt: { system: systemPrompt, user: userPrompt },
        config: {
          response: { format: 'text' },
          llm: {
            target:
              synthesisLlmConfig.target ||
              (useAnalysisPrompt
                ? 'openai|gpt-4-turbo'
                : 'MASTER_COMMUNICATOR'),
            temperature: synthesisLlmConfig.temperature ?? 0.01,
            maxTokens: synthesisLlmConfig.maxTokens ?? 1500,
          },
          verbose: currentCallVerbose,
          trackUsage: trackUsageOverall,
        },
        callbacks,
      });

    if (sessionId) {
      await saveSessionContext(
        sessionId,
        { input: query },
        { output: String(answerText || '') }
      );
    }

    return {
      text: String(answerText || ''),
      retrievedDocs: finalDocsForLLM,
      originalQuery: query,
      hydeUsage: trackUsageOverall ? hydeUsageInfo : null,
      reRankerUsage: trackUsageOverall ? reRankerUsageInfo : null,
      synthesisUsage: trackUsageOverall ? synthesisUsageInfo : null,
    };
  } catch (llmError) {
    throw llmError instanceof DaitanError
      ? llmError
      : new DaitanApiError(
          `Error during RAG synthesis: ${llmError.message}`,
          'SynthesisLLM',
          llmError.status,
          {},
          llmError
        );
  }
};
