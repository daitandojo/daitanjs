// cli/src/commands/geo.js
/**
 * @file Registers the 'geo' command for geolocation lookups.
 * @module @daitanjs/cli/commands/geo
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getLogger } from '@daitanjs/development';
import { forwardGeocode, reverseGeocode } from '@daitanjs/geo';
import { DaitanInvalidInputError } from '@daitanjs/error';

const logger = getLogger('daitan-cli-geo');

/**
 * Registers the 'geo' command and its subcommands.
 * @param {Command} program
 */
export function registerGeoCommands(program) {
  const geoCommand = program
    .command('geo')
    .description(chalk.cyan('Perform geolocation lookups.'));

  geoCommand
    .command('forward <address>')
    .alias('fwd')
    .description('Convert an address or place name to geographic coordinates.')
    .option(
      '-l, --limit <number>',
      'Maximum number of results to return.',
      (val) => parseInt(val, 10),
      1
    )
    .action(async (address, options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(
        chalk.blue(`Geocoding address: "${address}"...`)
      ).start();
      try {
        const results = await forwardGeocode({
          locationQuery: address,
          limit: options.limit,
        });
        if (results.length === 0) {
          spinner.warn(
            chalk.yellow('No coordinates found for the given address.')
          );
          return;
        }
        spinner.succeed(chalk.green('Geocoding successful!'));
        console.log(
          chalk.dim(
            '----------------------------------------------------------------'
          )
        );
        results.forEach((result, index) => {
          console.log(chalk.yellow.bold(`Result ${index + 1}:`));
          console.log(
            `${chalk.cyan('Place Name:')} ${chalk.white(result.place_name)}`
          );
          console.log(
            `${chalk.cyan('Coordinates (Lon, Lat):')} ${chalk.white(
              `[${result.center[0]}, ${result.center[1]}]`
            )}`
          );
          if (verbose && result.context)
            console.log(chalk.dim('Context:'), result.context);
          console.log(chalk.dim('---'));
        });
      } catch (error) {
        spinner.fail(chalk.red('Geocoding failed.'));
        logger.error(`Error during 'geo forward' command:`, error);
        console.error(chalk.red.bold(error.message));
      }
    });

  geoCommand
    .command('reverse <longitude> <latitude>')
    .alias('rev')
    .description('Convert geographic coordinates to a human-readable address.')
    .action(async (longitude, latitude) => {
      const verbose = program.opts().verbose;
      const lon = parseFloat(longitude);
      const lat = parseFloat(latitude);

      if (isNaN(lon) || isNaN(lat)) {
        console.error(
          chalk.red(
            'Invalid coordinates. Longitude and latitude must be valid numbers.'
          )
        );
        return;
      }

      const spinner = ora(
        chalk.blue(`Reverse geocoding coordinates: [${lon}, ${lat}]...`)
      ).start();
      try {
        const results = await reverseGeocode({ coordinates: [lon, lat] });
        if (results.length === 0) {
          spinner.warn(
            chalk.yellow('Could not find an address for the given coordinates.')
          );
          return;
        }
        spinner.succeed(chalk.green('Reverse geocoding successful!'));
        console.log(
          chalk.dim(
            '----------------------------------------------------------------'
          )
        );
        console.log(
          `${chalk.cyan('Best Match:')} ${chalk.white(results[0].place_name)}`
        );
        if (verbose) {
          console.log(chalk.yellow.bold('\nFull Results:'));
          console.log(JSON.stringify(results, null, 2));
        }
      } catch (error) {
        spinner.fail(chalk.red('Reverse geocoding failed.'));
        logger.error(`Error during 'geo reverse' command:`, error);
        console.error(chalk.red.bold(error.message));
      }
    });
}
