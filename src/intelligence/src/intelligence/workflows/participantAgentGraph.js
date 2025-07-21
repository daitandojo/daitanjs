// intelligence/src/intelligence/workflows/participantAgentGraph.js
import { END } from '@langchain/langgraph';
import { generateIntelligence } from '../core/llmOrchestrator.js';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { DaitanLangGraph } from './langGraphManager.js';
import { DaitanOperationError } from '@daitanjs/error';

const participantAgentGraphLogger = getLogger('daitan-participant-agent-graph');

const DEFAULT_MAX_IMPROVEMENT_ITERATIONS = 2;

/**
 * @typedef {import('../core/llmOrchestrator.js').LLMUsageInfo} LLMUsageInfo
 * @typedef {Object} ConversationContextForGraph @property {any} currentSpeaker @property {any[]} participants @property {string} language @property {string} setting @property {string} topic @property {string} observedAs @property {string} mood @property {string[]} conversationHistory @property {string[]} nonVerbalActionsHistory @property {string[]} stageProps @property {string} [llmProvider] @property {string} [model] @property {function} getParticipantsDescription
 * @typedef {Object} ParticipantGraphState @property {ConversationContextForGraph} conversationContext @property {string} baseInstruction @property {string} dynamicContextPrompt @property {Object | null} currentResponsePayload @property {number} iterationCount @property {string | null} errorMessage @property {Object} llmConfig @property {number} maxIterations @property {LLMUsageInfo[]} llmUsages
 */
export const participantAgentStateSchema = {
  conversationContext: { value: (x, y) => y ?? x, default: () => ({}) },
  baseInstruction: { value: (x, y) => y ?? x, default: () => '' },
  dynamicContextPrompt: { value: (x, y) => y ?? x, default: () => '' },
  currentResponsePayload: { value: (x, y) => y ?? x, default: () => null },
  iterationCount: { value: (x, y) => y ?? x, default: () => 0 },
  errorMessage: { value: (x, y) => y ?? x, default: () => null },
  llmConfig: { value: (x, y) => y ?? x, default: () => ({}) },
  maxIterations: {
    value: (x, y) => y ?? x,
    default: () => DEFAULT_MAX_IMPROVEMENT_ITERATIONS,
  },
  llmUsages: { value: (x, y) => (x || []).concat(y || []), default: () => [] },
};

const generateInstructionForGraphNode = (con) => {
  const speaker = con.currentSpeaker;
  const task = `Your task is to provide your next answer, your internal "thoughts", and your non-verbal "actions", balancing natural conversation with your objective: "${speaker.objective}".`;
  const guidelines = [
    `"answer" is for your exact verbal utterance only.`,
    `"thoughts" are your internal monologue.`,
    `"actions" describe your non-verbal movements.`,
    `"objectives_achieved" is a score from 0-100 on how much this response helps you achieve your objective.`,
    `Your supervisor's hint: "${
      speaker.hintFromOutside || 'No hint provided.'
    }"`,
  ];
  return {
    persona: `You are ${
      speaker.name
    }, a ${speaker.role?.toLowerCase()}. You are in a conversation in ${
      con.language
    }.`,
    task: task,
    outputFormat:
      'Respond ONLY with a single, valid JSON object: {"objectives_achieved": number, "answer": "string", "thoughts": "string", "actions": "string"}',
    guidelines: guidelines,
  };
};

const generateDynamicContextPromptForGraphNode = (con) => {
  const speaker = con.currentSpeaker;
  const history =
    (con.conversationHistory || []).slice(-6).join('\n') ||
    'No prior conversation.';
  const thoughts =
    (speaker.innerWorld || []).slice(-3).join('\n') || 'No recent thoughts.';
  return `Context:\n- Setting: "${con.setting}"\n- Mood: "${con.mood}"\n\nRecent Conversation:\n${history}\n\nYour Recent Inner Thoughts:\n[${thoughts}]\n\nBased on all the above, generate your response.`;
};

