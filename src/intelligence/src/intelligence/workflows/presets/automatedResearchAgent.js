// intelligence/src/intelligence/workflows/presets/automatedResearchAgent.js
/**
 * @file A pre-defined workflow for automated research on a topic.
 * @module @daitanjs/intelligence/workflows/presets/automatedResearchAgent
 *
 * @description
 * This module provides the `runAutomatedResearchWorkflow` function, which executes a
 * multi-step agentic workflow using LangGraph. The agent performs the following sequence:
 *
 * 1. **Deconstruct**: Breaks the main topic into a set of specific sub-queries.
 * 2. **Search**: Uses the underlying web search service to find relevant online articles for each sub-query.
 * 3. **Scrape & Summarize**: For each unique URL found, scrapes the content and generates a concise summary.
 * 4. **Synthesize**: Uses an LLM to create a final, comprehensive report based on the collected summaries, citing its sources.
 * 5. **Save**: Writes the final report to a local Markdown file.
 *
 * This serves as a powerful example of orchestrating multiple tools and LLM calls
 * to accomplish a complex research task, with hooks for detailed observability.
 */
import { DaitanLangGraph } from '../langGraphManager.js';
import { createGraphRunner } from '../graphRunner.js';
import { LLMService } from '../../../services/llmService.js';
import { googleSearch } from '@daitanjs/web'; // Use the direct service for structured output
import { downloadAndExtract } from '@daitanjs/web';
import { autoTagDocument } from '../../metadata/index.js';
import { writeFile } from '@daitanjs/utilities';
import { getLogger } from '@daitanjs/development';
import { DaitanOperationError, DaitanInvalidInputError } from '@daitanjs/error';
import path from 'path';

const researchLogger = getLogger('daitan-research-workflow');

/**
 * @typedef {Object} ResearchState
 * @property {string} topic
 * @property {string[]} subQueries
 * @property {Array<{query: string, url: string, title: string}>} searchResults
 * @property {Array<{url: string, title: string, summary: string}>} summaries
 * @property {string | null} finalReport
 * @property {string | null} reportPath
 * @property {string | null} error
 * @property {LLMService} llmService
 */
const researchAgentStateSchema = {
  topic: { value: (x, y) => y ?? x },
  subQueries: { value: (x, y) => y ?? x, default: () => [] },
  searchResults: {
    value: (x, y) => (x || []).concat(y || []),
    default: () => [],
  },
  summaries: { value: (x, y) => (x || []).concat(y || []), default: () => [] },
  finalReport: { value: (x, y) => y ?? x, default: () => null },
  reportPath: { value: (x, y) => y ?? x, default: () => null },
  error: { value: (x, y) => y ?? x, default: () => null },
  llmService: { value: (x, y) => y ?? x },
};

const deconstructQueryNode = async (state) => {
  researchLogger.info(`(1) Deconstructing topic: "${state.topic}"`);
  try {
    const { response } = await state.llmService.generate({
      prompt: {
        system: {
          persona: 'You are an expert research planner.',
          task: 'Deconstruct the given topic into 3-5 specific, answerable sub-queries that cover the key aspects of the topic. The queries should be suitable for a web search engine.',
          outputFormat:
            'Respond with a single JSON object with a single key "queries" which is an array of strings.',
        },
        user: state.topic,
      },
      config: { llm: { target: 'FAST_TASKER', temperature: 0.1 } },
    });
    if (!response?.queries || response.queries.length === 0) {
      return { error: 'Failed to deconstruct topic into sub-queries.' };
    }
    return { subQueries: response.queries };
  } catch (error) {
    return { error: `Query deconstruction failed: ${error.message}` };
  }
};

const searchNode = async (state) => {
  if (state.error) return;
  researchLogger.info(
    `(2) Searching for: ${state.subQueries.length} sub-queries.`
  );
  const allResults = [];
  for (const query of state.subQueries) {
    try {
      // Use the direct service to get structured data, not the string-returning tool
      const searchItems = await googleSearch({ query: query, num: 3 });
      for (const item of searchItems) {
        if (item.link) {
          allResults.push({ query, url: item.link, title: item.title });
        }
      }
    } catch (error) {
      researchLogger.warn(
        `Web search for sub-query "${query}" failed: ${error.message}`
      );
    }
  }
  if (allResults.length === 0) {
    return { error: 'Web search returned no usable links.' };
  }
  return { searchResults: allResults };
};

