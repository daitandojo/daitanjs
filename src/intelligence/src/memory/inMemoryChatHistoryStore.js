// src/memory/inMemoryChatHistoryStore.js
/**
 * @file In-memory implementation of the chat message history store.
 * @module @daitanjs/intelligence/memory/inMemoryChatHistoryStore
 *
 * @description
 * This module provides an in-memory chat history store, which is suitable for
 * development, testing, or single-process applications. It holds session histories
 * in a simple JavaScript Map.
 *
 * NOTE: This implementation is not suitable for production environments that are
 * stateless (e.g., serverless functions) or run on multiple instances (e.g.,
 * load-balanced servers), as each instance would have its own separate memory.
 * For production, a persistent store like Redis or a database should be used.
 * @implements {import('./iChatMessageHistoryStore.js').IChatMessageHistoryStore}
 */
import { ChatMessageHistory } from 'langchain/memory';
import { getLogger } from '@daitanjs/development';

const logger = getLogger('daitan-in-memory-history');

export class InMemoryChatMessageHistoryStore {
  constructor() {
    /**
     * @private
     * @type {Map<string, ChatMessageHistory>}
     */
    this.histories = new Map();
    logger.info('InMemoryChatMessageHistoryStore initialized.');
  }

  /**
   * Retrieves the LangChain chat history object for a given session ID.
   * If a history for the session does not exist, it is created.
   *
   * @param {string} sessionId - The unique identifier for the conversation session.
   * @returns {Promise<ChatMessageHistory>} A promise that resolves to a `ChatMessageHistory` instance.
   */
  async getHistory(sessionId) {
    if (!this.histories.has(sessionId)) {
      logger.debug(
        `Creating new in-memory ChatMessageHistory for session: ${sessionId}`
      );
      this.histories.set(sessionId, new ChatMessageHistory());
    }
    return this.histories.get(sessionId);
  }

  /**
   * Clears the chat history for a specific session.
   *
   * @param {string} sessionId - The unique identifier for the session to clear.
   * @returns {Promise<void>}
   */
  async clear(sessionId) {
    if (this.histories.has(sessionId)) {
      this.histories.delete(sessionId);
      logger.info(`Cleared in-memory history for session: ${sessionId}`);
    } else {
      logger.debug(
        `Attempted to clear non-existent in-memory history for session: ${sessionId}`
      );
    }
  }

  /**
   * Clears all chat histories managed by the store.
   * @returns {Promise<void>}
   */
  async clearAll() {
    const sessionCount = this.histories.size;
    this.histories.clear();
    logger.info(`Cleared all ${sessionCount} in-memory session histories.`);
  }

  /**
   * A convenience method for development to see all session IDs currently in memory.
   * @returns {string[]} An array of session IDs.
   */
  getAllSessionIds() {
    return Array.from(this.histories.keys());
  }
}
