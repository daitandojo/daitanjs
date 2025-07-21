// senses/src/capture.js
/**
 * @file Browser-based media capture (microphone audio, webcam video).
 * @module @daitanjs/senses/capture
 *
 * @description
 * This module provides high-level functions for capturing audio from the user's microphone
 * and video from their webcam using the browser's `MediaDevices` API. This functionality is
 * strictly for front-end browser environments.
 */

import { getLogger } from '@daitanjs/development';
import {
  DaitanBrowserSpecificError,
  DaitanOperationError,
} from '@daitanjs/error';

const captureLogger = getLogger('daitan-senses-capture');

/**
 * Checks if the required browser APIs (`navigator.mediaDevices`) are available.
 * @private
 * @throws {DaitanBrowserSpecificError} If not in a browser environment or if APIs are missing.
 */
function ensureBrowserMediaAPIs() {
  if (
    typeof window === 'undefined' ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    throw new DaitanBrowserSpecificError(
      'Media capture is only available in a browser environment with support for the MediaDevices API.'
    );
  }
}

/**
 * @typedef {Object} MediaRecorderControls
 * @property {() => void} start - Starts the recording.
 * @property {() => void} stop - Stops the recording and resolves the promise with the result.
 * @property {() => void} pause - Pauses the recording.
 * @property {() => void} resume - Resumes a paused recording.
 * @property {() => 'recording' | 'paused' | 'inactive'} state - Gets the current state of the recorder.
 */

/**
 * @typedef {Object} AudioRecordingResult
 * @property {Blob} blob - The recorded audio data as a Blob.
 * @property {string} objectURL - A temporary URL for the Blob, useful for playback.
 * @property {string} mimeType - The MIME type of the recorded audio Blob.
 */

/**
 * Captures audio from the user's microphone. This function returns a Promise that
 * resolves when the recording is stopped, along with controls to manage the recording.
 *
 * @public
 * @async
 * @param {object} [options={}] - Options for audio capture.
 * @param {string} [options.mimeType='audio/webm;codecs=opus'] - The desired MIME type for the recording. Browser support may vary. 'audio/mpeg' or 'audio/wav' are other possibilities.
 * @returns {Promise<{ recording: Promise<AudioRecordingResult>, controls: MediaRecorderControls }>} An object containing a `recording` promise and `controls` to start/stop the capture.
 * @throws {DaitanBrowserSpecificError} If not run in a supported browser environment.
 * @throws {DaitanOperationError} If permission to use the microphone is denied or another error occurs.
 *
 * @example
 * async function startRecording() {
 *   try {
 *     const { recording, controls } = await captureAudio();
 *     console.log("Ready to record. Call controls.start()");
 *     // In a UI button click:
 *     // recordButton.onclick = controls.start;
 *     // stopButton.onclick = controls.stop;
 *
 *     const { blob, objectURL } = await recording;
 *     console.log("Recording finished!", blob.size, objectURL);
 *     // Now you can play the audio or upload the blob
 *     const audioPlayer = new Audio(objectURL);
 *     audioPlayer.play();
 *   } catch (error) {
 *     console.error("Failed to start audio capture:", error.message);
 *   }
 * }
 */
export const captureAudio = async (options = {}) => {
  ensureBrowserMediaAPIs();
  const { mimeType = 'audio/webm;codecs=opus' } = options;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    const audioChunks = [];

    mediaRecorder.addEventListener('dataavailable', (event) => {
      audioChunks.push(event.data);
    });

    const recordingPromise = new Promise((resolve, reject) => {
      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunks, {
          type: mediaRecorder.mimeType,
        });
        const objectURL = URL.createObjectURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop()); // Stop the mic stream
        resolve({
          blob: audioBlob,
          objectURL,
          mimeType: mediaRecorder.mimeType,
        });
      });
      mediaRecorder.addEventListener('error', (event) => {
        stream.getTracks().forEach((track) => track.stop());
        reject(
          new DaitanOperationError(
            `MediaRecorder error: ${event.error.message}`
          )
        );
      });
    });

    const controls = {
      start: () => mediaRecorder.start(),
      stop: () => mediaRecorder.stop(),
      pause: () => mediaRecorder.pause(),
      resume: () => mediaRecorder.resume(),
      state: () => mediaRecorder.state,
    };

    return { recording: recordingPromise, controls };
  } catch (error) {
    let errorMessage = `Failed to get microphone access: ${error.message}`;
    if (
      error.name === 'NotAllowedError' ||
      error.name === 'PermissionDeniedError'
    ) {
      errorMessage =
        'Permission to use the microphone was denied. Please allow microphone access in your browser settings.';
    } else if (
      error.name === 'NotFoundError' ||
      error.name === 'DevicesNotFoundError'
    ) {
      errorMessage = 'No microphone was found on this device.';
    }
    captureLogger.error('Error initializing audio capture.', {
      errorName: error.name,
      message: errorMessage,
    });
    throw new DaitanOperationError(errorMessage, { originalError: error });
  }
};

