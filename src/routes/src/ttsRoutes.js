// routes/src/ttsRoutes.js
/**
 * @file Reusable Next.js App Router route handler for Text-to-Speech (TTS).
 * @module @daitanjs/routes/ttsRoutes
 */

import { NextResponse } from 'next/server';
import { getLogger } from '@daitanjs/development';
import { tts } from '@daitanjs/speech';
import { handleApiError, getJsonBody } from './helpers.js';
import { withAuth } from '@daitanjs/middleware';
import fs from 'fs';
import {
  DaitanFileOperationError,
  DaitanOperationError,
} from '@daitanjs/error';
import path from 'path';
import os from 'os';

const ttsRoutesLogger = getLogger('daitan-routes-tts');

/**
 * Route handler for Text-to-Speech generation.
 * Expects a POST request with a JSON body containing the text and options,
 * now structured for the new `tts` API.
 * e.g., { "content": { "text": "Hello" }, "voiceConfig": { "provider": "google" }, ... }
 *
 * @param {import('next/server').NextRequest} req - The Next.js request object.
 * @returns {Promise<import('next/server').NextResponse | Response>} A streaming response with the MP3 audio.
 */
async function ttsHandler(req) {
  const callId = `tts-route-${Date.now()}`;
  let tempOutputPath = null;

  try {
    // --- AMENDED: getJsonBody() will get the entire new structured payload ---
    const payload = await getJsonBody(req);

    // Generate a temporary file path for the output
    const tempDir = path.join(os.tmpdir(), 'daitanjs-tts-cache');
    const tempFileName = `speech_${callId}.mp3`;
    tempOutputPath = path.join(tempDir, tempFileName);

    ttsRoutesLogger.debug(
      `[${callId}] Generating TTS audio to temporary file: ${tempOutputPath}`
    );

    // --- AMENDED: Pass the payload directly to the refactored `tts` function ---
    // The new `tts` function expects an object like { content, voiceConfig, output }.
    // We construct this object from our request payload and the temporary path.
    await tts({
      ...payload, // This can contain `content` and `voiceConfig` from the request
      output: {
        filePath: tempOutputPath,
      },
    });

    // Now that the file is created, create a read stream and pipe it to the response.
    const stats = await fs.promises.stat(tempOutputPath);
    const dataStream = fs.createReadStream(tempOutputPath);

    const response = new Response(dataStream, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `inline; filename="${tempFileName}"`,
      },
    });

    // The stream piping handles cleanup on its own in modern environments, but for robustness:
    dataStream.on('close', async () => {
      try {
        await fs.promises.unlink(tempOutputPath);
        ttsRoutesLogger.debug(
          `[${callId}] Cleaned up temporary audio file: ${tempOutputPath}`
        );
      } catch (cleanupError) {
        ttsRoutesLogger.error(
          `[${callId}] Failed to clean up temporary audio file: ${tempOutputPath}`,
          cleanupError
        );
      }
    });

    return response;
  } catch (error) {
    // If we fail before streaming, cleanup the temp file if it was created
    if (tempOutputPath) {
      try {
        await fs.promises.unlink(tempOutputPath);
      } catch (e) {
        /* ignore cleanup error */
      }
    }

    if (
      error instanceof DaitanFileOperationError &&
      error.message.includes('Failed to create output directory')
    ) {
      return handleApiError(
        new DaitanOperationError(
          'Server is unable to create temporary audio files for TTS.',
          {},
          error
        ),
        'ttsHandler-setup'
      );
    }
    return handleApiError(error, 'ttsHandler');
  }
}

export const handleTTS = withAuth(ttsHandler);
