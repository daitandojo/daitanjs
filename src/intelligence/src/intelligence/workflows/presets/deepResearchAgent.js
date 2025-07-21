// intelligence/src/intelligence/workflows/presets/deepResearchAgent.js
/**
 * @file Implements an enhanced hierarchical Plan-and-Execute agent with robust citation handling.
 * @module @daitanjs/intelligence/workflows/presets/deepResearchAgent
 * @description This agent creates detailed, adaptive multi-step plans with proper source tracking,
 * citation handling, and intelligent error recovery. It prioritizes internal knowledge while
 * supplementing with external sources when needed.
 */
import { getLogger } from '@daitanjs/development';
// --- DEFINITIVE FIX: Change ../.. to ../../index.js ---
import {
  DaitanLangGraph,
  createGraphRunner,
  askWithRetrieval,
  searchAndUnderstand,
  searchNews,
} from '../../index.js';
import { DaitanInvalidInputError, DaitanOperationError } from '@daitanjs/error';
import { END } from '@langchain/langgraph';
import { generateIntelligence } from '../../core/llmOrchestrator.js';
import chalk from 'chalk';

const logger = getLogger('daitan-deep-research-agent');

// --- Enhanced State Schema ---
const agentStateSchema = {
  originalQuery: { value: (x, y) => y ?? x },
  collectionName: { value: (x, y) => y ?? x },
  plan: { value: (x, y) => y ?? x, default: () => [] },
  pastSteps: { value: (x, y) => x.concat(y), default: () => [] },
  finalAnswer: { value: (x, y) => y, default: () => null },
  sources: { value: (x, y) => [...new Set([...x, ...y])], default: () => [] },
  citationMap: { value: (x, y) => ({ ...x, ...y }), default: () => ({}) },
  onProgress: { value: (x, y) => y ?? x },
  retryCount: { value: (x, y) => y ?? x, default: () => 0 },
  maxRetries: { value: (x, y) => y ?? x, default: () => 3 },
};

