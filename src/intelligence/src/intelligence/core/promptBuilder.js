// intelligence/src/intelligence/core/promptBuilder.js
/**
 * @file Contains helpers for building and constructing prompt message arrays for LLMs.
 * @module @daitanjs/intelligence/core/promptBuilder
 *
 * @description
 * This module centralizes the logic for creating the list of messages that will be sent
 * to a large language model. It handles the assembly of system messages, few-shot examples
 * (`shots`), and the final user prompt into a structured format compatible with
 * LangChain's chat models.
 */

import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { getLogger } from '@daitanjs/development';

const promptBuilderLogger = getLogger('daitan-prompt-builder');

/**
 * Converts an array of DaitanJS-style message objects into LangChain `BaseMessage` instances.
 * @private
 * @param {Array<Object>} messages - Array of message objects (e.g., `{role: 'user', content: '...'}`).
 * @returns {BaseMessage[]} An array of LangChain message instances.
 */
function convertToLangChainMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }
  return messages.reduce((acc, msg) => {
    if (msg instanceof BaseMessage) {
      acc.push(msg);
    } else if (
      typeof msg === 'object' &&
      msg !== null &&
      typeof msg.role === 'string' &&
      (typeof msg.content === 'string' ||
        Array.isArray(msg.content) ||
        typeof msg.content === 'object') // Allow object for JSON few-shot
    ) {
      const role = msg.role.toLowerCase();
      try {
        if (role === 'system')
          acc.push(new SystemMessage({ content: msg.content }));
        else if (role === 'user' || role === 'human')
          acc.push(new HumanMessage({ content: msg.content }));
        else if (role === 'assistant' || role === 'ai')
          acc.push(new AIMessage({ content: msg.content }));
        else {
          promptBuilderLogger.warn(
            `Unknown message role "${msg.role}". Treating as human.`
          );
          acc.push(new HumanMessage({ content: msg.content }));
        }
      } catch (e) {
        promptBuilderLogger.error(
          'Failed to create LangChain message from object.',
          { messageObject: msg, error: e.message }
        );
        // ignore malformed message
      }
    }
    return acc;
  }, []);
}

/**
 * Builds the final array of message objects to be sent to the LLM from a structured prompt object.
 *
 * @param {Object} prompt - The structured prompt object.
 * @param {Object} [prompt.system] - An object containing parts of the system message (e.g., persona, task).
 * @param {string | object} [prompt.user] - The final user query.
 * @param {Array} [prompt.shots=[]] - Few-shot examples in `{role, content}` format.
 * @returns {BaseMessage[]} An array of LangChain `BaseMessage` objects ready for an LLM.
 */
export const buildLlmMessages = (prompt = {}) => {
  const systemConfig = prompt.system || {};
  const userContent = prompt.user;
  const fewShotExamples = prompt.shots || [];

  // This order defines the structure of the system prompt.
  const systemInstructionParts = [
    systemConfig.persona,
    systemConfig.whoYouAre, // Legacy support
    systemConfig.task,
    systemConfig.whatYouDo, // Legacy support
    systemConfig.guidelines,
    systemConfig.vitals,
    systemConfig.scoring,
    systemConfig.writingStyle,
    systemConfig.outputFormat,
    systemConfig.outputFormatDescription, // Legacy support
    systemConfig.promptingTips,
    systemConfig.reiteration,
  ];

  const systemInstructionContent = systemInstructionParts
    .filter(Boolean)
    .join('\n\n');

  let messages = [];
  if (systemInstructionContent) {
    messages.push({ role: 'system', content: systemInstructionContent });
  }

  if (Array.isArray(fewShotExamples) && fewShotExamples.length > 0) {
    messages.push(
      ...fewShotExamples.filter(
        (s) =>
          s &&
          typeof s.role === 'string' &&
          (typeof s.content === 'string' ||
            Array.isArray(s.content) ||
            typeof s.content === 'object')
      )
    );
  }

  if (
    userContent &&
    (typeof userContent === 'string' || typeof userContent === 'object')
  ) {
    messages.push({ role: 'user', content: userContent });
  }

  return convertToLangChainMessages(messages);
};
