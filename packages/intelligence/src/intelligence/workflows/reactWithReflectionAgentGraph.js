// intelligence/src/intelligence/workflows/reactWithReflectionAgentGraph.js
import { END } from '@langchain/langgraph';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { getLogger } from '@daitanjs/development';
import { DaitanLangGraph } from './langGraphManager.js';
import { LLMService } from '../../services/llmService.js';
import {
  DaitanConfigurationError,
  DaitanOperationError,
} from '@daitanjs/error';

const reactGraphLogger = getLogger('daitan-react-reflection-graph');

/**
 * @typedef {import('../../services/llmService.js').LLMUsageInfo} LLMUsageInfo
 * @typedef {import('@langchain/core/tools').BaseTool} LangChainBaseTool
 * @typedef {import('@langchain/core/messages').BaseMessage} BaseMessage
 * @typedef {Object} AgentGraphAction @property {string} tool @property {any} toolInput @property {string} log @property {string} [actionId]
 * @typedef {Object} ReActAgentState @property {HumanMessage | null} inputMessage @property {string} originalQuery @property {BaseMessage[]} messages @property {string} currentThought @property {AgentGraphAction | null} lastAction @property {string | null} lastObservation @property {string | null} lastReflection @property {number} iterationCount @property {string | null} finalAnswer @property {string | null} currentPipelineError @property {LLMService} llmServiceInstance @property {Record<string, LangChainBaseTool>} toolsMap @property {import('../../services/llmService.js').LLMServiceConfig} [reasonerLlmConfig] @property {import('../../services/llmService.js').LLMServiceConfig} [reflectorLlmConfig] @property {LLMUsageInfo[]} llmUsages @property {number} maxIterations @property {boolean} verbose
 */
export const reactAgentStateSchema = {
  inputMessage: { value: (x, y) => y ?? x, default: () => null },
  originalQuery: { value: (x, y) => y ?? x, default: () => '' },
  messages: { value: (x, y) => (x || []).concat(y || []), default: () => [] },
  currentThought: { value: (x, y) => y ?? x, default: () => '' },
  lastAction: { value: (x, y) => y ?? x, default: () => null },
  lastObservation: { value: (x, y) => y ?? x, default: () => null },
  lastReflection: { value: (x, y) => y ?? x, default: () => null },
  iterationCount: { value: (x, y) => y ?? x, default: () => 0 },
  finalAnswer: { value: (x, y) => y ?? x, default: () => null },
  currentPipelineError: { value: (x, y) => y ?? x, default: () => null },
  llmServiceInstance: { value: (x, y) => y ?? x, default: () => null },
  toolsMap: { value: (x, y) => y ?? x, default: () => ({}) },
  reasonerLlmConfig: { value: (x, y) => y ?? x, default: () => ({}) },
  reflectorLlmConfig: { value: (x, y) => y ?? x, default: () => ({}) },
  llmUsages: { value: (x, y) => (x || []).concat(y || []), default: () => [] },
  maxIterations: { value: (x, y) => y ?? x, default: () => 10 },
  verbose: { value: (x, y) => y ?? x, default: () => false },
};

// --- Node Definitions ---

const reasonerNode = async (state) => {
  const {
    messages,
    llmServiceInstance,
    toolsMap,
    reasonerLlmConfig,
    originalQuery,
    iterationCount,
    lastObservation,
    lastReflection,
    llmUsages,
    verbose,
  } = state;

  const toolDescriptions = Object.values(toolsMap)
    .map((t) => `- ${t.name}: ${String(t.description).split('\n')[0]}`)
    .join('\n');
  let reactHistoryContext = '';
  if (state.lastAction)
    reactHistoryContext += `Previous Action: Tool: ${
      state.lastAction.tool
    }, Input: ${JSON.stringify(state.lastAction.toolInput)}\n`;
  if (lastObservation)
    reactHistoryContext += `Previous Observation: ${String(
      lastObservation
    ).substring(0, 500)}...\n`;
  if (lastReflection)
    reactHistoryContext += `Previous Reflection: ${lastReflection}\n`;

  const systemPrompt = {
    persona: `You are a ReAct-style AI assistant trying to answer: "${originalQuery}". You are in the THOUGHT and ACTION phase.`,
    task: `Based on the history and reflection, decide your next step. Your response MUST be a valid JSON object with ONE of two structures: 1. To use a tool: {"thought": "reasoning", "action": { "tool": "tool_name", "toolInput": "input" }} 2. To answer: {"thought": "reasoning", "finalAnswer": "your answer"}`,
  };
  const userPrompt = `Available tools:\n${
    toolDescriptions || 'No tools.'
  }\n\n${reactHistoryContext}Current Conversation History:\n${messages
    .slice(-6)
    .map((m) => `${m._getType()}: ${String(m.content).substring(0, 200)}...`)
    .join('\n')}\n\nProvide your decision as a JSON object.`;

  try {
    const { response: decision, usage } = await llmServiceInstance.generate({
      prompt: { system: systemPrompt, user: userPrompt },
      config: {
        response: { format: 'json' },
        llm: {
          target: reasonerLlmConfig?.target || 'MASTER_COMMUNICATOR',
          temperature: reasonerLlmConfig?.temperature ?? 0.0,
        },
        verbose,
      },
    });
    const newLlmUsages = usage
      ? llmUsages.concat({ step: `reasoner_iter_${iterationCount}`, ...usage })
      : llmUsages;
    if (decision.finalAnswer) {
      return {
        finalAnswer: decision.finalAnswer,
        currentThought: decision.thought,
        lastAction: null,
        messages: messages.concat(
          new AIMessage({
            content: `Thought: ${decision.thought}\nFinal Answer: ${decision.finalAnswer}`,
          })
        ),
        llmUsages: newLlmUsages,
      };
    } else if (decision.action?.tool) {
      return {
        currentThought: decision.thought,
        lastAction: {
          ...decision.action,
          actionId: `tool_call_${iterationCount}`,
        },
        messages: messages.concat(
          new AIMessage({ content: `Thought: ${decision.thought}` })
        ),
        llmUsages: newLlmUsages,
      };
    }
    return {
      currentPipelineError:
        'Reasoner did not produce a valid action or final answer.',
      llmUsages: newLlmUsages,
    };
  } catch (error) {
    return {
      currentPipelineError: `Reasoner error: ${error.message}`,
      llmUsages,
    };
  }
};

