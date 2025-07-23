// packages/images/src/index.js
/**
 * @file Main entry point for the @daitanjs/images package.
 * @module @daitanjs/images
 *
 * @description
 * This package provides a unified interface for uploading images to various cloud storage providers.
 * The primary, opinionated choices are Firebase Storage (default) and Cloudinary.
 *
 * It aims to abstract away the complexities of each provider's SDK, offering a primary `uploadImage`
 * function that defaults to Firebase but can be directed to use other supported providers.
 *
 * Configuration for each provider (API keys, bucket names, etc.) is managed through
 * environment variables via `@daitanjs/config`.
 */

import { getLogger } from '@daitanjs/development';
import { uploadImageToFirebase } from './firebase.js';
import { uploadImageToCloudinary } from './cloudinary.js';
import {
  DaitanInvalidInputError,
  DaitanConfigurationError,
} from '@daitanjs/error';

const imagesIndexLogger = getLogger('daitan-images-index');

imagesIndexLogger.debug('Exporting DaitanJS Images module functionalities...');

/**
 * @typedef {Object} UploadOptions
 * @property {'firebase' | 'cloudinary'} [provider='firebase'] - The cloud provider to use.
 * @property {object} [providerOptions={}] - Provider-specific options.
 */

/**
 * @typedef {Object} UploadImageParams
 * @property {string | Buffer | File | Blob} fileSource - The image source.
 * @property {UploadOptions} [options={}] - Options for the upload.
 */

/**
 * A high-level, provider-agnostic function to upload an image.
 *
 * @public
 * @async
 * @param {UploadImageParams} params - The parameters for the image upload.
 * @returns {Promise<string>} The public URL of the uploaded image.
 * @throws {DaitanConfigurationError | DaitanInvalidInputError}
 */
export const uploadImage = async ({ fileSource, options = {} }) => {
  const { provider = 'firebase', providerOptions = {} } = options;
  imagesIndexLogger.info(
    `uploadImage called, routing to provider: "${provider}"`
  );

  if (!fileSource) {
    throw new DaitanInvalidInputError(
      'fileSource must be provided for uploadImage.'
    );
  }

  switch (provider.toLowerCase()) {
    case 'firebase':
      return uploadImageToFirebase(fileSource, providerOptions);
    case 'cloudinary':
      return uploadImageToCloudinary(fileSource, providerOptions);
    default:
      throw new DaitanConfigurationError(
        `Unsupported image provider: "${provider}". Supported: 'firebase', 'cloudinary'.`
      );
  }
};

// Export provider-specific functions for direct use if needed.
export { uploadImageToCloudinary } from './cloudinary.js';
export { uploadImageToB2 } from './backblaze.js';
export { uploadImageToAWS } from './AWS.js';
export { uploadImageToFirebase, deleteImagesFirebaseApp } from './firebase.js';

imagesIndexLogger.info('DaitanJS Images module exports ready.');