const scrapeAndSummarizeNode = async (state) => {
  if (state.error) return;
  const uniqueUrls = [
    ...new Map(state.searchResults.map((item) => [item.url, item])).values(),
  ];
  researchLogger.info(
    `(3) Scraping and summarizing ${uniqueUrls.length} unique URLs.`
  );

  const summaryPromises = uniqueUrls.map(async ({ url, title }) => {
    try {
      const extracted = await downloadAndExtract(url, {
        parserType: 'cheerio',
        mainContentSelectors: ['main', 'article', 'body'],
      });
      const fullText = (extracted || [])
        .map((item) => item.text)
        .join('\n\n')
        .substring(0, 15000);

      if (fullText.trim().length < 100) return null;

      const { metadata } = await autoTagDocument(fullText, {
        config: { llm: { target: 'FAST_TASKER', temperature: 0.0 } },
      });
      return { url, title, summary: metadata.summary };
    } catch (error) {
      researchLogger.warn(`Failed to process ${url}: ${error.message}`);
      return null;
    }
  });

  const summaries = (await Promise.all(summaryPromises)).filter(Boolean);
  if (summaries.length === 0) {
    return {
      error:
        'Could not successfully scrape and summarize any of the search results.',
    };
  }
  return { summaries };
};

const synthesizeReportNode = async (state) => {
  if (state.error || state.summaries.length === 0) {
    return {
      finalReport:
        state.error || 'Could not generate report due to lack of information.',
    };
  }
  researchLogger.info('(4) Synthesizing final report.');
  const synthesisPrompt = `You are an expert research analyst. Synthesize a comprehensive, well-structured report in Markdown on the topic: "${
    state.topic
  }". Use ONLY the following source summaries. For each piece of information you include, you MUST cite the source URL in parentheses, like this: (Source: https://example.com/article).

--- SOURCE SUMMARIES ---
${state.summaries
  .map((s) => `URL: ${s.url}\nTitle: ${s.title}\nSummary: ${s.summary}`)
  .join('\n\n')}`;

  try {
    const { response: finalReport } = await state.llmService.generate({
      prompt: { user: synthesisPrompt },
      config: {
        response: { format: 'text' },
        llm: { target: 'MASTER_COMMUNICATOR', maxTokens: 4000 },
      },
    });
    return { finalReport };
  } catch (error) {
    return { error: `Report synthesis failed: ${error.message}` };
  }
};

const saveReportNode = async (state) => {
  if (state.error || !state.finalReport) return;
  researchLogger.info('(5) Saving final report to file.');
  const fileName = `${state.topic
    .replace(/[\s/\\?%*:|"<>]/g, '_')
    .toLowerCase()}_report.md`;
  const outputPath = path.resolve(process.cwd(), fileName);
  try {
    await writeFile(outputPath, state.finalReport);
    return { reportPath: outputPath };
  } catch (error) {
    return { error: `Failed to save report: ${error.message}` };
  }
};

/**
 * Creates and runs the automated research workflow.
 * @param {string} topic - The research topic.
 * @param {import('../graphRunner.js').CreateGraphRunnerOptions} [options] - Options for the graph runner, including callbacks.
 * @returns {Promise<ResearchState>} The final state of the graph.
 */
export const runAutomatedResearchWorkflow = async (topic, options = {}) => {
  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    throw new DaitanInvalidInputError(
      'A valid topic is required to run the research workflow.'
    );
  }

  const researchGraph = new DaitanLangGraph(researchAgentStateSchema);
  researchGraph.addNode({
    name: 'Deconstruct Query',
    action: deconstructQueryNode,
  });
  researchGraph.addNode({ name: 'Search Web', action: searchNode });
  researchGraph.addNode({
    name: 'Scrape & Summarize',
    action: scrapeAndSummarizeNode,
  });
  researchGraph.addNode({
    name: 'Synthesize Report',
    action: synthesizeReportNode,
  });
  researchGraph.addNode({ name: 'Save Report', action: saveReportNode });

  researchGraph.setEntryPoint('Deconstruct Query');
  researchGraph.addEdge({
    sourceNode: 'Deconstruct Query',
    targetNode: 'Search Web',
  });
  researchGraph.addEdge({
    sourceNode: 'Search Web',
    targetNode: 'Scrape & Summarize',
  });
  researchGraph.addEdge({
    sourceNode: 'Scrape & Summarize',
    targetNode: 'Synthesize Report',
  });
  researchGraph.addEdge({
    sourceNode: 'Synthesize Report',
    targetNode: 'Save Report',
  });
  researchGraph.setFinishPoint('Save Report');

  const compiledGraph = researchGraph.compile();
  const graphRunner = createGraphRunner(compiledGraph, {
    verbose: true,
    ...options,
  });

  researchLogger.info(
    `--- Starting Automated Research Workflow for: "${topic}" ---`
  );
  const finalState = await graphRunner({ topic, llmService: new LLMService() });
  researchLogger.info(
    `--- Automated Research Workflow for: "${topic}" Finished ---`
  );

  if (finalState.error) {
    researchLogger.error('Workflow finished with an error:', finalState.error);
  }
  return finalState;
};
