// src/memory/iChatMessageHistoryStore.js
/**
 * @file Defines the interface for chat message history stores.
 * @module @daitanjs/intelligence/memory/iChatMessageHistoryStore
 *
 * @description
 * This file specifies the conceptual interface that all chat message history stores
 * must adhere to within the DaitanJS framework. By defining a consistent contract,
 * the system can seamlessly switch between different storage backends (e.g., in-memory,
 * Redis, database) without changing the agent logic. This is crucial for scalability
 * and moving from development to production environments.
 */

/**
 * @interface IChatMessageHistoryStore
 * Defines the contract for a class that manages chat history for multiple sessions.
 * This allows agents to be stateful across different storage mechanisms.
 */
class IChatMessageHistoryStore {
  /**
   * Retrieves the LangChain chat history object for a given session ID.
   * If a history for the session does not exist, it should be created and returned.
   *
   * @async
   * @param {string} sessionId - The unique identifier for the conversation session.
   * @returns {Promise<import("langchain/memory").BaseChatMessageHistory>} A promise that resolves to a LangChain
   *          `BaseChatMessageHistory` instance (e.g., `ChatMessageHistory`).
   * @abstract
   */
  async getHistory(sessionId) {
    throw new Error(
      "Method 'getHistory(sessionId)' must be implemented by subclass."
    );
  }

  /**
   * Clears the chat history for a specific session.
   *
   * @async
   * @param {string} sessionId - The unique identifier for the session to clear.
   * @returns {Promise<void>} A promise that resolves when the history has been cleared.
   * @abstract
   */
  async clear(sessionId) {
    throw new Error(
      "Method 'clear(sessionId)' must be implemented by subclass."
    );
  }

  /**
   * (Optional but Recommended) Clears all chat histories managed by the store.
   * Useful for testing and system resets.
   *
   * @async
   * @returns {Promise<void>} A promise that resolves when all sessions are cleared.
   * @abstract
   */
  async clearAll() {
    throw new Error("Method 'clearAll()' must be implemented by subclass.");
  }
}

// Exporting an empty object to make this file a module, as interfaces are conceptual in JS.
export {};
