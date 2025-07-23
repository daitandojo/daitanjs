// cli/src/commands/speech.js
/**
 * @file Registers the 'speech' command and its subcommands for the DaitanJS CLI.
 * @module @daitanjs/cli/commands/speech
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';
import { getLogger } from '@daitanjs/development';
import { tts, transcribeAudio } from '@daitanjs/speech';

const logger = getLogger('daitan-cli-speech');

/**
 * Registers the 'speech' command and its subcommands to the main program.
 * @param {Command} program - The main commander program instance.
 */
export function registerSpeechCommands(program) {
  const speechCommand = program
    .command('speech')
    .description(
      chalk.cyan('Perform Text-to-Speech (TTS) and Speech-to-Text (STT) tasks.')
    );

  // --- Speech TTS Subcommand ---
  speechCommand
    .command('tts <text>')
    .description('Synthesize speech from text and save it as an MP3 file.')
    .option(
      '-o, --output <filepath>',
      'The output file path for the MP3.',
      `./output/speech_${Date.now()}.mp3`
    )
    .option(
      '-p, --provider <name>',
      'The TTS provider to use (e.g., "google", "elevenlabs").',
      'google'
    )
    .option(
      '-l, --lang <code>',
      '(Google) The BCP-47 language code (e.g., "en-US", "es-ES").',
      'en-US'
    )
    .option(
      '-g, --gender <gender>',
      '(Google) The preferred voice gender (NEUTRAL, MALE, FEMALE).',
      'NEUTRAL'
    )
    .option('-v, --voice <id>', '(ElevenLabs) The specific voice ID to use.')
    .action(async (text, options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(chalk.blue('Synthesizing audio...')).start();

      try {
        spinner.text = chalk.blue(
          `Synthesizing with ${options.provider} and saving to "${path.basename(
            options.output
          )}"...`
        );

        // Use the new structured API for tts
        const outputPath = await tts({
          content: { text },
          voiceConfig: {
            provider: options.provider,
            languageCode: options.lang,
            ssmlGender: options.gender.toUpperCase(),
            voiceId: options.voice,
          },
          output: {
            filePath: options.output,
          },
        });

        spinner.succeed(chalk.green.bold('Speech synthesized successfully!'));
        console.log(
          `${chalk.cyan('MP3 file saved to:')} ${chalk.white(outputPath)}`
        );
      } catch (error) {
        spinner.fail(chalk.red('Text-to-Speech synthesis failed.'));
        logger.error(`Error during 'speech tts' command:`, error);
        console.error(chalk.red.bold(error.message));
        if (verbose) {
          console.error(chalk.dim(error.stack));
        }
      }
    });

  // --- Speech STT Subcommand ---
  speechCommand
    .command('stt <audioFilePath>')
    .description('Transcribe an audio file to text using OpenAI Whisper.')
    .option(
      '-o, --output <filepath>',
      'Optional: Save the transcription to a text file.'
    )
    .option(
      '-l, --lang code',
      'Optional: ISO-639-1 language code of the audio (e.g., "en", "es").'
    )
    .option(
      '-f, --format <format>',
      'The output format (json, text, srt, verbose_json, vtt).',
      'text'
    )
    .action(async (audioFilePath, options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(
        chalk.blue(
          `Transcribing audio file: "${path.basename(audioFilePath)}"...`
        )
      ).start();

      try {
        // Use the new structured API for transcribeAudio
        const result = await transcribeAudio({
          source: { filePath: path.resolve(audioFilePath) },
          config: {
            language: options.lang,
            response_format: options.format,
          },
        });

        let outputText;
        if (options.format === 'json' || options.format === 'verbose_json') {
          outputText = JSON.stringify(result, null, 2);
        } else {
          outputText = result.text || result; // Whisper text format just returns text, verbose_json has a 'text' property
        }

        spinner.succeed(chalk.green.bold('Audio transcribed successfully!'));

        if (options.output) {
          const outputFilePath = path.resolve(options.output);
          const outputDir = path.dirname(outputFilePath);
          await fs.mkdir(outputDir, { recursive: true });
          await fs.writeFile(outputFilePath, outputText, 'utf-8');
          console.log(
            `${chalk.cyan('Transcription saved to:')} ${chalk.white(
              outputFilePath
            )}`
          );
        } else {
          console.log(
            chalk.dim(
              '\n------------------------ TRANSCRIPT ------------------------'
            )
          );
          console.log(chalk.cyan(outputText));
          console.log(
            chalk.dim(
              '----------------------------------------------------------'
            )
          );
        }
      } catch (error) {
        spinner.fail(chalk.red('Speech-to-Text transcription failed.'));
        logger.error(`Error during 'speech stt' command:`, error);
        console.error(chalk.red.bold(error.message));
        if (verbose) {
          console.error(chalk.dim(error.stack));
        }
      }
    });
}