const actionExecutorNode = async (state) => {
  const { lastAction, toolsMap, messages } = state;
  if (!lastAction?.tool)
    return {
      lastObservation: 'Error: No action specified.',
      messages,
      currentPipelineError: 'No action specified.',
    };
  const toolToUse = toolsMap[lastAction.tool];
  if (!toolToUse) {
    const errorMsg = `Tool "${lastAction.tool}" not found.`;
    return {
      lastObservation: `Error: ${errorMsg}`,
      messages: messages.concat(
        new ToolMessage({
          tool_call_id: lastAction.actionId,
          content: `Error: ${errorMsg}`,
        })
      ),
      currentPipelineError: errorMsg,
    };
  }
  try {
    const toolOutput = await toolToUse.call(lastAction.toolInput);
    return {
      lastObservation: String(toolOutput),
      messages: messages.concat(
        new ToolMessage({
          tool_call_id: lastAction.actionId,
          content: String(toolOutput),
        })
      ),
    };
  } catch (error) {
    const errorMsg = `Error executing tool ${lastAction.tool}: ${error.message}`;
    return {
      lastObservation: errorMsg,
      messages: messages.concat(
        new ToolMessage({
          tool_call_id: lastAction.actionId,
          content: errorMsg,
        })
      ),
      currentPipelineError: errorMsg,
    };
  }
};

const reflectorNode = async (state) => {
  const {
    messages,
    llmServiceInstance,
    originalQuery,
    currentThought,
    lastAction,
    lastObservation,
    iterationCount,
    reflectorLlmConfig,
    llmUsages,
    verbose,
  } = state;
  const userPrompt = `Query: "${originalQuery}"\nThought: "${
    currentThought || 'N/A'
  }"\nAction: Tool "${lastAction?.tool}", Input: ${JSON.stringify(
    lastAction?.toolInput
  )}\nObservation: "${String(lastObservation).substring(
    0,
    1000
  )}..."\n\nCritique this process and suggest a change for the next step if needed. If all is well, say "Proceeding."`;

  try {
    const { response: reflection, usage } = await llmServiceInstance.generate({
      prompt: {
        system: { persona: 'You are a self-critiquing AI assistant.' },
        user: userPrompt,
      },
      config: {
        response: { format: 'text' },
        llm: {
          target: reflectorLlmConfig?.target || 'FAST_TASKER',
          temperature: reflectorLlmConfig?.temperature ?? 0.1,
        },
        verbose,
      },
    });
    const newLlmUsages = usage
      ? llmUsages.concat({ step: `reflector_iter_${iterationCount}`, ...usage })
      : llmUsages;
    return {
      lastReflection: String(reflection),
      messages: messages.concat(
        new AIMessage({ content: `Reflection: ${reflection}` })
      ),
      llmUsages: newLlmUsages,
      iterationCount: iterationCount + 1,
    };
  } catch (error) {
    const errorMsg = `Reflection error: ${error.message}`;
    return {
      lastReflection: errorMsg,
      messages: messages.concat(new AIMessage({ content: errorMsg })),
      llmUsages,
      iterationCount: iterationCount + 1,
    };
  }
};

const routeAfterReasonerLogic = (state) =>
  state.currentPipelineError
    ? 'error_handler'
    : state.finalAnswer
    ? END
    : 'action_executor';
const routeAfterReflectionLogic = (state) =>
  state.iterationCount >= state.maxIterations ? 'error_handler' : 'reasoner';

export const createReActAgentGraph = async (
  llmServiceInstance,
  tools,
  checkpointerConfig
) => {
  if (!(llmServiceInstance instanceof LLMService))
    throw new DaitanConfigurationError(
      'An instance of LLMService is required.'
    );

  const workflow = new DaitanLangGraph(reactAgentStateSchema, {
    loggerInstance: reactGraphLogger,
  });
  workflow.addNode({ name: 'reasoner', action: reasonerNode });
  workflow.addNode({ name: 'action_executor', action: actionExecutorNode });
  workflow.addNode({ name: 'reflector', action: reflectorNode });
  workflow.addNode({
    name: 'error_handler',
    action: async (state) => ({
      finalAnswer: `Execution failed: ${
        state.currentPipelineError || `Max iterations reached.`
      }`,
    }),
  });

  workflow.setEntryPoint('reasoner');
  workflow.addConditionalEdge({
    sourceNode: 'reasoner',
    condition: routeAfterReasonerLogic,
    pathMap: {
      action_executor: 'action_executor',
      error_handler: 'error_handler',
      [END]: END,
    },
  });
  workflow.addEdge({ sourceNode: 'action_executor', targetNode: 'reflector' });
  workflow.addConditionalEdge({
    sourceNode: 'reflector',
    condition: routeAfterReflectionLogic,
    pathMap: { reasoner: 'reasoner', error_handler: 'error_handler' },
  });
  workflow.addEdge({ sourceNode: 'error_handler', targetNode: END });

  if (checkpointerConfig) await workflow.withPersistence(checkpointerConfig);
  return workflow.compile();
};
