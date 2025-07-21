// cli/src/commands/senses.js
/**
 * @file Registers the 'senses' command for AI-powered sensory tasks.
 * @module @daitanjs/cli/commands/senses
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { getLogger } from '@daitanjs/development';
import { generateImage, analyzeImage } from '@daitanjs/senses';

const logger = getLogger('daitan-cli-senses');

/**
 * Registers the 'senses' command and its subcommands.
 * @param {Command} program
 */
export function registerSensesCommands(program) {
  const sensesCommand = program
    .command('senses')
    .description(
      chalk.cyan('Use AI senses for tasks like image generation and analysis.')
    );

  sensesCommand
    .command('generate-image <prompt>')
    .alias('gen')
    .description("Generate an image from a text prompt using OpenAI's DALL-E.")
    .option(
      '-o, --output <filepath>',
      'The output file path for the generated image.',
      `./output/image_${Date.now()}.png`
    )
    .option('-m, --model <name>', 'The DALL-E model to use.', 'dall-e-3')
    .option(
      '-s, --size <dimensions>',
      'The size of the generated image.',
      '1024x1024'
    )
    .option('--style <style>', 'For DALL-E 3: "vivid" or "natural".', 'vivid')
    .option(
      '--quality <quality>',
      'For DALL-E 3: "standard" or "hd".',
      'standard'
    )
    .action(async (prompt, options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(
        chalk.blue('Generating image with DALL-E...')
      ).start();
      try {
        const absolutePath = path.resolve(options.output);
        spinner.text = chalk.blue(
          `Prompt: "${prompt.substring(0, 40)}...". Saving to "${path.basename(
            absolutePath
          )}"`
        );

        const result = await generateImage({
          prompt: prompt,
          outputPath: absolutePath,
          model: options.model,
          size: options.size,
          style: options.style,
          quality: options.quality,
          response_format: 'b64_json', // Required to save the file
        });

        spinner.succeed(
          chalk.green.bold('Image generated and saved successfully!')
        );
        console.log(
          `${chalk.cyan('Image saved to:')} ${chalk.white(result.outputPath)}`
        );
        if (result.revisedPrompt) {
          console.log(chalk.yellow.bold('\nRevised Prompt by DALL-E 3:'));
          console.log(chalk.cyan(result.revisedPrompt));
        }
      } catch (error) {
        spinner.fail(chalk.red('Image generation failed.'));
        logger.error(`Error during 'senses generate-image' command:`, error);
        console.error(chalk.red.bold(error.message));
      }
    });

  sensesCommand
    .command('analyze-image <imagePath> <prompt>')
    .alias('analyze')
    .description(
      "Analyze an image with a text prompt using OpenAI's vision model."
    )
    .option('-m, --model <name>', 'The vision model to use (e.g., "gpt-4o").')
    .action(async (imagePath, prompt, options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(
        chalk.blue(`Analyzing image "${path.basename(imagePath)}"...`)
      ).start();
      try {
        spinner.text = chalk.blue(
          `Analyzing with prompt: "${prompt.substring(0, 40)}..."`
        );

        const result = await analyzeImage({
          imageSource: imagePath,
          prompt: prompt,
          model: options.model,
          llmConfigOptions: { verbose },
        });

        spinner.succeed(chalk.green.bold('Image analysis complete!'));
        console.log(
          chalk.dim(
            '\n------------------------- ANALYSIS -------------------------'
          )
        );
        console.log(chalk.cyan(result.analysis));
        console.log(
          chalk.dim(
            '------------------------------------------------------------'
          )
        );
        if (verbose && result.usage) {
          console.log(chalk.yellow.bold('\nToken Usage:'));
          console.log(chalk.dim(JSON.stringify(result.usage, null, 2)));
        }
      } catch (error) {
        spinner.fail(chalk.red('Image analysis failed.'));
        logger.error(`Error during 'senses analyze-image' command:`, error);
        console.error(chalk.red.bold(error.message));
      }
    });
}
