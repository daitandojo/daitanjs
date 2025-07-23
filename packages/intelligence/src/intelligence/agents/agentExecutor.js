// packages/intelligence/src/intelligence/agents/agentExecutor.js (version 1.0.1)
/**
 * @file Provides a wrapper for running LangChain's AgentExecutor.
 * @module @daitanjs/intelligence/agents/agentExecutor
 */
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { BaseTool } from '../tools/baseTool.js';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { OPENAI_TOOLS_AGENT_SYSTEM_MESSAGE } from './prompts/index.js';
import { InMemoryChatMessageHistoryStore } from '../../memory/inMemoryChatHistoryStore.js';
import {
  DaitanConfigurationError,
  DaitanOperationError,
} from '@daitanjs/error';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import chalk from 'chalk';
// --- DEFINITIVE FIX: Import LLM classes directly ---
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGroq } from '@langchain/groq';
import { getExpertModelDefinition } from '../core/expertModels.js';

const agentExecutorLogger = getLogger('daitan-agent-executor');

class ConciseAgentLogHandler extends BaseCallbackHandler {
  name = 'ConciseAgentLogHandler';

  handleToolStart(tool, input) {
    const toolInput = typeof input === 'string' ? input : JSON.stringify(input);
    console.log(
      chalk.gray(
        `  ➡️  Agent decided to use Tool: ${chalk.bold(
          tool.name
        )} with input "${toolInput}"`
      )
    );
  }

  handleToolEnd(output) {
    const preview =
      output.length > 250 ? `${output.substring(0, 250)}...` : output;
    console.log(chalk.gray(`  ⬅️  Tool returned: "${preview}"`));
  }
}

// A default, singleton in-memory store for convenience if no store is provided.
const defaultHistoryStore = new InMemoryChatMessageHistoryStore();

export const runToolCallingAgent = async ({
  input,
  tools,
  agentSystemMessage = OPENAI_TOOLS_AGENT_SYSTEM_MESSAGE,
  llmProviderOrExpert,
  sessionId,
  historyStore = defaultHistoryStore, // Use the singleton default
  verbose: callSpecificVerbose,
  customHandlers,
  trace: callSpecificTrace,
  maxIterations: callSpecificMaxIterations,
  returnIntermediateSteps: callSpecificReturnIntermediateSteps,
  llmConfig = {},
  requestTimeout,
}) => {
  const configManager = getConfigManager();
  const effectiveSessionId = sessionId || `daitan-agent-session-${Date.now()}`;
  const effectiveVerbose =
    callSpecificVerbose ?? configManager.get('DEBUG_AGENT', false);
  const effectiveMaxIterations =
    callSpecificMaxIterations ?? configManager.get('AGENT_MAX_ITERATIONS', 15);
  const effectiveReturnIntermediateSteps =
    callSpecificReturnIntermediateSteps ?? effectiveVerbose;

  if (
    !historyStore ||
    typeof historyStore.getHistory !== 'function' ||
    typeof historyStore.clear !== 'function'
  ) {
    throw new DaitanConfigurationError(
      'The provided `historyStore` does not adhere to the IChatMessageHistoryStore interface (missing getHistory or clear methods).'
    );
  }

  // --- DEFINITIVE FIX: Replace resolveProviderConfig with direct instantiation ---
  let llm;
  try {
    const target =
      llmProviderOrExpert ||
      configManager.get('LLM_PROVIDER_AGENT') ||
      'FAST_TASKER';
    const expertDef = getExpertModelDefinition(target);

    let provider, model, temperature;

    if (expertDef) {
      provider = expertDef.provider;
      model = expertDef.model;
      temperature = expertDef.temperature;
    } else {
      const [p, m] = target.split('|');
      provider = p;
      model = m;
    }
    
    provider = provider?.toLowerCase();

    const commonConfig = {
        modelName: model,
        temperature: temperature ?? llmConfig.temperature ?? 0.7,
        maxRetries: 2,
        timeout: requestTimeout,
    };

    switch(provider) {
        case 'openai':
            const openAIApiKey = configManager.get('OPENAI_API_KEY');
            if (!openAIApiKey) throw new DaitanConfigurationError('OPENAI_API_KEY is required for openai agent.');
            llm = new ChatOpenAI({ ...commonConfig, apiKey: openAIApiKey });
            break;
        case 'anthropic':
            const anthropicApiKey = configManager.get('ANTHROPIC_API_KEY');
            if (!anthropicApiKey) throw new DaitanConfigurationError('ANTHROPIC_API_KEY is required for anthropic agent.');
            llm = new ChatAnthropic({ ...commonConfig, apiKey: anthropicApiKey });
            break;
        case 'groq':
             const groqApiKey = configManager.get('GROQ_API_KEY');
            if (!groqApiKey) throw new DaitanConfigurationError('GROQ_API_KEY is required for groq agent.');
            llm = new ChatGroq({ ...commonConfig, apiKey: groqApiKey });
            break;
        default:
             throw new DaitanConfigurationError(
                `runToolCallingAgent currently only supports 'openai', 'anthropic', and 'groq' providers.`
              );
    }
  } catch (e) {
    throw new DaitanConfigurationError(
      `Failed to configure LLM for agent: ${e.message}`,
      {},
      e
    );
  }
  // --- End of new logic ---

  const llmWithTools = llm.bindTools(tools);

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', agentSystemMessage],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  const agent = await createOpenAIToolsAgent({
    llm: llmWithTools,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    verbose: false,
    returnIntermediateSteps: effectiveReturnIntermediateSteps,
    maxIterations: effectiveMaxIterations,
  });

  const agentWithHistory = new RunnableWithMessageHistory({
    runnable: agentExecutor,
    getMessageHistory: (sessionId) => historyStore.getHistory(sessionId),
    inputMessagesKey: 'input',
    historyMessagesKey: 'chat_history',
  });

  try {
    agentExecutorLogger.info(
      `Starting agent run for session ${effectiveSessionId}`
    );

    const handlers = customHandlers ? [customHandlers] : [];
    if (effectiveVerbose) {
      handlers.push(new ConciseAgentLogHandler());
    }

    const result = await agentWithHistory.invoke(
      { input: input },
      {
        configurable: { sessionId: effectiveSessionId },
        callbacks: handlers.length > 0 ? handlers : undefined,
      }
    );

    agentExecutorLogger.info(
      `Agent run SUCCEEDED for session ${effectiveSessionId}.`
    );
    return result;
  } catch (error) {
    agentExecutorLogger.error(
      `Agent run FAILED for session ${effectiveSessionId}: ${error.message}`,
      { error: error.stack }
    );
    throw new DaitanOperationError(
      `Agent execution failed: ${error.message}`,
      { sessionId: effectiveSessionId },
      error
    );
  }
};