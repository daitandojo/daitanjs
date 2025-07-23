// intelligence/src/intelligence/agents/chat/openingPhraseAgent.js
/**
 * @file Defines the OpeningPhraseAgent for generating compelling conversation starters.
 * @module @daitanjs/intelligence/agents/chat/openingPhraseAgent
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
 * @typedef {Object} OpeningPhraseAgentConversationContext
 * @property {Object} currentSpeaker
 * @property {Array<Object>} participants
 * @property {string} language
 * @property {string} topic
 * @property {string} [goal]
 * @property {string} [mood]
 * @property {string} [setting]
 * @property {string[]} [stageProps]
 * @property {number} [temperature]
 * @property {import('../../../services/llmService.js').LLMServiceConfig} [llmConfig]
 */

/** @typedef {Object} OpeningPhraseAgentContextPayload @property {OpeningPhraseAgentConversationContext} conversation */
/** @typedef {AgentContext & { payload: OpeningPhraseAgentContextPayload }} OpeningPhraseAgentContext */
/** @typedef {Object} OpeningPhraseResult @property {string} openingPhrase */

/**
 * OpeningPhraseAgent generates engaging opening phrases for conversations.
 */
export class OpeningPhraseAgent extends BaseAgent {
  /**
   * @param {import('../../../services/llmService.js').LLMService} llmServiceInstance
   */
  constructor(llmServiceInstance) {
    super(
      'OpeningPhraseAgent',
      'Generates engaging opening phrases for conversations based on context and participant objectives.',
      llmServiceInstance
    );
  }

  /** @private */
  _createPrompts(con) {
    const speaker = con.currentSpeaker;
    if (!speaker || !con.participants || !con.language || !con.topic) {
      throw new DaitanConfigurationError(
        'Missing critical fields in conversationContext for OpeningPhraseAgent.'
      );
    }
    const otherParticipantsDesc =
      (con.participants || [])
        .filter((p) => p?.name !== speaker.name)
        .map(
          (p) =>
            `- ${p.name} (Personality: ${p.personality || 'N/A'}, Intention: "${
              p.objective || 'N/A'
            }")`
        )
        .join('\n    ') || 'None';

    const systemPrompt = {
      persona:
        'You are a creative AI assistant specializing in crafting compelling conversation starters.',
      task: `Generate an engaging opening phrase for ${speaker.name}. The phrase must be natural, contextually appropriate, and aligned with the speaker's personality, style, and objective. It must be in ${con.language}.`,
      outputFormat:
        'Respond STRICTLY in the following JSON format: { "openingPhrase": "string" }',
    };

    const userPrompt = `
Conversation Context:
- Topic: "${con.topic}"
- Desired Goal of Conversation: "${con.goal || 'achieve a positive outcome'}"
- General Mood: "${con.mood || 'Neutral'}"
- Setting: "${con.setting || 'Not specified'}"
- Available Props: ${con.stageProps?.join(', ') || 'none'}

Initial Speaker Details (${speaker.name}):
- Role: ${speaker.role || 'Participant'}
- Personality: ${speaker.personality || 'Neutral'}
- Specific Intention: "${speaker.objective || 'Not specified'}"
- Typical Speaking Style: ${speaker.speakingStyle || 'Natural'}

Other Participants:
${otherParticipantsDesc}

Please generate the opening phrase for ${speaker.name}.
`.trim();

    return { system: systemPrompt, user: userPrompt };
  }

  /**
   * @param {OpeningPhraseAgentContext} context
   * @returns {Promise<AgentResponse & { output: OpeningPhraseResult | null }>}
   */
  async run(context) {
    const callId = context.callId || `openphrase-${Date.now()}`;
    this.logger.info(`OpeningPhraseAgent run triggered.`, { callId });

    if (!context.payload?.conversation) {
      return this.createErrorResponse(
        'Conversation context is missing or invalid.',
        'OpeningPhraseAgent configuration error.'
      );
    }

    const conversationContext = context.payload.conversation;
    let prompts;
    try {
      prompts = this._createPrompts(conversationContext);
    } catch (instrError) {
      return this.createErrorResponse(
        `Prompt generation failed: ${instrError.message}`,
        'OpeningPhraseAgent setup error.'
      );
    }

    const agentLlmConfig = conversationContext.llmConfig || {};

    try {
      const { response: openingPhraseResultJson, usage: llmUsage } =
        await this.llmService.generate({
          prompt: prompts,
          config: {
            response: { format: 'json' },
            llm: {
              target: agentLlmConfig.target,
              temperature:
                agentLlmConfig.temperature ??
                conversationContext.temperature ??
                0.85,
              maxTokens: agentLlmConfig.maxTokens ?? 200,
            },
            verbose: agentLlmConfig.verbose,
            trackUsage: agentLlmConfig.trackUsage,
          },
          metadata: {
            summary: `OpeningPhraseAgent: Generate for ${conversationContext.currentSpeaker?.name}`,
          },
        });

      if (
        !openingPhraseResultJson?.openingPhrase ||
        typeof openingPhraseResultJson.openingPhrase !== 'string'
      ) {
        throw new DaitanOperationError(
          'LLM response for opening phrase was malformed.'
        );
      }

      this.logger.info('Successfully generated opening phrase.', { callId });
      return this.createSuccessResponse(
        openingPhraseResultJson,
        `Opening phrase generated.`,
        llmUsage
      );
    } catch (error) {
      this.logger.error(`Error generating opening phrase: ${error.message}`, {
        callId,
        errorName: error.name,
      });
      const errorOutput = {
        openingPhrase: `Error: Could not generate an opening phrase.`,
        errorOccurred: true,
        errorMessage: error.message,
      };
      const daitanError =
        error instanceof DaitanError
          ? error
          : new DaitanOperationError(
              `Failed to generate opening phrase: ${error.message}`,
              { agentName: this.name },
              error
            );
      return this.createErrorResponse(
        daitanError.message,
        'OpeningPhraseAgent encountered an error.',
        errorOutput
      );
    }
  }
}
