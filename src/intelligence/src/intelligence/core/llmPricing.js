// intelligence/src/intelligence/core/llmPricing.js
// This is the full, original code for this file.

import { getLogger } from '@daitanjs/development';

const logger = getLogger('llm-pricing');

export const PROVIDER_MODEL_PRICING = {
  openai: {
    'gpt-4o': { inputCostPer1MTokens: 5.0, outputCostPer1MTokens: 15.0 },
    'gpt-4o-mini': { inputCostPer1MTokens: 0.15, outputCostPer1MTokens: 0.6 },
    'gpt-4-turbo': { inputCostPer1MTokens: 10.0, outputCostPer1MTokens: 30.0 },
    'gpt-4': { inputCostPer1MTokens: 30.0, outputCostPer1MTokens: 60.0 },
    'gpt-3.5-turbo': { inputCostPer1MTokens: 0.5, outputCostPer1MTokens: 1.5 },
    'text-embedding-3-large': {
      inputCostPer1MTokens: 0.13,
      outputCostPer1MTokens: 0.0,
    },
    'text-embedding-3-small': {
      inputCostPer1MTokens: 0.02,
      outputCostPer1MTokens: 0.0,
    },
    'text-embedding-ada-002': {
      inputCostPer1MTokens: 0.1,
      outputCostPer1MTokens: 0.0,
    },
  },
  anthropic: {
    'claude-3-opus-20240229': {
      inputCostPer1MTokens: 15.0,
      outputCostPer1MTokens: 75.0,
    },
    'claude-3-sonnet-20240229': {
      inputCostPer1MTokens: 3.0,
      outputCostPer1MTokens: 15.0,
    },
    'claude-3-haiku-20240307': {
      inputCostPer1MTokens: 0.25,
      outputCostPer1MTokens: 1.25,
    },
  },
  groq: {
    'llama3-8b-8192': {
      inputCostPer1MTokens: 0.05,
      outputCostPer1MTokens: 0.1,
    },
    'llama3-70b-8192': {
      inputCostPer1MTokens: 0.59,
      outputCostPer1MTokens: 0.79,
    },
    'mixtral-8x7b-32768': {
      inputCostPer1MTokens: 0.27,
      outputCostPer1MTokens: 0.27,
    },
  },
  ollama: {
    'llama3:instruct': {
      inputCostPer1MTokens: 0,
      outputCostPer1MTokens: 0,
      details: 'Local model, no cost.',
    },
    'nomic-embed-text': {
      inputCostPer1MTokens: 0,
      outputCostPer1MTokens: 0,
      details: 'Local model, no cost.',
    },
  },
};

export const estimateLlmCost = (
  provider,
  model,
  inputTokens = 0,
  outputTokens = 0
) => {
  const providerKey = provider?.toLowerCase();
  const modelKey = model?.toLowerCase();
  const result = {
    estimatedCostUSD: null,
    currency: 'USD',
    details: 'No pricing information available.',
  };

  if (!providerKey || !modelKey) {
    logger.debug('Provider or model key missing for cost estimation.');
    return result;
  }

  const providerPricing = PROVIDER_MODEL_PRICING[providerKey];
  if (!providerPricing) {
    result.details = `No pricing for provider '${providerKey}'.`;
    return result;
  }

  // Find a matching model, allowing for variants like 'gpt-4-turbo-2024-04-09' to match 'gpt-4-turbo'
  const baseModelKey = Object.keys(providerPricing).find((key) =>
    modelKey.startsWith(key)
  );

  if (!baseModelKey) {
    result.details = `No pricing for model '${modelKey}' under provider '${providerKey}'.`;
    return result;
  }

  const modelPricing = providerPricing[baseModelKey];

  if (
    modelPricing.inputCostPer1MTokens === 0 &&
    modelPricing.outputCostPer1MTokens === 0
  ) {
    result.estimatedCostUSD = 0;
    result.details = modelPricing.details || 'Model is free or local.';
    return result;
  }

  const inputCost =
    (inputTokens / 1_000_000) * (modelPricing.inputCostPer1MTokens || 0);
  const outputCost =
    (outputTokens / 1_000_000) * (modelPricing.outputCostPer1MTokens || 0);

  result.estimatedCostUSD = inputCost + outputCost;
  result.details = `Cost calculated for ${providerKey}/${baseModelKey}.`;

  return result;
};
