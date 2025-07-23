// routes/src/sttRoutes.js
/**
 * @file Reusable Next.js App Router route handler for Speech-to-Text (STT).
 * @module @daitanjs/routes/sttRoutes
 */

import { NextResponse } from 'next/server';
import { getLogger } from '@daitanjs/development';
import { transcribeAudio } from '@daitanjs/speech';
import { handleApiError, createSuccessResponse } from './helpers.js';
import { withAuth } from '@daitanjs/middleware';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { DaitanInvalidInputError } from '@daitanjs/error';

const sttRoutesLogger = getLogger('daitan-routes-stt');

/**
 * Route handler for Speech-to-Text transcription.
 * Expects a POST request with 'multipart/form-data'. The form should contain
 * a field named 'file' with the audio data. Optional fields for 'language',
 * 'model', etc., can also be included to be passed as the `config` object.
 *
 * @param {import('next/server').NextRequest} req - The Next.js request object.
 * @returns {Promise<import('next/server').NextResponse>}
 */
async function sttHandler(req) {
  const callId = `stt-route-${Date.now()}`;
  const tempDir = path.join(os.tmpdir(), 'daitanjs-stt-uploads');
  let tempFilePath = null;

  try {
    const formData = await req.formData();
    const audioFile = formData.get('file');

    if (!audioFile || typeof audioFile.arrayBuffer !== 'function') {
      throw new DaitanInvalidInputError(
        "No file found in the 'file' field of the form data."
      );
    }

    await fs.mkdir(tempDir, { recursive: true });
    const originalFileName = audioFile.name || `upload_${callId}.tmp`;
    tempFilePath = path.join(tempDir, originalFileName);

    sttRoutesLogger.debug(
      `[${callId}] Saving uploaded audio file temporarily to: ${tempFilePath}`
    );
    const fileBuffer = Buffer.from(await audioFile.arrayBuffer());
    await fs.writeFile(tempFilePath, fileBuffer);

    // Gather config options from the form data for the new structured API
    const transcriptionConfig = {};
    if (formData.has('language'))
      transcriptionConfig.language = formData.get('language');
    if (formData.has('prompt'))
      transcriptionConfig.prompt = formData.get('prompt');
    if (formData.has('model'))
      transcriptionConfig.model = formData.get('model');
    if (formData.has('temperature'))
      transcriptionConfig.temperature = parseFloat(formData.get('temperature'));

    // Always get detailed JSON back from the service for flexible front-end use
    transcriptionConfig.response_format = 'verbose_json';

    sttRoutesLogger.debug(`[${callId}] Transcribing audio file...`);

    // Call the refactored transcribeAudio with the new structured parameter
    const transcriptionResult = await transcribeAudio({
      source: { filePath: tempFilePath },
      config: transcriptionConfig,
    });

    return createSuccessResponse(transcriptionResult);
  } catch (error) {
    return handleApiError(error, 'sttHandler');
  } finally {
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        sttRoutesLogger.debug(
          `[${callId}] Cleaned up temporary audio file: ${tempFilePath}`
        );
      } catch (cleanupError) {
        sttRoutesLogger.error(
          `[${callId}] Failed to clean up temporary audio file: ${tempFilePath}`,
          cleanupError
        );
      }
    }
  }
}

export const handleSTT = withAuth(sttHandler);
