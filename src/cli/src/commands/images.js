// cli/src/commands/images.js
/**
 * @file Registers the 'image' command for the DaitanJS CLI.
 * @module @daitanjs/cli/commands/images
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { getLogger } from '@daitanjs/development';
import { uploadImage } from '@daitanjs/images';

const logger = getLogger('daitan-cli-images');

/**
 * Registers the 'image' command and its subcommands.
 * @param {Command} program
 */
export function registerImageCommands(program) {
  const imageCommand = program
    .command('image')
    .description(chalk.cyan('Manage and upload images to cloud storage.'));

  imageCommand
    .command('upload <filePath>')
    .description(
      'Upload an image from a local path to the configured provider.'
    )
    .option(
      '-p, --provider <name>',
      'The cloud provider to use (e.g., "firebase", "cloudinary"). Defaults to "firebase".',
      'firebase'
    )
    .option(
      '--prefix <path>',
      'A path prefix or folder for the image in cloud storage (e.g., "avatars/").'
    )
    .action(async (filePath, options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(
        chalk.blue(`Uploading image "${path.basename(filePath)}"...`)
      ).start();

      try {
        const absolutePath = path.resolve(filePath);
        spinner.text = chalk.blue(
          `Uploading to ${options.provider} from "${path.basename(
            absolutePath
          )}"...`
        );

        // Use the new single-parameter object API for uploadImage
        const imageUrl = await uploadImage({
          fileSource: absolutePath,
          options: {
            provider: options.provider,
            providerOptions: {
              firebasePathPrefix: options.prefix, // For firebase
              folder: options.prefix, // For cloudinary
            },
          },
        });

        spinner.succeed(chalk.green.bold('Image uploaded successfully!'));
        console.log(
          `${chalk.cyan('Public URL:')} ${chalk.white.underline(imageUrl)}`
        );
      } catch (error) {
        spinner.fail(chalk.red('Image upload failed.'));
        logger.error(`Error during 'image upload' command:`, error);
        console.error(chalk.red.bold(error.message));
        if (verbose) {
          console.error(chalk.dim(error.stack));
        }
      }
    });
}
