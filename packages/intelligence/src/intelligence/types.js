/**
 * @typedef {Object} IntelligenceConfig
 * @property {Array} [messages] - Manually constructed message history
 * @property {string} [model] - OpenAI model (e.g., gpt-4o)
 * @property {string} [summary] - For logging or tracing context
 * @property {number} [temperature] - Randomness
 * @property {number} [max_tokens] - Token limit
 * @property {string} [responseFormat] - "json" or "text"
 * @property {boolean} [verbose] - Enable console logging
 * @property {string} [apiKey] - Override default key
 * @property {string} [instruction] - System role for the assistant
 * @property {string} [input] - User prompt
 * @property {boolean} [useMemory] - Enable memory tracking
 * @property {boolean} [trace] - Enable LangSmith tracing
 */
