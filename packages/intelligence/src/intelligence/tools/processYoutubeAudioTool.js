// intelligence/src/intelligence/tools/processYoutubeAudioTool.js
/**
 * @file A DaitanJS tool for downloading and transcribing YouTube video audio.
 * @module @daitanjs/intelligence/tools/processYoutubeAudioTool
 *
 * @description
 * This module exports a high-level, LangChain-compatible tool that allows an AI agent to
 * orchestrate the download and transcription of a YouTube video in a single step. It wraps
 * the `transcribeYoutubeVideo` function from the `@daitanjs/media` package.
 */

import { createDaitanTool } from '../core/toolFactory.js'; // CORRECTED: Import from the new 'core' location
import { z } from 'zod';
import { transcribeYoutubeVideo } from '@daitanjs/media';
import { DaitanNotFoundError } from '@daitanjs/error';

// Zod schema for validating the input to the tool
const ProcessYoutubeAudioInputSchema = z
  .object({
    url: z
      .string()
      .url('A valid YouTube video URL is required.')
      .refine(
        (val) => val.includes('youtube.com') || val.includes('youtu.be'),
        'The URL must be a valid YouTube video link.'
      ),
    transcriptionConfig: z
      .object({
        language: z
          .string()
          .optional()
          .describe(
            'Optional: The ISO-639-1 language code of the audio (e.g., "en", "es").'
          ),
        prompt: z
          .string()
          .optional()
          .describe(
            'Optional: A prompt to guide the transcription model or provide context.'
          ),
      })
      .optional()
      .describe(
        'Optional configuration for the speech-to-text transcription process.'
      ),
  })
  .strict();

/**
 * A DaitanJS tool that downloads the audio from a YouTube URL,
 * transcribes it to text using OpenAI Whisper, and returns the transcription.
 */
export const processYoutubeAudioTool = createDaitanTool(
  'process_youtube_audio',
  `Downloads the audio from a given YouTube video URL and transcribes it into text.
The input must be an object with a "url" key containing the full YouTube video URL.
It can optionally include a "transcriptionConfig" object with a "language" (ISO-639-1 code) or "prompt" to improve accuracy.
This tool is very powerful for extracting spoken content from videos for analysis, summarization, or answering questions.`,
  async (input) => {
    // Validate the input against the Zod schema
    const validatedInput = ProcessYoutubeAudioInputSchema.parse(input);

    // Call the underlying service from @daitanjs/media
    const transcriptionResult = await transcribeYoutubeVideo({
      url: validatedInput.url,
      config: validatedInput.transcriptionConfig,
    });

    if (!transcriptionResult || !transcriptionResult.text) {
      throw new DaitanNotFoundError(
        `Could not obtain a valid transcription for the video at ${validatedInput.url}.`
      );
    }

    const fullText = transcriptionResult.text;
    const summary = `Successfully transcribed video. Length: ${
      fullText.length
    } characters. Preview: "${fullText.substring(0, 150)}..."`;

    return summary;
  },
  ProcessYoutubeAudioInputSchema
);