/**
 * @typedef {Object} VideoRecordingResult
 * @property {Blob} blob - The recorded video data as a Blob.
 * @property {string} objectURL - A temporary URL for the Blob, useful for playback.
 * @property {string} mimeType - The MIME type of the recorded video Blob.
 */

/**
 * Captures video (and optionally audio) from the user's webcam and microphone.
 * Returns a Promise that resolves when the recording is stopped, along with controls.
 *
 * @public
 * @async
 * @param {object} [options={}] - Options for video capture.
 * @param {string} [options.mimeType='video/webm;codecs=vp8,opus'] - The desired MIME type.
 * @param {boolean} [options.includeAudio=true] - Whether to include audio in the recording.
 * @param {object} [options.constraints] - Custom `MediaStreamConstraints` to pass to `getUserMedia`.
 * @returns {Promise<{ recording: Promise<VideoRecordingResult>, controls: MediaRecorderControls }>}
 * @throws {DaitanBrowserSpecificError} If not run in a supported browser environment.
 * @throws {DaitanOperationError} If permission is denied or another error occurs.
 */
export const captureVideo = async (options = {}) => {
  ensureBrowserMediaAPIs();
  const {
    mimeType = 'video/webm;codecs=vp8,opus',
    includeAudio = true,
    constraints = { video: true, audio: includeAudio },
  } = options;

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    const videoChunks = [];

    mediaRecorder.addEventListener('dataavailable', (event) => {
      videoChunks.push(event.data);
    });

    const recordingPromise = new Promise((resolve, reject) => {
      mediaRecorder.addEventListener('stop', () => {
        const videoBlob = new Blob(videoChunks, {
          type: mediaRecorder.mimeType,
        });
        const objectURL = URL.createObjectURL(videoBlob);
        stream.getTracks().forEach((track) => track.stop()); // Stop camera and mic
        resolve({
          blob: videoBlob,
          objectURL,
          mimeType: mediaRecorder.mimeType,
        });
      });
      mediaRecorder.addEventListener('error', (event) => {
        stream.getTracks().forEach((track) => track.stop());
        reject(
          new DaitanOperationError(
            `MediaRecorder error: ${event.error.message}`
          )
        );
      });
    });

    const controls = {
      start: () => mediaRecorder.start(),
      stop: () => mediaRecorder.stop(),
      pause: () => mediaRecorder.pause(),
      resume: () => mediaRecorder.resume(),
      state: () => mediaRecorder.state,
    };

    return { recording: recordingPromise, controls };
  } catch (error) {
    let errorMessage = `Failed to get camera/microphone access: ${error.message}`;
    if (
      error.name === 'NotAllowedError' ||
      error.name === 'PermissionDeniedError'
    ) {
      errorMessage =
        'Permission to use the camera and/or microphone was denied.';
    } else if (
      error.name === 'NotFoundError' ||
      error.name === 'DevicesNotFoundError'
    ) {
      errorMessage = 'No camera and/or microphone was found on this device.';
    }
    captureLogger.error('Error initializing video capture.', {
      errorName: error.name,
      message: errorMessage,
    });
    throw new DaitanOperationError(errorMessage, { originalError: error });
  }
};
