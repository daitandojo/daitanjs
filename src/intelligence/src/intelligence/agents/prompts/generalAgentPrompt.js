// File: src/intelligence/agents/prompts/generalAgentPrompt.js
import { PromptTemplate } from '@langchain/core/prompts';

// This prompt is a starting point and inspired by common LangChain agent prompts.
// It needs to instruct the LLM on how to use tools and format its thoughts/actions.
// The exact format depends on the agent type LangChain will use (e.g., ReAct, OpenAI Functions).
// For OpenAI Functions/Tools agent, the "tool_names" and "tools" might be handled differently
// (the model itself lists the tools it can call).
// For ReAct, it's more explicit.

// This is a simplified ReAct-style prompt template.
// You might need to adjust this based on the specific LangChain agent type you build.
export const GENERAL_AGENT_SYSTEM_PROMPT_TEMPLATE = `
You are a helpful and intelligent assistant. Your goal is to assist the user with their tasks by reasoning, planning, and using available tools when necessary.

TOOLS:
------
You have access to the following tools:

{tools}

To use a tool, you MUST use the following format in your thought process:

Thought: Do I need to use a tool? Yes
Action: The action to take. Must be one of [{tool_names}].
Action Input: The input to the tool.
Observation: [Wait for the result of the Action]

When you have the result from the Observation, you can continue with another Thought, Action, Action Input, Observation cycle, or if you have enough information to answer the user's request, respond directly.

If you can answer the user's request without using a tool, or after using tools you have the final answer, respond in the following format:

Thought: Do I need to use a tool? No
Final Answer: [Your comprehensive answer to the user's original request]

Begin!

PREVIOUS CONVERSATION HISTORY (if any):
{chat_history}

NEW USER INPUT:
{input}

YOUR THOUGHT PROCESS AND FINAL ANSWER:
{agent_scratchpad}
`;

export const generalAgentPromptTemplate = PromptTemplate.fromTemplate(
  GENERAL_AGENT_SYSTEM_PROMPT_TEMPLATE
);

// Note: For OpenAI Functions/Tools agents, the prompt is simpler as the model handles tool invocation format.
// Example for OpenAI Tools Agent (conceptual, would be used with `createOpenAIToolsAgent`):
export const OPENAI_TOOLS_AGENT_SYSTEM_MESSAGE = `
You are a helpful assistant. You have access to the following tools.
Only use a tool if you cannot answer the user's request directly with your existing knowledge.
When you have a final answer, provide it directly.
`;
