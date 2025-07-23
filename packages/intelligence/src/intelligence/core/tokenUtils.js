// intelligence/src/intelligence/core/tokenUtils.js
// This is the full, original code for this file.

import { get_encoding } from 'tiktoken';
import { getLogger } from '@daitanjs/development';

const logger = getLogger('token-utils');
const DEFAULT_CHAR_TO_TOKEN_RATIO = 4;
const tiktokenCache = new Map();

const getTiktokenForModel = (modelNameInput) => {
  const modelName = String(modelNameInput || '');
  if (tiktokenCache.has(modelName)) {
    return tiktokenCache.get(modelName);
  }

  let encodingName;
  if (
    modelName.startsWith('gpt-4') ||
    modelName.startsWith('gpt-3.5-turbo') ||
    modelName.startsWith('text-embedding-3') ||
    modelName.startsWith('gpt-4o')
  ) {
    encodingName = 'cl100k_base';
  } else if (modelName.includes('text-embedding-ada-002')) {
    encodingName = 'p50k_base';
  } else {
    logger.debug(
      `No specific tiktoken encoding for model "${modelName}". Defaulting to cl100k_base.`
    );
    encodingName = 'cl100k_base';
  }

  try {
    const encoding = get_encoding(encodingName);
    tiktokenCache.set(modelName, encoding);
    return encoding;
  } catch (error) {
    logger.warn(
      `Could not initialize tiktoken for model "${modelName}" (encoding: ${encodingName}): ${error.message}.`
    );
    return null;
  }
};

export const countTokens = (text, modelName, providerName = 'openai') => {
  if (typeof text !== 'string' || text === '') return 0;

  const openaiCompatibleProviders = [
    'openai',
    'groq',
    'openrouter',
    'anthropic',
  ];
  if (openaiCompatibleProviders.includes(providerName?.toLowerCase() || '')) {
    const tiktokenInstance = getTiktokenForModel(modelName);
    if (tiktokenInstance) {
      try {
        return tiktokenInstance.encode(text).length;
      } catch (error) {
        logger.warn(
          `Tiktoken encoding failed for model "${modelName}". Falling back to char count.`
        );
      }
    }
  }

  const estimatedTokens = Math.ceil(text.length / DEFAULT_CHAR_TO_TOKEN_RATIO);
  logger.debug(
    `Using char-based token approximation for model "${modelName}" (provider: ${providerName}). Chars: ${text.length}, Approx Tokens: ${estimatedTokens}`
  );
  return estimatedTokens;
};

export const countTokensForMessages = (
  messages,
  modelName,
  providerName = 'openai'
) => {
  if (!Array.isArray(messages) || messages.length === 0) return 0;

  const tiktokenInstance = getTiktokenForModel(modelName);
  if (!tiktokenInstance) {
    let totalChars = 0;
    messages.forEach((msg) => {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      }
    });
    return (
      Math.ceil(totalChars / DEFAULT_CHAR_TO_TOKEN_RATIO) + messages.length * 2
    );
  }

  let tokensPerMessage = 3;
  let tokensPerName = 1;

  let numTokens = 0;
  messages.forEach((message) => {
    numTokens += tokensPerMessage;
    for (const key in message) {
      // Note: LangChain message objects have content as a direct property.
      if (key === 'content' && typeof message.content === 'string') {
        numTokens += tiktokenInstance.encode(message.content).length;
      } else if (key === 'name' && message[key]) {
        numTokens += tokensPerName;
      }
    }
  });

  numTokens += 3; // every reply is primed with <|start|>assistant<|message|>
  return numTokens;
};
