// intelligence/src/intelligence/workflows/planAndExecuteAgentGraph.js
import { END } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { getLogger } from '@daitanjs/development';
import { DaitanLangGraph } from './langGraphManager.js';
import { LLMService } from '../../services/llmService.js';
import {
  DaitanConfigurationError,
  DaitanOperationError,
} from '@daitanjs/error';

const planAndExecuteLogger = getLogger('daitan-plan-execute-graph');

/**
 * @typedef {import('../../services/llmService.js').LLMUsageInfo} LLMUsageInfo
 * @typedef {import('@langchain/core/tools').BaseTool} LangChainBaseTool
 * @typedef {Object} PlanStep
 * @property {number} step @property {string} task @property {string | null} [toolToUse] @property {any} [toolInput] @property {string} [expectedOutput] @property {"pending" | "completed" | "failed"} [status] @property {any} [result] @property {string} [error]
 * @typedef {Object} PlanAndExecuteAgentState
 * @property {HumanMessage} inputMessage @property {string} originalQuery @property {PlanStep[]} plan @property {number} currentStepIndex @property {Array<{step: number, task: string, result: any, error?: string}>} intermediateStepResults @property {string | null} finalAnswer @property {string | null} currentPipelineError @property {LLMService} llmServiceInstance @property {Record<string, LangChainBaseTool>} toolsMap @property {import('../../services/llmService.js').LLMServiceConfig} [plannerLlmConfig] @property {import('../../services/llmService.js').LLMServiceConfig} [executorLlmConfig] @property {import('../../services/llmService.js').LLMServiceConfig} [synthesizerLlmConfig] @property {LLMUsageInfo[]} llmUsages @property {boolean} verbose
 */
export const planAndExecuteAgentStateSchema = {
  inputMessage: { value: (x, y) => y ?? x, default: () => null },
  originalQuery: { value: (x, y) => y ?? x, default: () => '' },
  plan: { value: (x, y) => y ?? x, default: () => [] },
  currentStepIndex: { value: (x, y) => y ?? x, default: () => 0 },
  intermediateStepResults: {
    value: (x, y) => (x || []).concat(y || []),
    default: () => [],
  },
  finalAnswer: { value: (x, y) => y ?? x, default: () => null },
  currentPipelineError: { value: (x, y) => y ?? x, default: () => null },
  llmServiceInstance: { value: (x, y) => y ?? x, default: () => null },
  toolsMap: { value: (x, y) => y ?? x, default: () => ({}) },
  plannerLlmConfig: { value: (x, y) => y ?? x, default: () => ({}) },
  executorLlmConfig: { value: (x, y) => y ?? x, default: () => ({}) },
  synthesizerLlmConfig: { value: (x, y) => y ?? x, default: () => ({}) },
  llmUsages: { value: (x, y) => (x || []).concat(y || []), default: () => [] },
  verbose: { value: (x, y) => y ?? x, default: () => false },
};

// --- Node Definitions ---

const plannerNode = async (state) => {
  const {
    originalQuery,
    llmServiceInstance,
    toolsMap,
    plannerLlmConfig,
    llmUsages,
    verbose,
  } = state;
  const toolDescriptions = Object.values(toolsMap)
    .map((t) => `- ${t.name}: ${t.description.split('\n')[0]}`)
    .join('\n');
  const plannerUserPrompt = `User Query: "${originalQuery}"\n\nAvailable tools:\n${
    toolDescriptions || 'No tools available.'
  }\n\nBased on the query, create a step-by-step plan as a JSON array of objects.`;
  const plannerSystemPrompt = {
    persona: 'You are an expert planner.',
    task: "Create a step-by-step plan to answer the user's query.",
    outputFormat:
      'Respond ONLY with a valid JSON array of objects. Each object must have keys: "step", "task", "toolToUse", "toolInput", and "expectedOutput". The final step should be for synthesis.',
  };

  try {
    const { response: planArray, usage } = await llmServiceInstance.generate({
      prompt: { system: plannerSystemPrompt, user: plannerUserPrompt },
      config: {
        response: { format: 'json' },
        llm: {
          target: plannerLlmConfig?.target || 'MASTER_COMMUNICATOR',
          temperature: plannerLlmConfig?.temperature ?? 0.1,
        },
        verbose,
      },
    });
    if (usage) llmUsages.push({ step: 'planner', ...usage });
    if (
      !Array.isArray(planArray) ||
      planArray.some((step) => !step.task || typeof step.step !== 'number')
    )
      throw new DaitanOperationError(
        'Planner failed to generate a valid plan.'
      );
    return {
      plan: planArray.map((step) => ({ ...step, status: 'pending' })),
      currentStepIndex: 0,
      llmUsages,
    };
  } catch (error) {
    return {
      currentPipelineError: `Planner error: ${error.message}`,
      plan: [],
      llmUsages,
    };
  }
};

