// intelligence/src/intelligence/agents/prompts/index.js
/**
 * @file Re-exports prompt templates specifically designed for AI agents.
 * @module @daitanjs/intelligence/agents/prompts
 *
 * @description
 * This index file serves as the central public interface for accessing various
 * prompt templates tailored for different types of AI agents within the
 * `@daitanjs/intelligence` package.
 *
 * Currently Exported Prompt Templates:
 * - **`generalAgentPromptTemplate`**: A LangChain `PromptTemplate` suitable for
 *   general-purpose ReAct-style agents that need to reason about using tools.
 *   (from `./generalAgentPrompt.js`)
 * - **`OPENAI_TOOLS_AGENT_SYSTEM_MESSAGE`**: A simple system message string
 *   often used with LangChain's `createOpenAIToolsAgent` for agents leveraging
 *   OpenAI's function/tool calling capabilities. (from `./generalAgentPrompt.js`)
 * - **`researchAgentPromptTemplate`**: A LangChain `PromptTemplate` specifically
 *   designed for research-oriented agents, guiding them through a process of
 *   information gathering and synthesis. (from `./researchAgentPrompt.js`)
 *
 * These exports allow applications to easily import and use standardized or
 * specialized prompts when constructing or configuring AI agents.
 * JSDoc for each exported item can be found in its respective source file.
 */

// Re-export all named exports from generalAgentPrompt.js
export {
  generalAgentPromptTemplate,
  OPENAI_TOOLS_AGENT_SYSTEM_MESSAGE, // Useful for OpenAI function/tool calling agents
} from './generalAgentPrompt.js';

// Re-export all named exports from researchAgentPrompt.js
export { researchAgentPromptTemplate } from './researchAgentPrompt.js';

// If other agent-specific prompts (e.g., for planning, reflection, specific tasks)
// were defined in separate files within this directory, they would be exported here as well.
// Example:
// export { planningAgentSystemPrompt } from './planningAgentPrompts.js';
// export { reflectionAgentCritiqueTemplate } from './reflectionAgentPrompts.js';
