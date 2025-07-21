// cli/src/commands/media.js
/**
 * @file Registers the 'media' command for media-related tasks.
 * @module @daitanjs/cli/commands/media
 *
 * @description
 * This module provides CLI access to utilities from the `@daitanjs/media` package,
 * specifically for downloading and converting YouTube videos to MP3 audio files.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { getLogger } from '@daitanjs/development';
import { convertURLtoMP3 } from '@daitanjs/media';

const logger = getLogger('daitan-cli-media');

/**
 * Registers the 'media' command and its subcommands.
 * @param {Command} program
 */
export function registerMediaCommands(program) {
  const mediaCommand = program
    .command('media')
    .description(
      chalk.cyan('Perform media processing tasks, like YouTube downloads.')
    );

  mediaCommand
    .command('download-mp3 <url>')
    .alias('dl')
    .description(
      'Download a YouTube video and convert it to an MP3 audio file.'
    )
    .option(
      '-o, --output <dir>',
      'The output directory to save the MP3 file.',
      './output/audio'
    )
    .option(
      '-n, --name <filename>',
      'The base filename for the output MP3 (without .mp3 extension).'
    )
    .action(async (url, options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(chalk.blue('Preparing to download audio...')).start();

      try {
        const baseName = options.name || `audio_${Date.now()}`;
        const outputDir = path.resolve(options.output);

        spinner.text = chalk.blue(
          `Downloading and converting from "${url.substring(0, 40)}..."`
        );

        const outputPath = await convertURLtoMP3({
          url: url,
          outputDir: outputDir,
          baseName: baseName,
        });

        spinner.succeed(
          chalk.green.bold('Audio downloaded and converted successfully!')
        );
        console.log(
          `${chalk.cyan('MP3 file saved to:')} ${chalk.white(outputPath)}`
        );
      } catch (error) {
        spinner.fail(chalk.red('Audio download failed.'));
        logger.error(`Error during 'media download-mp3' command:`, error);
        console.error(chalk.red.bold(error.message));
        if (verbose) {
          console.error(chalk.dim(error.stack));
        }
      }
    });
}
