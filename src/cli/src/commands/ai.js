// cli/src/commands/ai.js
/**
 * @file Registers the 'ai' command and its subcommands for the DaitanJS CLI.
 * @module @daitanjs/cli/commands/ai
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getLogger } from '@daitanjs/development';
import {
  generateIntelligence,
  createPlanAndExecuteAgentGraph,
  createReActAgentGraph,
  createGraphRunner,
  getDefaultTools,
  LLMService,
} from '@daitanjs/intelligence';
import { HumanMessage } from '@langchain/core/messages';

const logger = getLogger('daitan-cli-ai');

/**
 * Registers the 'ai' command and its subcommands to the main program.
 * @param {Command} program - The main commander program instance.
 */
export function registerAiCommands(program) {
  const aiCommand = program
    .command('ai')
    .description(chalk.cyan('Interact with AI models, agents, and workflows.'));

  // --- AI Chat Subcommand ---
  aiCommand
    .command('chat')
    .description('Start an interactive chat session with an LLM.')
    .option(
      '-t, --target <target>',
      'Specify the LLM target as an expert profile (e.g., "FAST_TASKER") or "provider|model" string (e.g., "openai|gpt-4o-mini").'
    )
    .action(async (options) => {
      console.log(chalk.green.bold('Starting interactive AI chat session...'));
      console.log(chalk.dim('Type "exit", "quit", or "q" to end the session.'));
      console.log(
        chalk.dim(
          '----------------------------------------------------------------'
        )
      );

      const chatHistory = [];

      const chatLoop = async () => {
        const { userInput } = await inquirer.prompt([
          { type: 'input', name: 'userInput', message: chalk.yellow('You:') },
        ]);

        if (['exit', 'quit', 'q'].includes(userInput.toLowerCase())) {
          console.log(chalk.bold.magenta('Ending chat session. Goodbye!'));
          return;
        }

        const spinner = ora(chalk.blue('AI is thinking...')).start();
        try {
          chatHistory.push({ role: 'user', content: userInput });

          const { response: aiResponse } = await generateIntelligence({
            prompt: {
              shots: chatHistory, // Pass the entire history as few-shot examples
            },
            config: {
              response: { format: 'text' },
              llm: { target: options.target }, // Use the new target option
            },
            metadata: {
              summary: 'CLI Interactive Chat',
            },
          });

          chatHistory.push({ role: 'assistant', content: aiResponse });

          spinner.succeed(chalk.green('AI responded:'));
          console.log(chalk.cyan(aiResponse));
        } catch (error) {
          spinner.fail(chalk.red('An error occurred.'));
          logger.error('Error during AI chat session:', error);
          console.error(chalk.red.bold(error.message));
        }
        console.log(
          chalk.dim(
            '----------------------------------------------------------------'
          )
        );
        await chatLoop();
      };

      await chatLoop();
    });

  // --- AI Agent Subcommand ---
  aiCommand
    .command('agent <type> <query>')
    .description(
      'Run an AI agent with a specific workflow type (e.g., "plan", "react").'
    )
    .action(async (type, query) => {
      const verbose = program.opts().verbose;
      const spinner = ora(
        chalk.blue(`Initializing "${type}" agent...`)
      ).start();

      try {
        let graphRunner;
        let initialState;

        const llmService = new LLMService({ verbose });
        const tools = getDefaultTools();

        if (type.toLowerCase() === 'plan') {
          spinner.text = chalk.blue('Compiling Plan-and-Execute graph...');
          const planAndExecuteGraph = await createPlanAndExecuteAgentGraph(
            llmService,
            tools
          );
          graphRunner = createGraphRunner(planAndExecuteGraph, { verbose });
          initialState = {
            inputMessage: new HumanMessage(query),
            originalQuery: query,
            llmServiceInstance: llmService,
            toolsMap: tools.reduce((acc, tool) => {
              acc[tool.name] = tool;
              return acc;
            }, {}),
            verbose,
          };
          spinner.text = chalk.blue(
            `Running Plan-and-Execute agent on: "${query.substring(0, 50)}..."`
          );
        } else if (type.toLowerCase() === 'react') {
          spinner.text = chalk.blue('Compiling ReAct with Reflection graph...');
          const reActGraph = await createReActAgentGraph(llmService, tools);
          graphRunner = createGraphRunner(reActGraph, { verbose });
          initialState = {
            inputMessage: new HumanMessage(query),
            llmServiceInstance: llmService,
            toolsMap: tools.reduce((acc, tool) => {
              acc[tool.name] = tool;
              return acc;
            }, {}),
            verbose,
          };
          spinner.text = chalk.blue(
            `Running ReAct agent on: "${query.substring(0, 50)}..."`
          );
        } else {
          spinner.stop();
          console.error(
            chalk.red(
              `Unknown agent type: "${type}". Supported types are: "plan", "react".`
            )
          );
          return;
        }

        const finalState = await graphRunner(initialState);
        spinner.succeed(chalk.green.bold('Agent run completed.'));
        console.log(
          chalk.dim(
            '----------------------------------------------------------------'
          )
        );
        console.log(chalk.yellow.bold('Final Answer:'));
        console.log(
          chalk.cyan(finalState.finalAnswer || 'No final answer was produced.')
        );
        console.log(
          chalk.dim(
            '----------------------------------------------------------------'
          )
        );

        if (verbose) {
          logger.info('Agent final state:', finalState);
        }
      } catch (error) {
        spinner.fail(chalk.red('Agent run failed.'));
        logger.error('Error running agent:', error);
        console.error(chalk.red.bold(error.message));
        if (verbose) {
          console.error(chalk.dim(error.stack));
        }
      }
    });
}
