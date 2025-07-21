// intelligence/src/intelligence/agents/specialized/queryAnalyzerAgent.js
/**
 * @file Defines the QueryAnalyzerAgent, responsible for deconstructing a user query into a strategic research plan.
 * @module @daitanjs/intelligence/agents/specialized/queryAnalyzerAgent
 */
import { getLogger } from '@daitanjs/development';
import { generateIntelligence } from '../../../intelligence/core/llmOrchestrator.js';
import { DaitanOperationError, DaitanInvalidInputError } from '@daitanjs/error';
import { z } from 'zod';

const logger = getLogger('daitan-query-analyzer-agent');

const ResearchStrategySchema = z.object({
  query_type: z
    .enum([
      'simple_fact_check',
      'comparative_analysis',
      'historical_context',
      'current_events',
      'complex_multi_faceted',
      'other',
    ])
    .describe("The classification of the user's query."),
  deconstructed_sub_queries: z
    .array(z.string())
    .min(1, 'At least one sub-query is required.')
    .describe('A list of 2-5 simple, sequential search queries to execute.'),
  required_sources: z
    .array(z.enum(['general_web', 'academic', 'news']))
    .min(1, 'At least one source type is required.')
    .describe(
      'The types of sources required to answer the query comprehensively.'
    ),
  synthesis_instructions: z
    .string()
    .describe(
      "Specific instructions for the final synthesizer, e.g., 'Provide a bulleted list of pros and cons.' or 'Write a detailed narrative.'"
    ),
});

/**
 * @typedef {z.infer<typeof ResearchStrategySchema>} ResearchStrategy
 */

/**
 * @typedef {Object} QueryAnalyzerResult
 * @property {ResearchStrategy} strategy - The structured research plan.
 * @property {import('../../../core/llmOrchestrator.js').LLMUsageInfo | null} usage - LLM usage for the analysis.
 */

/**
 * Creates a default fallback research strategy when the LLM fails to generate a valid one.
 * @private
 */
const createDefaultStrategy = (query) => ({
  query_type: 'complex_multi_faceted',
  deconstructed_sub_queries: [query],
  required_sources: ['general_web'],
  synthesis_instructions:
    "Provide a direct and comprehensive answer to the user's query.",
});

/**
 * Analyzes a user's query and generates a structured, multi-step research strategy.
 *
 * @param {string} query - The user's research query.
 * @param {object} [options={}]
 * @param {boolean} [options.verbose=false] - Enable detailed logging for this call.
 * @returns {Promise<QueryAnalyzerResult>} The generated research strategy.
 */
export async function analyzeQueryAndCreateStrategy(query, options = {}) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new DaitanInvalidInputError(
      'A valid query is required for analysis.'
    );
  }

  const callId = `query-analysis-${Date.now().toString(36)}`;
  logger.info(`[${callId}] Analyzing query to create research strategy...`, {
    query,
  });

  const systemPrompt = {
    persona: 'You are a master research strategist and query analyst.',
    task: "Your sole purpose is to analyze a user's query and break it down into a structured, actionable research plan. You must classify the query, determine the necessary source types, and deconstruct it into a series of simple, logical sub-queries.",
    outputFormat: `You MUST respond with a single, valid JSON object that conforms to this Zod schema: ${JSON.stringify(
      ResearchStrategySchema.shape
    )}`,
  };

  const userPrompt = `Analyze the following user query and generate the research strategy JSON object.\n\nUser Query: "${query}"`;

  try {
    const { response, usage } = await generateIntelligence({
      prompt: { system: systemPrompt, user: userPrompt },
      config: {
        response: {
          schema: ResearchStrategySchema,
          validator: (res) => {
            const validation = ResearchStrategySchema.safeParse(res);
            return validation.success;
          },
        },
        llm: { target: 'openai|gpt-4o', temperature: 0.0 },
        retry: { maxAttempts: 3 },
        verbose: options.verbose,
      },
      metadata: { summary: 'Query Analysis and Strategy Generation' },
    });

    logger.info(
      `[${callId}] Successfully generated research strategy for query.`,
      { query_type: response.query_type }
    );
    return { strategy: response, usage };
  } catch (error) {
    logger.error(
      `[${callId}] Failed to generate a valid research strategy after retries: ${error.message}. Falling back to a default strategy.`
    );

    const fallbackStrategy = createDefaultStrategy(query);

    return {
      strategy: fallbackStrategy,
      usage: null,
    };
  }
}