// --- Enhanced Tools with Citation Tracking ---
const availableTools = (collectionName) => ({
  search_internal_knowledge: {
    description:
      'Primary tool for querying the internal knowledge base (RAG). Most trusted source. Use first for all queries related to documents, people, projects, or specific information that might be in the knowledge base.',
    trustLevel: 'highest',
    execute: async (query, citationMap = {}) => {
      try {
        const ragResult = await askWithRetrieval(query, {
          collectionName,
          useAnalysisPrompt: true,
        });

        if (
          ragResult.text &&
          !ragResult.text
            .toLowerCase()
            .includes("don't have enough information")
        ) {
          console.log(
            chalk.gray(
              `> Internal Knowledge found:\n--- RAG Start ---\n${ragResult.text}\n--- RAG End ---`
            )
          );

          // Track internal knowledge as a source
          const sourceId = `internal_kb_${Date.now()}`;
          citationMap[sourceId] = {
            type: 'internal_knowledge',
            query: query,
            timestamp: new Date().toISOString(),
            trustLevel: 'highest',
          };

          return {
            observation: `Internal Knowledge: ${ragResult.text}`,
            sources: [sourceId],
            citationMap: { [sourceId]: citationMap[sourceId] },
          };
        }

        console.log(
          chalk.gray(
            `> Internal Knowledge found no relevant information for: "${query}"`
          )
        );
        return {
          observation:
            'The internal knowledge base did not contain relevant information for this query.',
          sources: [],
          citationMap: {},
        };
      } catch (error) {
        console.log(
          chalk.red(`> Internal Knowledge search failed: ${error.message}`)
        );
        return {
          observation: `Internal knowledge search failed: ${error.message}`,
          sources: [],
          citationMap: {},
        };
      }
    },
  },

  search_web: {
    description:
      'Secondary tool for general web searches. Use to supplement internal knowledge or find recent information not available in the knowledge base. Less trusted than internal sources.',
    trustLevel: 'medium',
    execute: async (query, citationMap = {}) => {
      try {
        const result = await searchAndUnderstand(query, { numResults: 5 });
        console.log(chalk.gray(`> Web Search found: ${result.answer}`));

        // Extract and track web sources
        const webSources = [];
        const newCitationMap = {};

        // Extract URLs from the result
        const urlRegex = /https?:\/\/[^\s\]]+/g;
        const urls = result.answer.match(urlRegex) || [];

        urls.forEach((url, index) => {
          const sourceId = `web_${Date.now()}_${index}`;
          webSources.push(sourceId);
          newCitationMap[sourceId] = {
            type: 'web_search',
            url: url,
            query: query,
            timestamp: new Date().toISOString(),
            trustLevel: 'medium',
          };
        });

        return {
          observation: `Web Search: ${result.answer}`,
          sources: webSources,
          citationMap: newCitationMap,
        };
      } catch (error) {
        console.log(chalk.red(`> Web search failed: ${error.message}`));
        return {
          observation: `Web search failed: ${error.message}`,
          sources: [],
          citationMap: {},
        };
      }
    },
  },

  search_news: {
    description:
      'Specialized tool for recent news and current events. Use when the query involves recent developments, current status, or time-sensitive information.',
    trustLevel: 'medium',
    execute: async (query, citationMap = {}) => {
      try {
        const result = await searchNews(query, { numResults: 3 });
        console.log(chalk.gray(`> News Search found: ${result.answer}`));

        const newsSources = [];
        const newCitationMap = {};

        // Extract URLs and track news sources
        const urlRegex = /https?:\/\/[^\s\]]+/g;
        const urls = result.answer.match(urlRegex) || [];

        urls.forEach((url, index) => {
          const sourceId = `news_${Date.now()}_${index}`;
          newsSources.push(sourceId);
          newCitationMap[sourceId] = {
            type: 'news_search',
            url: url,
            query: query,
            timestamp: new Date().toISOString(),
            trustLevel: 'medium',
          };
        });

        return {
          observation: `News Search: ${result.answer}`,
          sources: newsSources,
          citationMap: newCitationMap,
        };
      } catch (error) {
        console.log(chalk.red(`> News search failed: ${error.message}`));
        return {
          observation: `News search failed: ${error.message}`,
          sources: [],
          citationMap: {},
        };
      }
    },
  },
});

// --- Enhanced Planning Node ---
const plannerNode = async (state) => {
  const { originalQuery, onProgress, collectionName, retryCount } = state;
  onProgress({
    stage: 'Planning',
    message:
      'Analyzing query and developing comprehensive research strategy...',
    status: 'running',
  });

  const toolDescriptions = Object.entries(availableTools(collectionName))
    .map(
      ([name, tool]) =>
        `- ${name} (${tool.trustLevel} trust): ${tool.description}`
    )
    .join('\n');

  const plannerPrompt = `You are an expert research strategist. Create a comprehensive, adaptive plan to thoroughly answer the user's query using the available tools in order of trust priority.

**TRUST HIERARCHY (USE IN THIS ORDER):**
1. search_internal_knowledge (HIGHEST) - Always use first and multiple times with different angles
2. search_web (MEDIUM) - Use to supplement missing information
3. search_news (MEDIUM) - Use for recent/current information

**User's Query:** "${originalQuery}"

**Available Tools:**
${toolDescriptions}

**Planning Guidelines:**
1. Start with broad internal knowledge searches, then narrow down to specifics
2. Use multiple search_internal_knowledge queries with different phrasings to extract all relevant information
3. Only use external tools (web/news) after exhausting internal knowledge
4. For complex queries, break into logical sub-questions
5. Always end with synthesis step (no tool required)
6. Each step should build upon previous findings

**Required JSON Format:**
{
  "plan": [
    {
      "task": "Clear description of what this step accomplishes",
      "tool": "tool_name",
      "tool_input": "specific search query",
      "rationale": "why this step is needed"
    },
    ...
    {
      "task": "Synthesize comprehensive final answer with proper citations",
      "rationale": "combine all findings into authoritative response"
    }
  ]
}

Create a thorough plan with 4-8 steps that will comprehensively address the query:`;

  try {
    const { response } = await generateIntelligence({
      prompt: { user: plannerPrompt },
      config: {
        response: { format: 'json' },
        llm: { target: 'openai|gpt-4o' },
        temperature: 0.3, // Lower temperature for more consistent planning
      },
    });

    console.log(chalk.cyan.bold('🎯 Research Strategy Created:'));
    response.plan.forEach((step, i) => {
      console.log(chalk.cyan(`   ${i + 1}. ${step.task}`));
      if (step.rationale) {
        console.log(chalk.gray(`      → ${step.rationale}`));
      }
    });

    onProgress({
      stage: 'Planning',
      message: `Created ${response.plan.length}-step research plan`,
      status: 'complete',
    });

    return { plan: response.plan };
  } catch (error) {
    logger.error('Planning failed:', error);
    onProgress({
      stage: 'Planning',
      message: 'Failed to create research plan',
      status: 'error',
    });
    return {
      finalAnswer: `Research planning failed: ${error.message}. Please try rephrasing your query.`,
      sources: [],
      citationMap: {},
    };
  }
};

