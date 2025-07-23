// cli/src/commands/rag.js
/**
 * @file Registers the 'rag' command and its subcommands for the DaitanJS CLI.
 * @module @daitanjs/cli/commands/rag
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import inquirer from 'inquirer';
import { getLogger } from '@daitanjs/development';
import {
  loadAndEmbedFile,
  askWithRetrieval,
  printStoreStats,
  vectorStoreCollectionExists,
  getVectorStore,
} from '@daitanjs/intelligence';
import { DaitanOperationError } from '@daitanjs/error';

const logger = getLogger('daitan-cli-rag');

/**
 * Registers the 'rag' command and its subcommands.
 * @param {Command} program
 */
export function registerRagCommands(program) {
  const ragCommand = program
    .command('rag')
    .description(
      chalk.cyan('Manage and query Retrieval-Augmented Generation collections.')
    );

  ragCommand
    .command('add <filePath>')
    .description(
      'Load, chunk, and embed a file or directory into a RAG collection.'
    )
    .option(
      '-c, --collection <name>',
      'The name of the RAG collection.',
      'daitan_rag_default_store'
    )
    .option(
      '--chunk-size <number>',
      'The size of each document chunk.',
      (v) => parseInt(v, 10),
      1000
    )
    .option(
      '--chunk-overlap <number>',
      'The overlap between chunks.',
      (v) => parseInt(v, 10),
      200
    )
    .action(async (filePath, options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(
        chalk.blue(
          `Embedding "${filePath}" into collection "${options.collection}"...`
        )
      ).start();
      try {
        await loadAndEmbedFile({
          filePath: path.resolve(filePath),
          options: {
            collectionName: options.collection,
            chunkSize: options.chunkSize,
            chunkOverlap: options.chunkOverlap,
            localVerbose: verbose,
          },
        });
        spinner.succeed(chalk.green.bold('Successfully embedded content.'));
      } catch (error) {
        spinner.fail(chalk.red('File embedding failed.'));
        logger.error(`Error during RAG 'add' command:`, error);
        console.error(chalk.red.bold(error.message));
      }
    });

  ragCommand
    .command('query <question>')
    .description('Ask a question to a RAG collection.')
    .option(
      '-c, --collection <name>',
      'The RAG collection to query.',
      'daitan_rag_default_store'
    )
    .option(
      '--top-k <number>',
      'Number of documents to retrieve.',
      (v) => parseInt(v, 10),
      5
    )
    .option('--hyde', 'Enable Hypothetical Document Embeddings for the query.')
    .action(async (question, options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(
        chalk.blue(`Querying collection "${options.collection}"...`)
      ).start();
      try {
        if (!(await vectorStoreCollectionExists(options.collection))) {
          throw new DaitanOperationError(
            `Collection "${options.collection}" does not exist.`
          );
        }
        spinner.text = 'Retrieving documents and synthesizing answer...';
        const result = await askWithRetrieval(question, {
          collectionName: options.collection,
          topK: options.topK,
          useHyDE: options.hyde,
          localVerbose: verbose,
        });
        spinner.succeed(chalk.green.bold('Answer synthesized.'));
        console.log(
          chalk.dim(
            '----------------------------------------------------------------'
          )
        );
        console.log(chalk.cyan(result.text));
        console.log(
          chalk.dim(
            '----------------------------------------------------------------'
          )
        );
        if (verbose) {
          console.log(chalk.yellow.bold('\nRetrieved Documents:'));
          result.retrievedDocs.forEach((doc, i) => {
            console.log(
              chalk.dim(
                `--- Doc ${i + 1} (Score: ${
                  doc.score?.toFixed(4) || 'N/A'
                }) ---`
              )
            );
            console.log(
              chalk.dim(`Source: ${doc.metadata.source_filename || 'Unknown'}`)
            );
            console.log(
              chalk.dim(`Content: ${doc.pageContent.substring(0, 200)}...`)
            );
          });
        }
      } catch (error) {
        spinner.fail(chalk.red('RAG query failed.'));
        logger.error(`Error during RAG 'query' command:`, error);
        console.error(chalk.red.bold(error.message));
      }
    });

  ragCommand
    .command('stats')
    .description('Display statistics for a RAG collection.')
    .option(
      '-c, --collection <name>',
      'The RAG collection to inspect.',
      'daitan_rag_default_store'
    )
    .option(
      '--limit <number>',
      'Number of sample documents to display.',
      (v) => parseInt(v, 10),
      3
    )
    .action(async (options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(
        chalk.blue(`Fetching stats for collection "${options.collection}"...`)
      ).start();
      try {
        await printStoreStats({
          collectionName: options.collection,
          sampleLimit: options.limit,
          localVerbose: verbose,
        });
        spinner.succeed(chalk.green('Stats displayed.'));
      } catch (error) {
        spinner.fail(chalk.red('Failed to retrieve collection stats.'));
        logger.error(`Error during RAG 'stats' command:`, error);
        console.error(chalk.red.bold(error.message));
      }
    });

  ragCommand
    .command('reset')
    .description(
      'Deletes all documents from a RAG collection by recreating it.'
    )
    .option(
      '-c, --collection <name>',
      'The name of the collection to reset.',
      'daitan_rag_default_store'
    )
    .option('--force', 'Bypass the confirmation prompt.')
    .action(async (options) => {
      const verbose = program.opts().verbose;
      console.log(
        chalk.red.bold('! WARNING: This is a destructive operation. !')
      );
      console.log(
        chalk.yellow(
          `You are about to delete all data from collection: "${options.collection}".`
        )
      );

      const { proceed } = options.force
        ? { proceed: true }
        : await inquirer.prompt([
            {
              type: 'confirm',
              name: 'proceed',
              message: 'Are you sure?',
              default: false,
            },
          ]);
      if (!proceed) {
        console.log(chalk.gray('Operation cancelled.'));
        return;
      }

      const spinner = ora(
        chalk.red(`Resetting collection "${options.collection}"...`)
      ).start();
      try {
        await getVectorStore({
          collectionName: options.collection,
          forceRecreateCollection: true,
          localVerbose: verbose,
        });
        spinner.succeed(
          chalk.green.bold(
            `Collection "${options.collection}" has been successfully reset.`
          )
        );
      } catch (error) {
        spinner.fail(chalk.red('Collection reset failed.'));
        logger.error(`Error during RAG 'reset' command:`, error);
        console.error(chalk.red.bold(error.message));
      }
    });
}
