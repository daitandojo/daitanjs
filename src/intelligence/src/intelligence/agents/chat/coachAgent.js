// intelligence/src/intelligence/agents/chat/coachAgent.js
/**
 * @file Defines the CoachAgent for analyzing conversation dynamics and providing coaching hints.
 * @module @daitanjs/intelligence/agents/chat/coachAgent
 */
import { BaseAgent } from '../baseAgent.js';
import {
  DaitanConfigurationError,
  DaitanOperationError,
  DaitanError,
} from '@daitanjs/error';

/**
 * @typedef {import('../baseAgent.js').AgentContext} AgentContext
 * @typedef {import('../baseAgent.js').AgentResponse} AgentResponse
 * @typedef {import('../../../services/llmService.js').LLMUsageInfo} LLMUsageInfo
 */

/**
 * @typedef {Object} CoachAgentConversationContext
 * @property {Object} currentSpeaker
 * @property {Array<Object>} participants
 * @property {string} language
 * @property {string} setting
 * @property {string} topic
 * @property {string} observedAs
 * @property {string} mood
 * @property {string[]} conversationHistory
 * @property {number} [temperature]
 * @property {import('../../../services/llmService.js').LLMServiceConfig} [llmConfig]
 */

/** @typedef {Object} CoachAgentContextPayload @property {CoachAgentConversationContext} conversation */
/** @typedef {AgentContext & { payload: CoachAgentContextPayload }} CoachAgentContext */
/** @typedef {Object} SupervisionResult @property {number} staleness @property {string} analysis @property {string} hintForCurrentSpeaker @property {string} whichRobertGreenLaws */

/**
 * CoachAgent analyzes conversation dynamics and provides Robert Greene-inspired coaching hints.
 */
export class CoachAgent extends BaseAgent {
  /**
   * @param {import('../../../services/llmService.js').LLMService} llmServiceInstance
   */
  constructor(llmServiceInstance) {
    super(
      'CoachAgent',
      'Analyzes conversation dynamics and provides Robert Greene-inspired coaching hints.',
      llmServiceInstance
    );
  }

  /** @private */
  _createPrompts(con) {
    if (
      !con.currentSpeaker ||
      !con.participants ||
      !con.language ||
      !con.topic
    ) {
      throw new DaitanConfigurationError(
        'Missing critical fields in conversationContext for CoachAgent instruction generation.'
      );
    }

    const systemPrompt = {
      persona:
        'You are a psychologist coach, deeply versed in all works of Robert Greene. Your goal is to analyze a conversation and provide actionable advice.',
      task: `Analyze the conversation and provide guidance for ${con.currentSpeaker.name}. The conversation involves ${con.participants.length} participants and is in ${con.language}.`,
      outputFormat: `Respond in ${con.language} strictly in the following JSON format: { "staleness": number, "analysis": "string", "hintForCurrentSpeaker": "string", "whichRobertGreenLaws": "string" }`,
      guidelines: [
        'Staleness Score: Determine if the conversation is stale (0=fresh, 100=stale).',
        "Psychologist's Analysis: Provide your analysis of the current situation.",
        `Robert Greene Inspired Hint: Give a bold, explicit, and daring hint to ${con.currentSpeaker.name} to help them achieve their objective. Instruct on non-verbal actions as well as verbal ones.`,
        "Reference Robert Greene: State which law(s) or chapter(s) from Greene's books inspired your hint and briefly explain the connection.",
      ],
    };

    const userPrompt = `
Context:
- Setting: "${con.setting || 'Not specified'}"
- Topic: "${con.topic}"
- Observed As: "${con.observedAs || 'Not specified'}"
- Mood: "${con.mood || 'Neutral'}"

Current Speaker for Guidance: ${con.currentSpeaker.name}
- Personality: ${con.currentSpeaker.personality || 'Not specified'}
- Objective: "${con.currentSpeaker.objective || 'Not specified'}"

Recent Conversation History (last 8 messages):
---
${(con.conversationHistory || []).slice(-8).join('\n') || 'No recent history.'}
---
Provide your analysis and hint now.
    `.trim();

    return { system: systemPrompt, user: userPrompt };
  }

  /**
   * @param {CoachAgentContext} context
   * @returns {Promise<AgentResponse & { output: SupervisionResult | null }>}
   */
  async run(context) {
    const callId = context.callId || `coach-${Date.now()}`;
    this.logger.info(`CoachAgent run triggered.`, { callId });

    if (!context.payload || !context.payload.conversation) {
      return this.createErrorResponse(
        'Conversation context is missing or invalid.',
        'CoachAgent configuration error.'
      );
    }

    const conversationContext = context.payload.conversation;
    let prompts;
    try {
      prompts = this._createPrompts(conversationContext);
    } catch (instrError) {
      return this.createErrorResponse(
        `Prompt generation failed: ${instrError.message}`,
        'CoachAgent setup error.'
      );
    }

    const agentLlmConfig = conversationContext.llmConfig || {};

    try {
      const { response: supervisionResultJson, usage: llmUsage } =
        await this.llmService.generate({
          prompt: prompts,
          config: {
            response: { format: 'json' },
            llm: {
              target: agentLlmConfig.target,
              temperature:
                agentLlmConfig.temperature ??
                conversationContext.temperature ??
                0.4,
              maxTokens: agentLlmConfig.maxTokens ?? 800,
            },
            verbose: agentLlmConfig.verbose,
            trackUsage: agentLlmConfig.trackUsage,
          },
          metadata: {
            summary: `CoachAgent: Supervision for ${conversationContext.currentSpeaker?.name}`,
          },
        });

      if (
        !supervisionResultJson ||
        typeof supervisionResultJson.staleness !== 'number' ||
        typeof supervisionResultJson.analysis !== 'string' ||
        typeof supervisionResultJson.hintForCurrentSpeaker !== 'string' ||
        typeof supervisionResultJson.whichRobertGreenLaws !== 'string'
      ) {
        throw new DaitanOperationError(
          'LLM response for supervision was malformed or missed fields.'
        );
      }

      this.logger.info('Successfully generated coaching supervision.', {
        callId,
        staleness: supervisionResultJson.staleness,
      });
      return this.createSuccessResponse(
        supervisionResultJson,
        `CoachAgent provided supervision for ${conversationContext.currentSpeaker?.name}.`,
        llmUsage
      );
    } catch (error) {
      this.logger.error(
        `Error generating coaching supervision: ${error.message}`,
        { callId, errorName: error.name }
      );
      const errorOutput = {
        errorOccurred: true,
        errorMessage: error.message,
        staleness: 50,
        analysis: 'Failed to generate supervision due to an operational error.',
        hintForCurrentSpeaker:
          'An error occurred; unable to provide a hint at this time.',
        whichRobertGreenLaws: 'N/A due to error.',
      };
      const daitanError =
        error instanceof DaitanError
          ? error
          : new DaitanOperationError(
              `Failed to generate supervision: ${error.message}`,
              { agentName: this.name },
              error
            );
      return this.createErrorResponse(
        daitanError.message,
        'CoachAgent encountered an error.',
        errorOutput
      );
    }
  }
}
