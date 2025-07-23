// intelligence/src/intelligence/agents/chat/index.js
/**
 * @file Main entry point for chat-specific AI agents in @daitanjs/intelligence.
 * @module @daitanjs/intelligence/agents/chat
 *
 * @description
 * This module aggregates and exports various specialized AI agents designed for
 * participating in or managing simulated chat conversations. These agents typically
 * extend the `BaseAgent` class and leverage the `LLMService` for their operations.
 *
 * Exported Chat Agents:
 * - **`ChoreographerAgent`**: Responsible for setting up the initial scene of a
 *   multi-participant conversation, including topic, setting, and participant profiles.
 *   (from `./choreographerAgent.js`)
 * - **`CoachAgent`**: Analyzes ongoing conversation dynamics and provides
 *   Robert Greene-inspired coaching hints or psychological insights to participants.
 *   (from `./coachAgent.js`)
 * - **`OpeningPhraseAgent`**: Generates engaging opening lines or conversation starters
 *   for a designated participant based on the scene context.
 *   (from `./openingPhraseAgent.js`)
 * - **`ParticipantAgent`**: A simpler, non-iterative agent that represents a single
 *   participant in a conversation, generating one turn of speech, thoughts, and actions.
 *   This is distinct from the more complex graph-based participant workflows.
 *   (from `./participantAgent.js`)
 *
 * These agents can be orchestrated together, for example, by using the `ChoreographerAgent`
 * to define a scene, then using `ParticipantAgent` instances (potentially guided by a `CoachAgent`)
 * to simulate the conversation turn by turn.
 *
 * For more complex, stateful, and iterative agent behaviors, consider using the
 * LangGraph-based workflows available in `@daitanjs/intelligence/workflows`, which
 * might internally use or adapt the logic from these chat agents as nodes in a graph.
 */
import { getLogger } from '@daitanjs/development';

const chatAgentIndexLogger = getLogger('daitan-chat-agents-index');

chatAgentIndexLogger.debug('Exporting DaitanJS Chat Agents...');

// --- Specialized Chat Agent Classes ---
// JSDoc for each class is in its respective source file.

export { ChoreographerAgent } from './choreographerAgent.js';
export { CoachAgent } from './coachAgent.js';
export { OpeningPhraseAgent } from './openingPhraseAgent.js';
export { ParticipantAgent } from './participantAgent.js'; // Simple, single-turn participant

// Note: More complex, graph-based participant agents (like `createParticipantAgentGraph`)
// are typically exported from the `intelligence/workflows/index.js` module, as they
// represent entire workflow structures rather than standalone agent classes.

chatAgentIndexLogger.info('DaitanJS Chat Agents module exports ready.');