// --- Enhanced Executor Node ---
const executorNode = async (state) => {
  const { plan, pastSteps, onProgress, collectionName, citationMap } = state;
  const currentStepIndex = pastSteps.length;
  const currentTask = plan[currentStepIndex];

  onProgress({
    stage: 'Research',
    message: `Step ${currentStepIndex + 1}/${plan.length}: ${currentTask.task}`,
    status: 'running',
  });

  // Dynamic context injection from previous steps
  let toolInput = currentTask.tool_input;
  if (typeof toolInput === 'string') {
    // Replace context placeholders with actual findings
    if (toolInput.includes('[previous_findings]') && pastSteps.length > 0) {
      const lastObservation = pastSteps[pastSteps.length - 1].observation;
      toolInput = toolInput.replace('[previous_findings]', lastObservation);
    }

    // Inject specific entities or names found in previous steps
    if (toolInput.includes('[entities]') && pastSteps.length > 0) {
      const entities = extractEntitiesFromPastSteps(pastSteps);
      toolInput = toolInput.replace('[entities]', entities.join(', '));
    }
  }

  const tools = availableTools(collectionName);
  const tool = tools[currentTask.tool];

  if (!tool) {
    const errorMsg = `Invalid tool "${
      currentTask.tool
    }" specified in plan step ${currentStepIndex + 1}`;
    console.log(chalk.red.bold('❌ Tool Error:'), chalk.red(errorMsg));
    return {
      pastSteps: [
        {
          task: currentTask.task,
          tool: currentTask.tool,
          observation: errorMsg,
          sources: [],
          success: false,
        },
      ],
    };
  }

  try {
    console.log(chalk.blue.bold(`\n🔍 Executing: ${currentTask.tool}`));
    console.log(chalk.blue(`   Query: "${toolInput}"`));

    const result = await tool.execute(toolInput, citationMap);

    console.log(
      chalk.green.bold('✅ Result:'),
      chalk.green(result.observation)
    );

    onProgress({
      stage: 'Research',
      message: `Step ${currentStepIndex + 1} completed successfully`,
      status: 'running',
    });

    return {
      pastSteps: [
        {
          task: currentTask.task,
          tool: currentTask.tool,
          toolInput: toolInput,
          observation: result.observation,
          sources: result.sources || [],
          success: true,
        },
      ],
      sources: result.sources || [],
      citationMap: result.citationMap || {},
    };
  } catch (error) {
    const errorMsg = `Tool execution failed: ${error.message}`;
    console.log(chalk.red.bold('❌ Execution Error:'), chalk.red(errorMsg));

    onProgress({
      stage: 'Research',
      message: `Step ${currentStepIndex + 1} encountered an error`,
      status: 'error',
    });

    return {
      pastSteps: [
        {
          task: currentTask.task,
          tool: currentTask.tool,
          observation: errorMsg,
          sources: [],
          success: false,
        },
      ],
    };
  }
};