const preparePromptsNode = async (state) => {
  const configManager = getConfigManager(); // Lazy-load
  const { conversationContext, llmConfig } = state;
  if (!conversationContext?.currentSpeaker)
    return { errorMessage: 'Critical error: Conversation context is missing.' };
  const baseInstruction = generateInstructionForGraphNode(conversationContext);
  const dynamicContextPrompt =
    generateDynamicContextPromptForGraphNode(conversationContext);
  const finalLlmConfig = {
    target:
      llmConfig?.target ||
      configManager.get('PARTICIPANT_EXPERT_PROFILE') ||
      'FAST_TASKER',
    temperature:
      llmConfig?.temperature ||
      conversationContext.currentSpeaker?.temperature ||
      0.7,
    verbose:
      llmConfig?.verbose !== undefined
        ? llmConfig.verbose
        : configManager.get('DEBUG_LANGGRAPH', false),
    trackUsage:
      llmConfig?.trackUsage !== undefined
        ? llmConfig.trackUsage
        : configManager.get('LLM_TRACK_USAGE', true),
  };
  return {
    baseInstruction,
    dynamicContextPrompt,
    llmConfig: finalLlmConfig,
    errorMessage: null,
  };
};

const generateLLMResponseNode = async (state) => {
  const {
    conversationContext,
    baseInstruction,
    dynamicContextPrompt,
    currentResponsePayload,
    iterationCount,
    llmConfig,
    llmUsages = [],
  } = state;
  const speaker = conversationContext.currentSpeaker;
  let userPrompt, summary;

  if (iterationCount === 0) {
    userPrompt = `Current Conversation Context:\n${dynamicContextPrompt}`;
    summary = `ParticipantGraph: ${speaker.name} initial response`;
  } else {
    userPrompt = `Original Context:\n${dynamicContextPrompt}\n\nIMPROVEMENT TASK:\nYour previous response was: ${JSON.stringify(
      currentResponsePayload
    )}\nImprove it significantly. Make it more insightful, proactive, and aligned with your character. Re-evaluate your 'objectives_achieved' score critically.`;
    summary = `ParticipantGraph: ${speaker.name} - Iteration ${iterationCount}`;
  }

  try {
    const { response, usage } = await generateIntelligence({
      prompt: { system: baseInstruction, user: userPrompt },
      config: {
        response: { format: 'json' },
        llm: { ...llmConfig, maxTokens: 1000 },
      },
      metadata: { summary },
    });
    if (usage) llmUsages.push({ step: `llm_iter_${iterationCount}`, ...usage });
    if (
      typeof response?.objectives_achieved !== 'number' ||
      typeof response?.answer !== 'string'
    )
      throw new DaitanOperationError('LLM response payload is invalid.');
    return {
      currentResponsePayload: response,
      iterationCount: iterationCount + 1,
      llmUsages,
    };
  } catch (error) {
    return {
      errorMessage: `LLM call failed: ${error.message}`,
      iterationCount: iterationCount + 1,
      llmUsages,
    };
  }
};

const decideNextStepNode = (state) => {
  if (
    state.errorMessage &&
    (!state.currentResponsePayload || state.iterationCount <= 1)
  )
    return 'finalize_with_error';
  if (state.errorMessage) return 'finalize_response';
  if (state.iterationCount > state.maxIterations) return 'finalize_response';
  return 'improve_response';
};

export const createParticipantAgentGraph = async (checkpointerConfig) => {
  const workflow = new DaitanLangGraph(participantAgentStateSchema, {
    loggerInstance: participantAgentGraphLogger,
  });
  workflow.addNode({ name: 'prepare_prompts', action: preparePromptsNode });
  workflow.addNode({
    name: 'generate_llm_response',
    action: generateLLMResponseNode,
  });
  workflow.addNode({
    name: 'finalize_error_output',
    action: async (state) =>
      state.currentResponsePayload
        ? {}
        : {
            currentResponsePayload: {
              objectives_achieved: 0,
              answer: `Error: ${
                state.errorMessage || 'Could not generate response.'
              }`,
              thoughts: 'Error prevented thought.',
              actions: 'No action taken.',
            },
          },
  });
  workflow.setEntryPoint('prepare_prompts');
  workflow.addEdge({
    sourceNode: 'prepare_prompts',
    targetNode: 'generate_llm_response',
  });
  workflow.addConditionalEdge({
    sourceNode: 'generate_llm_response',
    condition: decideNextStepNode,
    pathMap: {
      improve_response: 'generate_llm_response',
      finalize_response: END,
      finalize_with_error: 'finalize_error_output',
    },
  });
  workflow.addEdge({ sourceNode: 'finalize_error_output', targetNode: END });
  if (checkpointerConfig) await workflow.withPersistence(checkpointerConfig);
  return workflow.compile();
};
