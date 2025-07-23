// intelligence/src/intelligence/synthesis/sourceManager.js
/**
 * @file Manages the processing of raw search results: deduplication, ranking, and summarization.
 * @module @daitanjs/intelligence/synthesis/sourceManager
 */
import { getLogger } from '@daitanjs/development';
import { generateIntelligence } from '../../intelligence/core/llmOrchestrator.js';
import { DaitanOperationError } from '@daitanjs/error';

const logger = getLogger('daitan-source-manager');

/**
 * @typedef {import('../search/specializedSearch.js').SourcedContent} SourcedContent
 */

/**
 * @typedef {Object} ProcessedSource
 * @property {string} url - The source URL.
 * @property {string} title - The title of the source.
 * @property {string} summary - An LLM-generated summary of the relevant content.
 * @property {number} relevanceScore - A score from 0-100 indicating relevance to the query.
 * @property {number} credibilityScore - A heuristic score for the source's credibility.
 * @property {string} [publishedDate] - The publication date, if found.
 */

const CREDIBILITY_SCORES = {
  'wikipedia.org': 85,
  'reuters.com': 95,
  'apnews.com': 95,
  'bbc.com': 90,
  'nytimes.com': 90,
  'wsj.com': 90,
  'theguardian.com': 88,
  'forbes.com': 85,
  'businessinsider.com': 80,
  'techcrunch.com': 85,
  '.gov': 98,
  '.edu': 92,
  'arxiv.org': 95,
};

function getCredibilityScore(url) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const tld = `.${domain.split('.').pop()}`;
    if (CREDIBILITY_SCORES[domain]) return CREDIBILITY_SCORES[domain];
    if (CREDIBILITY_SCORES[tld]) return CREDIBILITY_SCORES[tld];
    for (const [key, score] of Object.entries(CREDIBILITY_SCORES)) {
      if (domain.includes(key)) return score;
    }
    return 60;
  } catch (e) {
    return 50;
  }
}

/**
 * Processes a list of raw sourced content into a final, high-quality context for synthesis.
 */
export async function processAndRankSources(query, allSources, options = {}) {
  const callId = `source-proc-${Date.now().toString(36)}`;
  logger.info(
    `[${callId}] Starting source processing for ${allSources.length} raw sources.`
  );

  if (!allSources || allSources.length === 0) return [];

  const uniqueSources = Array.from(
    new Map(allSources.map((s) => [s.url, s])).values()
  );
  logger.info(
    `[${callId}] Deduplicated sources from ${allSources.length} to ${uniqueSources.length}.`
  );

  const summarizationPromises = uniqueSources.map(async (source) => {
    try {
      const summaryPrompt = `Based on the following content, extract the key facts and a concise summary that are DIRECTLY RELEVANT to the query: "${query}". If the content is not relevant, respond with an empty summary.\n\nContent:\n"""\n${source.content.substring(
        0,
        8000
      )}\n"""`;
      const { response } = await generateIntelligence({
        prompt: {
          system: {
            persona: 'You are an expert information extractor.',
            task: 'Extract a relevant summary and provide a relevance score.',
            outputFormat:
              'Respond with a JSON object: {"summary": "string", "relevance_score": number_between_0_and_100}',
          },
          user: summaryPrompt,
        },
        config: {
          response: { format: 'json' },
          llm: { target: 'openai|gpt-4o-mini', temperature: 0.0 },
        },
      });
      if (!response.summary || response.relevance_score < 40) return null;
      return {
        ...source,
        summary: response.summary,
        relevanceScore: response.relevance_score,
        credibilityScore: getCredibilityScore(source.url),
      };
    } catch (error) {
      logger.warn(
        `[${callId}] Failed to summarize or score source ${source.url}: ${error.message}`
      );
      return null;
    }
  });

  const processedSources = (await Promise.all(summarizationPromises)).filter(
    Boolean
  );
  processedSources.forEach((source) => {
    source.finalScore =
      source.relevanceScore * 0.7 + source.credibilityScore * 0.3;
  });

  const rankedSources = processedSources.sort(
    (a, b) => b.finalScore - a.finalScore
  );
  const finalSources = rankedSources.slice(0, options.maxFinalSources || 5);
  logger.info(
    `[${callId}] Source processing complete. Selected ${finalSources.length} high-quality sources for synthesis.`
  );
  return finalSources;
}
