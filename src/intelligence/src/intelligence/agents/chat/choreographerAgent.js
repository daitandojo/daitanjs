// intelligence/src/intelligence/agents/chat/choreographerAgent.js
/**
 * @file Defines the ChoreographerAgent for setting up multi-participant conversation scenes.
 * @module @daitanjs/intelligence/agents/chat/choreographerAgent
 */
import { BaseAgent } from '../baseAgent.js';
import {
  DaitanConfigurationError,
  DaitanOperationError,
  DaitanInvalidInputError,
  DaitanError,
} from '@daitanjs/error';
import { getConfigManager } from '@daitanjs/config';

/**
 * @typedef {import('../baseAgent.js').AgentContext} AgentContext
 * @typedef {import('../baseAgent.js').AgentResponse} AgentResponse
 * @typedef {import('../../../services/llmService.js').LLMUsageInfo} LLMUsageInfo
 * @typedef {import('../../../services/llmService.js').LLMServiceConfig} LLMServiceConfig
 */

/**
 * @typedef {Object} ChoreographerAgentPayload
 * @property {string} theme
 * @property {number} [numParticipants=3]
 * @property {string} [language="en"]
 * @property {string[]} [potentialPersonalities]
 * @property {string[]} [potentialObjectives]
 * @property {string[]} [potentialSettings]
 * @property {LLMServiceConfig} [llmConfig]
 * @property {LLMServiceConfig} [llmConfigForParticipants]
 */

/** @typedef {AgentContext & { payload: ChoreographerAgentPayload }} ChoreographerAgentContext */

/**
 * @typedef {Object} ChoreographedParticipant
 * @property {string} name
 * @property {string} role
 * @property {string} personality
 * @property {string} objective
 * @property {string} speakingStyle
 * @property {number} temperature
 * @property {string[]} innerWorld
 * @property {string | null} hintFromOutside
 */

/**
 * @typedef {Object} ChoreographyResult
 * @property {string} topic
 * @property {string} setting
 * @property {string} language
 * @property {string} mood
 * @property {string} observedAs
 * @property {ChoreographedParticipant[]} participants
 * @property {string[]} [stageProps]
 * @property {string | null} [firstSpeakerName]
 * @property {LLMServiceConfig} [llmConfig]
 * @property {string[]} conversationHistory
 * @property {string[]} nonVerbalActionsHistory
 */

/** @typedef {AgentResponse & { output: ChoreographyResult | null }} ChoreographerAgentResponse */

/**
 * ChoreographerAgent sets the stage for a multi-participant conversation.
 */
export class ChoreographerAgent extends BaseAgent {
  /**
   * @param {import('../../../services/llmService.js').LLMService} llmServiceInstance
   */
  constructor(llmServiceInstance) {
    super(
      'ChoreographerAgent',
      'Sets up a multi-participant conversation scene including topic, setting, participant profiles, and initial dynamics.',
      llmServiceInstance
    );
  }

  /** @private */
  _createSceneSetupPrompts(payload) {
    const {
      theme,
      numParticipants = 3,
      language = 'en',
      potentialPersonalities,
      potentialObjectives,
      potentialSettings,
    } = payload;

    const personalityGuidance =
      Array.isArray(potentialPersonalities) && potentialPersonalities.length > 0
        ? `personalities, potentially drawing inspiration from (but not strictly limited to): ${potentialPersonalities.join(
            ', '
          )}. Ensure they are distinct.`
        : 'diverse and engaging personalities that fit the theme.';
    const objectiveGuidance =
      Array.isArray(potentialObjectives) && potentialObjectives.length > 0
        ? `objectives, possibly inspired by these examples: ${potentialObjectives.join(
            ', '
          )}. Ensure each participant's objective is specific to THIS conversation scene.`
        : 'distinct and clear objectives that will drive the conversation.';
    const settingGuidance =
      Array.isArray(potentialSettings) && potentialSettings.length > 0
        ? `a setting, perhaps similar to one of these examples: ${potentialSettings.join(
            ', '
          )}, or create a new one appropriate for the theme.`
        : 'a compelling and contextually relevant setting for the conversation.';

    const systemPrompt = {
      persona:
        'You are an expert scene choreographer and creative storyteller for simulations.',
      task: 'Your task is to design a complete and detailed setup for a conversation scene.',
      outputFormat:
        'You MUST respond ONLY with a single, valid JSON object with keys: "topic", "setting", "language", "mood", "observedAs", "participants", and optionally "stageProps" and "firstSpeakerName".',
      guidelines: [
        `"topic": A specific, engaging conversation topic derived from the theme.`,
        `"setting": A vivid description of the environment. ${settingGuidance}`,
        `"language": Confirm the language by providing its ISO 639-1 code.`,
        `"mood": The initial overall mood or atmosphere of the scene.`,
        `"observedAs": A brief description of how an impartial observer might describe the scene.`,
        `"participants": An array of exactly ${numParticipants} participant objects. Each must include: "name", "role", "personality", "objective", "speakingStyle", "temperature". Participant personalities should be ${personalityGuidance}. Participant objectives should be ${objectiveGuidance}.`,
        `"stageProps": Optional array of 0-3 strings describing key physical objects.`,
        `"firstSpeakerName": Optional string with the name of the participant who should speak first.`,
      ],
    };

    const userPrompt = `
Your task is to act as an expert scene choreographer and design a detailed setup for a conversation scene.

Theme: "${theme}"
Number of Participants: ${numParticipants}
Language: ${language}

Your response must be a single, valid JSON object with the specific keys and structure detailed in the system prompt.
`.trim();

    return { system: systemPrompt, user: userPrompt };
  }

