// intelligence/src/intelligence/rag/chatMemory.js
/**
 * @file Manages conversational session memory for RAG chat interactions.
 * @module @daitanjs/intelligence/rag/chatMemory
 *
 * @description
 * This module provides a robust, session-based memory management system. It uses a
 * private, in-memory store (a Map) to hold separate conversation histories for
 * different session IDs. This ensures that concurrent conversations do not interfere
 * with each other, a critical requirement for multi-user or concurrent applications.
 */
import { BufferMemory } from 'langchain/memory';
import { getLogger } from '@daitanjs/development';

const chatMemoryLogger = getLogger('daitan-rag-chat-memory');

/**
 * A map to hold different session memories, keyed by sessionId.
 * This is kept private to the module to enforce access via exported functions.
 * @private
 * @type {Map<string, BufferMemory>}
 */
const sessionMemoryStore = new Map();

/**
 * Creates or retrieves a BufferMemory instance for a given session ID.
 * This is the core function for managing session-specific memory objects.
 * @private
 * @param {string} sessionId - The unique identifier for the conversation session.
 * @returns {BufferMemory | null} The memory instance for the session, or null if sessionId is invalid.
 */
const getSessionMemory = (sessionId) => {
  if (!sessionId || typeof sessionId !== 'string') {
    chatMemoryLogger.warn(
      'A valid sessionId is required to get session memory.'
    );
    return null;
  }

  if (!sessionMemoryStore.has(sessionId)) {
    chatMemoryLogger.info(
      `Creating new BufferMemory for session: ${sessionId}`
    );
    const newMemory = new BufferMemory({
      returnMessages: true,
      memoryKey: 'history', // LangChain's key for chat history in memory
      inputKey: 'input', // LangChain's key for the user's input
    });
    sessionMemoryStore.set(sessionId, newMemory);
  }
  return sessionMemoryStore.get(sessionId);
};

/**
 * Clears the message history for a specific session.
 * @public
 * @param {string} sessionId - The unique identifier of the session to clear.
 */
export const resetSessionMemory = (sessionId) => {
  const memory = getSessionMemory(sessionId);
  if (memory) {
    memory.chatHistory.clear();
    chatMemoryLogger.info(`Cleared memory for session: ${sessionId}`);
  }
};

/**
 * Retrieves the message history for a specific session.
 * @public
 * @async
 * @param {string} sessionId - The unique identifier for the session.
 * @returns {Promise<import('@langchain/core/messages').BaseMessage[]>} A promise that resolves to an array of LangChain message objects.
 */
export const getSessionMemoryHistory = async (sessionId) => {
  const memory = getSessionMemory(sessionId);
  if (!memory) {
    return [];
  }
  const memoryVariables = await memory.loadMemoryVariables({});
  return memoryVariables.history || [];
};

/**
 * Saves the context (input and output) for a specific session.
 * @public
 * @async
 * @param {string} sessionId - The unique identifier for the session.
 * @param {object} inputValues - The input object, e.g., `{ input: "user query" }`.
 * @param {object} outputValues - The output object, e.g., `{ output: "ai response" }`.
 */
export const saveSessionContext = async (
  sessionId,
  inputValues,
  outputValues
) => {
  const memory = getSessionMemory(sessionId);
  if (memory) {
    await memory.saveContext(inputValues, outputValues);
  }
};