const executorNode = async (state) => {
  const {
    plan,
    currentStepIndex,
    llmServiceInstance,
    toolsMap,
    executorLlmConfig,
    intermediateStepResults,
    originalQuery,
    llmUsages,
    verbose,
  } = state;
  if (currentStepIndex >= plan.length)
    return { currentPipelineError: 'Execution attempted beyond plan length.' };
  const stepToExecute = { ...plan[currentStepIndex], status: 'in_progress' };

  let stepOutput,
    stepError = null;
  try {
    if (stepToExecute.toolToUse && toolsMap[stepToExecute.toolToUse]) {
      stepOutput = await toolsMap[stepToExecute.toolToUse].call(
        stepToExecute.toolInput
      );
    } else if (stepToExecute.toolToUse) {
      stepError = `Tool "${stepToExecute.toolToUse}" not found.`;
    } else {
      const prevResultsText = intermediateStepResults
        .map(
          (res) =>
            `Result from Step ${res.step}: ${String(res.result).substring(
              0,
              150
            )}...`
        )
        .join('\n');
      const { response, usage } = await llmServiceInstance.generate({
        prompt: {
          user: `Original Query: "${originalQuery}"\nCurrent Task: "${
            stepToExecute.task
          }"\nPrevious results:\n${
            prevResultsText || 'None'
          }\n\nProvide the result for THIS STEP ONLY.`,
        },
        config: {
          response: { format: 'text' },
          llm: {
            target: executorLlmConfig?.target || 'FAST_TASKER',
            temperature: executorLlmConfig?.temperature ?? 0.3,
          },
          verbose,
        },
      });
      stepOutput = response;
      if (usage)
        llmUsages.push({
          step: `executor_llm_step_${stepToExecute.step}`,
          ...usage,
        });
    }
    stepToExecute.result = stepOutput ?? stepError;
    stepToExecute.status = stepError ? 'failed' : 'completed';
  } catch (error) {
    stepError = `Error during step ${stepToExecute.step}: ${error.message}`;
    stepToExecute.result = stepError;
    stepToExecute.status = 'failed';
  }
  const updatedPlan = [...plan];
  updatedPlan[currentStepIndex] = stepToExecute;
  return {
    plan: updatedPlan,
    intermediateStepResults: [
      ...intermediateStepResults,
      {
        step: stepToExecute.step,
        task: stepToExecute.task,
        result: stepToExecute.result,
        error: stepError,
      },
    ],
    currentStepIndex: currentStepIndex + 1,
    currentPipelineError: stepError,
    llmUsages,
  };
};

const synthesizerNode = async (state) => {
  const {
    originalQuery,
    plan,
    llmServiceInstance,
    synthesizerLlmConfig,
    llmUsages,
    verbose,
  } = state;
  const planSummary = plan
    .map(
      (s) =>
        `Step ${s.step} (${s.status}): ${s.task}\n  Output: ${String(
          s.result
        ).substring(0, 200)}...${s.error ? `\n  Error: ${s.error}` : ''}`
    )
    .join('\n---\n');

  try {
    const { response: finalAnswer, usage } = await llmServiceInstance.generate({
      prompt: {
        system: {
          persona:
            'You are an expert AI assistant tasked with synthesizing a final answer from a series of planned steps.',
        },
        user: `Based ONLY on the information from the executed steps below, provide a comprehensive answer to the original query: "${originalQuery}".\n\n--- PLAN EXECUTION SUMMARY ---\n${planSummary}\n--- END SUMMARY ---\n\nFinal Answer:`,
      },
      config: {
        response: { format: 'text' },
        llm: {
          target: synthesizerLlmConfig?.target || 'MASTER_COMMUNICATOR',
          temperature: synthesizerLlmConfig?.temperature ?? 0.1,
        },
        verbose,
      },
    });
    if (usage) llmUsages.push({ step: 'synthesizer', ...usage });
    return { finalAnswer: String(finalAnswer), llmUsages };
  } catch (error) {
    return {
      finalAnswer: `Error synthesizing answer: ${error.message}`,
      currentPipelineError: `Synthesizer error: ${error.message}`,
      llmUsages,
    };
  }
};

const routeAfterPlannerLogic = (state) =>
  state.currentPipelineError || !state.plan || state.plan.length === 0
    ? 'error_handler'
    : 'executor';
const routeAfterStepExecutionLogic = (state) =>
  state.currentPipelineError
    ? 'error_handler'
    : state.currentStepIndex < state.plan.length
    ? 'executor'
    : 'synthesizer';

export const createPlanAndExecuteAgentGraph = async (
  llmServiceInstance,
  tools,
  checkpointerConfig
) => {
  if (!(llmServiceInstance instanceof LLMService))
    throw new DaitanConfigurationError(
      'An instance of LLMService is required.'
    );

  const workflow = new DaitanLangGraph(planAndExecuteAgentStateSchema, {
    loggerInstance: planAndExecuteLogger,
  });
  workflow.addNode({ name: 'planner', action: plannerNode });
  workflow.addNode({ name: 'executor', action: executorNode });
  workflow.addNode({ name: 'synthesizer', action: synthesizerNode });
  workflow.addNode({
    name: 'error_handler',
    action: async (state) => ({
      finalAnswer: `Execution failed: ${
        state.currentPipelineError || 'Unknown error.'
      }`,
    }),
  });

  workflow.setEntryPoint('planner');
  workflow.addConditionalEdge({
    sourceNode: 'planner',
    condition: routeAfterPlannerLogic,
    pathMap: { executor: 'executor', error_handler: 'error_handler' },
  });
  workflow.addConditionalEdge({
    sourceNode: 'executor',
    condition: routeAfterStepExecutionLogic,
    pathMap: {
      executor: 'executor',
      synthesizer: 'synthesizer',
      error_handler: 'error_handler',
    },
  });
  workflow.addEdge({ sourceNode: 'synthesizer', targetNode: END });
  workflow.addEdge({ sourceNode: 'error_handler', targetNode: END });

  if (checkpointerConfig) await workflow.withPersistence(checkpointerConfig);
  return workflow.compile();
};