// --- Enhanced Synthesis Node ---
const synthesizerNode = async (state) => {
  const { originalQuery, pastSteps, onProgress, sources, citationMap } = state;
  onProgress({
    stage: 'Synthesis',
    message: 'Analyzing all findings and crafting comprehensive answer...',
    status: 'running',
  });

  // Organize findings by trust level and success
  const successfulSteps = pastSteps.filter((step) => step.success);
  const failedSteps = pastSteps.filter((step) => !step.success);

  const internalFindings = successfulSteps.filter(
    (step) => step.tool === 'search_internal_knowledge'
  );
  const externalFindings = successfulSteps.filter(
    (step) => step.tool === 'search_web' || step.tool === 'search_news'
  );

  // Build detailed context for synthesis
  const researchLog = pastSteps
    .map((step, index) => {
      const status = step.success ? '✅' : '❌';
      return (
        `**Step ${index + 1}** ${status}\n` +
        `Task: ${step.task}\n` +
        `Tool: ${step.tool}\n` +
        `Result: ${step.observation}\n` +
        (step.sources?.length ? `Sources: ${step.sources.join(', ')}\n` : '') +
        '---'
      );
    })
    .join('\n\n');

  // Create citation reference guide
  const citationGuide = Object.entries(citationMap)
    .map(([id, info]) => {
      if (info.type === 'internal_knowledge') {
        return `[${id}]: Internal Knowledge Base (Query: "${info.query}")`;
      } else if (info.url) {
        return `[${id}]: ${info.url}`;
      }
      return `[${id}]: ${info.type}`;
    })
    .join('\n');

  const synthesisPrompt = `You are a master research analyst. Your task is to synthesize a comprehensive, authoritative answer to the user's query based on the research findings below.

**CRITICAL SYNTHESIS REQUIREMENTS:**
1. **Source Priority**: Prioritize internal knowledge findings over external sources
2. **Citations**: Use [source_id] format for ALL factual claims, quotes, and data points
3. **Quotes**: Include relevant direct quotes when available, properly attributed
4. **Completeness**: Address all aspects of the original query
5. **Transparency**: Acknowledge any limitations or gaps in the research
6. **Structure**: Organize the answer logically with clear sections if needed

**Original Query:** "${originalQuery}"

**Research Findings:**
${researchLog}

**Citation Reference Guide:**
${citationGuide}

**Quality Standards:**
- Every factual claim must be cited using [source_id]
- Include direct quotes where relevant: "quote text" [source_id]
- Distinguish between high-confidence (internal) vs medium-confidence (external) findings
- If information conflicts between sources, note this explicitly
- If research was incomplete, state what additional information would be helpful

**Format Requirements:**
- Use markdown formatting for structure and emphasis
- Include a "Sources" section at the end listing all cited sources
- If the query asked for a table/list format, provide that structure

Synthesize a comprehensive, well-cited answer now:`;

  try {
    const { response } = await generateIntelligence({
      prompt: { user: synthesisPrompt },
      config: {
        llm: { target: 'openai|gpt-4o' },
        temperature: 0.2, // Lower temperature for more consistent synthesis
      },
    });

    onProgress({
      stage: 'Complete',
      message: 'Research completed successfully',
      status: 'complete',
    });

    return { finalAnswer: response };
  } catch (error) {
    logger.error('Synthesis failed:', error);
    onProgress({
      stage: 'Synthesis',
      message: 'Failed to synthesize final answer',
      status: 'error',
    });

    // Fallback: provide raw findings if synthesis fails
    const fallbackAnswer = `Research completed but synthesis failed. Here are the key findings:\n\n${successfulSteps
      .map((step, i) => `${i + 1}. ${step.observation}`)
      .join('\n\n')}`;

    return { finalAnswer: fallbackAnswer };
  }
};

// --- Routing Logic ---
const shouldContinue = (state) => {
  if (state.finalAnswer) {
    return END;
  }

  const nextTaskIndex = state.pastSteps.length;
  const nextTask = state.plan[nextTaskIndex];

  if (!nextTask || !nextTask.tool) {
    return 'synthesizer';
  }

  return 'executor';
};

