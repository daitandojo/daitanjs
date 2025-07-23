// intelligence/src/intelligence/agents/chat/participantAgent.js
/**
 * @file Defines the ParticipantAgent for simulating a single turn in a conversation.
 * @module @daitanjs/intelligence/agents/chat/participantAgent
 */
import { BaseAgent } from '../baseAgent.js';
import { DaitanOperationError, DaitanError } from '@daitanjs/error';
import { getConfigManager } from '@daitanjs/config';

/**
 * @typedef {import('../baseAgent.js').AgentContext} AgentContext
 * @typedef {import('../baseAgent.js').AgentResponse} AgentResponse
 */

/**
 * @typedef {Object} ParticipantDetails @property {string} name @property {string} role @property {string} personality @property {string} objective @property {string} speakingStyle @property {number} temperature @property {string[]} [innerWorld] @property {string | null} [hintFromOutside]
 * @typedef {Object} FullConversationContextForParticipant @property {ParticipantDetails} currentSpeaker @property {Array<ParticipantDetails>} participants @property {string} language @property {string} setting @property {string} topic @property {string} [observedAs] @property {string} [mood] @property {string[]} conversationHistory @property {string[]} [nonVerbalActionsHistory] @property {string[]} [stageProps] @property {import('../../../services/llmService.js').LLMServiceConfig} [llmConfig]
 * @typedef {Object} ParticipantAgentContextPayload @property {FullConversationContextForParticipant} conversation @property {ParticipantDetails} [actingAsParticipant]
 * @typedef {AgentContext & { payload: ParticipantAgentContextPayload }} ParticipantAgentContext
 * @typedef {Object} ParticipantResponsePayload @property {number} objectives_achieved @property {string} answer @property {string} thoughts @property {string} actions
 */

/**
 * ParticipantAgent represents an actor in a conversation, generating a single turn's response.
 */
export class ParticipantAgent extends BaseAgent {
  /**
   * @param {import('../../../services/llmService.js').LLMService} llmServiceInstance
   */
  constructor(llmServiceInstance) {
    super(
      'ParticipantRolePlayer',
      'Simulates a participant in a conversation, generating a single turn including speech, thoughts, and actions.',
      llmServiceInstance
    );
  }

  /** @private */
  _createPrompts(con, speaker) {
    const otherParticipants = (con.participants || [])
      .filter((p) => p?.name !== speaker.name)
      .map(
        (p) =>
          `${p.name} (Role: ${p.role || 'N/A'}, Objective: "${
            p.objective || 'N/A'
          }")`
      )
      .join(', ');

    const system = {
      persona: `You are ${speaker.name}, a ${
        speaker.role?.toLowerCase() || 'participant'
      } with a ${
        speaker.personality?.toLowerCase() || 'neutral'
      } personality. You are in a conversation with: ${
        otherParticipants || 'others'
      }. The conversation is in ${con.language || 'English'}.`,
      task: `Your task is to provide your next verbal "answer", your internal "thoughts", and your non-verbal "actions". Your response should balance natural conversation flow with your specific objective: "${speaker.objective}".`,
      outputFormat:
        'Respond ONLY with a single, valid JSON object in the format: {"objectives_achieved": number, "answer": "string", "thoughts": "string", "actions": "string"}',
      guidelines: [
        `"answer" is for your exact verbal utterance only.`,
        `"thoughts" are your internal monologue.`,
        `"actions" describe your non-verbal movements.`,
        `"objectives_achieved" is a score from 0-100 on how much this response helps you achieve your objective.`,
        `Be consistent with your persona: (Role: ${
          speaker.role
        }, Personality: ${speaker.personality}, Style: ${
          speaker.speakingStyle || 'Natural'
        }).`,
        `Supervisor's hint: "${
          speaker.hintFromOutside || 'No specific hint provided.'
        }"`,
      ],
    };

    const user = `
Context:
- Topic: "${con.topic}"
- Setting: "${con.setting || 'Not specified'}"
- Mood: "${con.mood || 'Neutral'}"
- Props: ${con.stageProps?.join(', ') || 'none'}

Recent Conversation History (last 6 turns):
${
  (con.conversationHistory || []).slice(-6).join('\n') ||
  'No prior conversation.'
}

Your Recent Inner Thoughts (last 3 turns):
[${
      (speaker.innerWorld || []).slice(-3).join('\n') ||
      'No recent personal thoughts.'
    }]

Recent Non-Verbal Actions in Scene:
[${
      (con.nonVerbalActionsHistory || []).slice(-3).join('\n') ||
      'No recent non-verbal actions.'
    }]

---
Based on the above, generate your response now.
`.trim();

    return { system, user };
  }

