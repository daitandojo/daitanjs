// intelligence/src/intelligence/rag/chat.js
/**
 * @file Provides a high-level, stateful chat interface for the RAG system.
 * @module @daitanjs/intelligence/rag/chat
 *
 * @description
 * This module exports `createRagChatInstance`, a factory function that creates
 * a self-contained, stateful chat object. Each instance is assigned a unique
 * session ID, ensuring that its conversational history is completely isolated
 * from other instances. This is a critical feature for building robust,
 * multi-user applications.
 */
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { DaitanOperationError } from '@daitanjs/error';
import { askWithRetrieval } from './retrieval.js';
import { getVectorStore } from './vectorStoreFactory.js';
import { getSessionMemoryHistory, resetSessionMemory } from './chatMemory.js';

const ragChatLogger = getLogger('daitan-rag-chat');

/**
 * @typedef {import('./interfaces.js').RagChatInstance} RagChatInstance
 * @typedef {import('./interfaces.js').AskWithRetrievalOptions} AskWithRetrievalOptions
 */

/**
 * Creates a new, isolated RAG chat instance with its own session memory.
 *
 * @public
 * @async
 * @param {Object} [options={}] - Configuration options for the chat instance.
 * @param {string} [options.collectionName] - The RAG collection to chat with.
 * @param {boolean} [options.localVerbose] - Verbosity override for this instance.
 * @param {boolean} [options.persistent] - Whether to use a persistent vector store.
 * @returns {Promise<RagChatInstance>} A stateful RAG chat instance.
 */
export const createRagChatInstance = async (options = {}) => {
  const configManager = getConfigManager();
  // Each chat instance gets a unique, private session ID to ensure conversational isolation.
  const sessionId = `rag-chat-session-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .substring(2, 8)}`;

  const effectiveVerbose =
    options.localVerbose !== undefined
      ? options.localVerbose
      : configManager.get('RAG_VERBOSE', false);
  const logContext = { sessionId, collection: options.collectionName };

  if (effectiveVerbose) {
    ragChatLogger.info(`Creating new RAG chat instance.`, logContext);
  }

  // Initialize the vector store adapter for this instance.
  let vectorStoreAdapter;
  try {
    vectorStoreAdapter = await getVectorStore({
      ...options,
      localVerbose: effectiveVerbose,
    });
  } catch (error) {
    throw new DaitanOperationError(
      `Could not create RAG chat instance: vector store initialization failed.`,
      logContext,
      error
    );
  }

  // The returned object's methods have access to the `sessionId` via closure.
  const ragChatInstance = {
    /**
     * Asks a question within the context of this chat instance's session.
     * @param {Object} params - The parameters for asking a question.
     * @param {string} params.question - The question to ask.
     * @param {AskWithRetrievalOptions} [params.options={}] - Call-specific options.
     * @returns {Promise<import('./retrieval.js').RetrievalResult>}
     */
    async ask({ question, options: askOptions = {} }) {
      const askLogContext = {
        ...logContext,
        questionPreview: question.substring(0, 50),
      };
      if (effectiveVerbose) {
        ragChatLogger.info(`RAG chat instance: .ask() called.`, askLogContext);
      }

      // Combine instance-level and call-level options, ensuring the instance's
      // session ID is always used.
      const combinedOptions = {
        ...options,
        ...askOptions,
        sessionId, // Pass the instance's unique session ID to every call.
        callbacks: askOptions.callbacks,
        localVerbose:
          askOptions.localVerbose !== undefined
            ? askOptions.localVerbose
            : effectiveVerbose,
      };

      return askWithRetrieval(question, combinedOptions);
    },

    /**
     * Retrieves the message history for this specific chat instance.
     * @returns {Promise<import('@langchain/core/messages').BaseMessage[]>}
     */
    async getHistory() {
      if (effectiveVerbose) {
        ragChatLogger.info(
          `RAG chat instance: .getHistory() called.`,
          logContext
        );
      }
      // Get history for this specific session.
      return getSessionMemoryHistory(sessionId);
    },

    /**
     * Clears the message history for this specific chat instance.
     * @returns {void}
     */
    resetHistory() {
      if (effectiveVerbose) {
        ragChatLogger.info(
          `RAG chat instance: .resetHistory() called.`,
          logContext
        );
      }
      // Reset history for this specific session.
      resetSessionMemory(sessionId);
    },

    /**
     * Returns the underlying vector store adapter for this instance.
     * @returns {import('./vectorStoreAdapterInterface.js').IVectorStoreAdapter}
     */
    getVectorStoreAdapter() {
      return vectorStoreAdapter;
    },
  };

  if (effectiveVerbose) {
    ragChatLogger.info(`RAG chat instance created and ready.`, logContext);
  }
  return ragChatInstance;
};