// --- Utility Functions ---
function extractEntitiesFromPastSteps(pastSteps) {
  const entities = new Set();
  const entityRegex = /\b[A-Z][a-z]+(?: [A-Z][a-z]+)+\b/g;

  pastSteps.forEach((step) => {
    if (step.success && step.observation) {
      const matches = step.observation.match(entityRegex) || [];
      matches.forEach((match) => entities.add(match));
    }
  });

  return Array.from(entities);
}

function buildSourcesMap(citationMap) {
  const sourcesMap = {};

  Object.entries(citationMap).forEach(([id, info]) => {
    if (info.type === 'internal_knowledge') {
      sourcesMap[id] = `Internal Knowledge Base (${info.timestamp})`;
    } else if (info.url) {
      sourcesMap[id] = info.url;
    } else {
      sourcesMap[id] = `${info.type} source`;
    }
  });

  return sourcesMap;
}

// --- Main Research Conductor ---
export async function runDeepResearchAgent(query, options = {}) {
  const {
    onProgress = () => {},
    collectionName,
    maxRetries = 3,
    timeout = 300000, // 5 minutes default timeout
  } = options;

  if (!query?.trim()) {
    throw new DaitanInvalidInputError('A valid, non-empty query is required.');
  }

  onProgress({
    stage: 'Initialization',
    message: 'Starting comprehensive research process...',
    status: 'running',
  });

  // Build the enhanced research graph
  const researchGraph = new DaitanLangGraph(agentStateSchema);

  researchGraph
    .addNode({ name: 'planner', action: plannerNode })
    .addNode({ name: 'executor', action: executorNode })
    .addNode({ name: 'synthesizer', action: synthesizerNode })
    .setEntryPoint('planner')
    .addConditionalEdge({
      sourceNode: 'planner',
      condition: shouldContinue,
      pathMap: {
        executor: 'executor',
        synthesizer: 'synthesizer',
      },
    })
    .addConditionalEdge({
      sourceNode: 'executor',
      condition: shouldContinue,
      pathMap: {
        executor: 'executor',
        synthesizer: 'synthesizer',
      },
    })
    .setFinishPoint('synthesizer');

  const compiledGraph = researchGraph.compile();
  const graphRunner = createGraphRunner(compiledGraph);

  try {
    const startTime = Date.now();

    const finalState = await Promise.race([
      graphRunner({
        originalQuery: query.trim(),
        onProgress,
        collectionName,
        maxRetries,
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Research timeout exceeded')),
          timeout
        )
      ),
    ]);

    const duration = Date.now() - startTime;
    console.log(chalk.green.bold(`\n🎉 Research completed in ${duration}ms`));

    // Build comprehensive response
    const sourcesMap = buildSourcesMap(finalState.citationMap || {});
    const uniqueSources = [...new Set(finalState.sources || [])];

    if (
      finalState.finalAnswer?.startsWith("I'm sorry") ||
      finalState.finalAnswer?.includes('failed')
    ) {
      throw new DaitanOperationError(finalState.finalAnswer);
    }

    return {
      finalAnswer:
        finalState.finalAnswer ||
        'Research completed but no final answer was generated.',
      sources: uniqueSources,
      sourcesMap: sourcesMap,
      plan: finalState.plan || [],
      executionSteps: finalState.pastSteps || [],
      citationMap: finalState.citationMap || {},
      metadata: {
        duration,
        totalSteps: finalState.pastSteps?.length || 0,
        successfulSteps:
          finalState.pastSteps?.filter((s) => s?.success)?.length || 0,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error('Research agent failed:', error);
    onProgress({
      stage: 'Error',
      message: `Research failed: ${error.message}`,
      status: 'error',
    });

    return {
      finalAnswer: `Research process failed: ${error.message}. Please try rephrasing your query or check if the knowledge base is accessible.`,
      sources: [],
      sourcesMap: {},
      plan: [],
      executionSteps: [],
      citationMap: {},
      metadata: {
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