  /**
   * @public
   * @async
   * @param {ChoreographerAgentContext} context
   * @returns {Promise<ChoreographerAgentResponse>}
   */
  async run(context) {
    const configManager = getConfigManager(); // Lazy-load
    const callId =
      context.callId || `choreo-${this.name}-${Date.now().toString(36)}`;
    this.logger.info(`[${callId}] ChoreographerAgent run triggered.`, {
      theme: context.payload?.theme,
    });

    if (
      !context.payload ||
      typeof context.payload.theme !== 'string' ||
      !context.payload.theme.trim()
    ) {
      throw new DaitanInvalidInputError(
        'A non-empty `theme` is required in the payload for the ChoreographerAgent.'
      );
    }
    const numParticipants = context.payload.numParticipants || 3;
    if (
      !Number.isInteger(numParticipants) ||
      numParticipants < 1 ||
      numParticipants > 10
    ) {
      throw new DaitanInvalidInputError(
        '`numParticipants` must be an integer between 1 and 10.'
      );
    }

    const { llmConfig = {}, llmConfigForParticipants = {} } = context.payload;
    const prompts = this._createSceneSetupPrompts(context.payload);

    try {
      const { response: sceneSetupJson, usage: llmUsageInfo } =
        await this.llmService.generate({
          prompt: prompts,
          config: {
            response: { format: 'json' },
            llm: {
              target:
                llmConfig.target ||
                configManager.get('CHOREOGRAPHER_EXPERT_PROFILE') ||
                'MASTER_COMMUNICATOR',
              temperature: llmConfig.temperature ?? 0.65,
              maxTokens: llmConfig.maxTokens ?? 2000,
            },
            verbose: llmConfig.verbose ?? this.logger.isLevelEnabled('debug'),
            trackUsage:
              llmConfig.trackUsage ??
              configManager.get('LLM_TRACK_USAGE', true),
          },
          metadata: {
            summary: `ChoreographerAgent: Setup scene for theme "${context.payload.theme.substring(
              0,
              30
            )}..."`,
          },
        });

      if (
        !sceneSetupJson ||
        typeof sceneSetupJson !== 'object' ||
        !Array.isArray(sceneSetupJson.participants)
      ) {
        throw new DaitanOperationError(
          'LLM response for scene setup was not a valid object or participants array is missing.'
        );
      }

      sceneSetupJson.participants.forEach((p, idx) => {
        if (
          !p ||
          typeof p.name !== 'string' ||
          typeof p.role !== 'string' ||
          typeof p.personality !== 'string' ||
          typeof p.objective !== 'string' ||
          typeof p.speakingStyle !== 'string' ||
          typeof p.temperature !== 'number'
        ) {
          throw new DaitanOperationError(
            `Participant object at index ${idx} in LLM response is malformed.`
          );
        }
        p.innerWorld = [];
        p.hintFromOutside = null;
      });

      const choreographyResult = {
        ...sceneSetupJson,
        conversationHistory: [],
        nonVerbalActionsHistory: [],
        llmConfig: llmConfigForParticipants || llmConfig,
      };

      this.logger.info(
        `[${callId}] Successfully choreographed conversation scene. Topic: "${choreographyResult.topic}"`
      );
      // --- DEFINITIVE FIX ---
      // The call to createSuccessResponse now correctly matches the method's
      // signature: createSuccessResponse(output, summary, ...).
      // The primary data payload `choreographyResult` is the first argument.
      return this.createSuccessResponse(
        choreographyResult,
        `Scene setup complete.`,
        llmUsageInfo,
        sceneSetupJson
      );
    } catch (error) {
      this.logger.error(
        `[${callId}] Error during scene choreography: ${error.message}`
      );
      const daitanError =
        error instanceof DaitanError
          ? error
          : new DaitanOperationError(
              `Scene choreography by LLM failed: ${error.message}`,
              { agentName: this.name },
              error
            );
      return this.createErrorResponse(
        daitanError.message,
        `ChoreographerAgent failed to set up scene.`
      );
    }
  }
}
