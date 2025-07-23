// intelligence/src/intelligence/core/expertModels.js
import { getEnvVariable } from '@daitanjs/development';

export const DEFAULT_EXPERT_PROFILE_NAME = getEnvVariable(
  'DEFAULT_EXPERT_PROFILE',
  'FAST_TASKER'
);

const getExpertConfig = (envVarKey, defaultValue) => {
  const combinedValue = getEnvVariable(envVarKey, defaultValue);
  const parts = combinedValue.split('|');
  const provider = parts[0]?.trim();
  const model = parts[1]?.trim();
  if (!provider || !model) {
    const [defaultProvider, defaultModel] = defaultValue.split('|');
    return { provider: defaultProvider.trim(), model: defaultModel.trim() };
  }
  return { provider, model };
};

export const EXPERT_MODELS = {
  MASTER_COMMUNICATOR: {
    ...getExpertConfig('LLM_EXPERT_MASTER_COMMUNICATOR', 'openai|gpt-4o-mini'),
    description: 'Expert in clear, concise, and engaging communication.',
    temperature: 0.7,
  },
  CREATIVE_WRITER: {
    ...getExpertConfig('LLM_EXPERT_CREATIVE_WRITER', 'openai|gpt-4-turbo'),
    description: 'Expert in creative writing, storytelling, and brainstorming.',
    temperature: 0.9,
  },
  FAST_TASKER: {
    ...getExpertConfig('LLM_EXPERT_FAST_TASKER', 'openai|gpt-4o-mini'),
    description: 'Optimized for speed on less complex tasks.',
    temperature: 0.5,
  },
  LOCAL_DEFAULT: {
    ...getExpertConfig('LLM_EXPERT_LOCAL_DEFAULT', 'ollama|llama3:instruct'),
    description: 'A general-purpose model running locally via Ollama.',
    temperature: 0.7,
  },
  MASTER_CODER: {
    ...getExpertConfig(
      'LLM_EXPERT_MASTER_CODER',
      'anthropic|claude-3-opus-20240229'
    ),
    description: 'Expert in code generation, debugging, and explanation.',
    temperature: 0.3,
  },
  CODING_STUDENT: {
    ...getExpertConfig('LLM_EXPERT_CODING_STUDENT', 'openai|gpt-4o-mini'),
    description: 'Capable, cost-effective coding assistant for simpler tasks.',
    temperature: 0.5,
  },
  SENTIMENT_WIZARD: {
    ...getExpertConfig('LLM_EXPERT_SENTIMENT_WIZARD', 'openai|gpt-3.5-turbo'),
    description:
      'Specialized in sentiment analysis and understanding nuanced text.',
    temperature: 0.2,
  },
  TRANSLATION_MULTILINGUAL: {
    ...getExpertConfig(
      'LLM_EXPERT_TRANSLATION_MULTILINGUAL',
      'openai|gpt-4o-mini'
    ),
    description: 'Expert in multilingual translation.',
    temperature: 0.1,
  },
  DATA_ANALYSIS_EXPERT: {
    ...getExpertConfig('LLM_EXPERT_DATA_ANALYSIS', 'openai|gpt-4-turbo'),
    description: 'Expert in interpreting data and generating insights.',
    temperature: 0.4,
  },
  RESEARCH_ASSISTANT: {
    ...getExpertConfig('LLM_EXPERT_RESEARCH_ASSISTANT', 'openai|gpt-4-turbo'),
    description:
      'Specialized in synthesizing information and research queries.',
    temperature: 0.5,
  },
};

export const getExpertModelDefinition = (expertName) => {
  if (typeof expertName !== 'string' || !expertName.trim()) return undefined;
  return EXPERT_MODELS[expertName.toUpperCase()];
};

export const getDefaultExpertProfile = () => {
  return getExpertModelDefinition(DEFAULT_EXPERT_PROFILE_NAME);
};