  /**
   * @param {ParticipantAgentContext} context
   * @returns {Promise<AgentResponse & { output: ParticipantResponsePayload | null }>}
   */
  async run(context) {
    const configManager = getConfigManager(); // Lazy-load
    const callId = context.callId || `participant-${Date.now()}`;
    const actingParticipant = context.payload?.conversation?.currentSpeaker;

    if (!actingParticipant?.name) {
      return this.createErrorResponse(
        'Participant persona not defined.',
        'Agent configuration error.'
      );
    }

    // Dynamically set logger name for better tracing
    this.logger = this.llmService.logger.child({
      service: `daitan-agent-${actingParticipant.name}`,
    });
    this.logger.info(
      `ParticipantAgent (${actingParticipant.name}) run triggered.`,
      { callId }
    );

    const prompts = this._createPrompts(
      context.payload.conversation,
      actingParticipant
    );
    const participantLlmConfig = context.payload.conversation.llmConfig || {};

    try {
      const { response: participantResponseJson, usage: llmUsage } =
        await this.llmService.generate({
          prompt: prompts,
          config: {
            response: { format: 'json' },
            llm: {
              target:
                participantLlmConfig.target ||
                configManager.get('PARTICIPANT_EXPERT_PROFILE') ||
                'FAST_TASKER',
              temperature:
                participantLlmConfig.temperature ??
                actingParticipant.temperature ??
                0.7,
              maxTokens: participantLlmConfig.maxTokens ?? 500,
            },
            verbose: participantLlmConfig.verbose,
            trackUsage: participantLlmConfig.trackUsage,
          },
          metadata: {
            summary: `ParticipantAgent: ${actingParticipant.name}'s turn`,
          },
        });

      if (
        !participantResponseJson ||
        typeof participantResponseJson.objectives_achieved !== 'number' ||
        typeof participantResponseJson.answer !== 'string' ||
        typeof participantResponseJson.thoughts !== 'string' ||
        typeof participantResponseJson.actions !== 'string'
      ) {
        throw new DaitanOperationError(
          'LLM response for participant turn was malformed.'
        );
      }

      this.logger.info(
        `Participant ${actingParticipant.name} generated response successfully.`
      );
      return this.createSuccessResponse(
        participantResponseJson,
        `${actingParticipant.name} completed their turn.`,
        llmUsage
      );
    } catch (error) {
      this.logger.error(
        `Error during ${actingParticipant.name}'s turn generation: ${error.message}`
      );
      const daitanError =
        error instanceof DaitanError
          ? error
          : new DaitanOperationError(
              `LLM call failed for ${actingParticipant.name}: ${error.message}`
            );
      const errorOutput = {
        objectives_achieved: 0,
        answer: `(Error: Could not generate answer - ${daitanError.message.substring(
          0,
          50
        )}...)`,
        thoughts: 'Error prevented thought generation.',
        actions: 'No action taken due to error.',
      };
      return this.createErrorResponse(
        daitanError.message,
        `Participant ${actingParticipant.name} failed to generate turn.`,
        errorOutput
      );
    }
  }
}
