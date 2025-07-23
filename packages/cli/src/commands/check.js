// src/cli/src/commands/check.js
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { checkOllamaStatus } from '@daitanjs/intelligence';
import { checkChromaConnection } from '@daitanjs/intelligence';

const logger = getLogger('daitan-cli-check');

const checkRequirement = async (name, checkFn, spinner) => {
  spinner.text = `Checking ${name}...`;
  try {
    const result = await checkFn();
    if (result) {
      spinner.succeed(chalk.green(`${name} is configured and reachable.`));
      return true;
    } else {
      spinner.fail(chalk.yellow(`${name} is not configured or not reachable.`));
      return false;
    }
  } catch (error) {
    spinner.fail(chalk.red(`${name} check failed with an error.`));
    logger.error(`Error checking ${name}:`, error);
    return false;
  }
};

export function registerCheckCommands(program) {
  program
    .command('check')
    .description(chalk.cyan('Check the health and configuration of DaitanJS services and environment variables.'))
    .action(async () => {
      console.log(chalk.bold.blue('Running DaitanJS Environment Health Checks...'));
      const spinner = ora('Starting checks...').start();
      const config = getConfigManager();

      await checkRequirement('Ollama Server', () => checkOllamaStatus(config.get('OLLAMA_BASE_URL')), spinner);
      await checkRequirement('ChromaDB Server', checkChromaConnection, spinner);
      await checkRequirement('OpenAI API Key', () => !!config.get('OPENAI_API_KEY'), spinner);
      await checkRequirement('Anthropic API Key', () => !!config.get('ANTHROPIC_API_KEY'), spinner);
      await checkRequirement('Groq API Key', () => !!config.get('GROQ_API_KEY'), spinner);
      await checkRequirement('LangSmith API Key', () => !!config.get('LANGCHAIN_API_KEY'), spinner);
      await checkRequirement('Google Search API Key', () => !!config.get('GOOGLE_API_KEY_SEARCH'), spinner);
      
      spinner.stop();
      console.log(chalk.bold.blue('\nHealth check complete.'));
    });
}