// images/src/cloudinary.js
/**
 * @file Cloudinary image upload functionalities.
 * @module @daitanjs/images/cloudinary
 */
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanFileOperationError,
  DaitanApiError,
  DaitanOperationError,
} from '@daitanjs/error';
import { isValidURL } from '@daitanjs/validation';
import FormData from 'form-data';
import { Buffer } from 'buffer';

const logger = getLogger('daitan-images-cloudinary');

const CLOUDINARY_API_BASE_URL = 'https://api.cloudinary.com/v1_1';

/**
 * Uploads an image to Cloudinary.
 * The input `fileSource` can be:
 * 1. A local file path (Node.js only).
 * 2. A publicly accessible URL to an image.
 * 3. A base64 encoded data URL string.
 * 4. A Buffer containing the image data (Node.js only).
 * 5. A Blob or File object (primarily for browser environments).
 *
 * @async
 * @public
 * @param {string | Buffer | File | Blob} fileSource - The image source.
 * @param {object} [options={}] - Optional parameters for the upload.
 * @param {string} [options.uploadPreset] - Cloudinary upload preset. Defaults to `CLOUDINARY_UPLOAD_PRESET`.
 * @param {string} [options.apiKey] - Cloudinary API key. Defaults to `CLOUDINARY_API_KEY`.
 * @param {string} [options.apiSecret] - Cloudinary API secret (needed for signed uploads).
 * @param {string} [options.cloudName] - Cloudinary cloud name. Defaults to `CLOUDINARY_CLOUD_NAME`.
 * @param {string} [options.folder] - Optional folder in Cloudinary.
 * @param {string} [options.publicId] - Optional public ID for the image.
 * @param {string} [options.tags] - Optional comma-separated string of tags.
 * @param {string} [options.eager] - Optional eager transformations.
 * @param {string} [options.resourceType='image'] - Cloudinary resource type ('image', 'video', 'raw', 'auto').
 * @param {string} [options.fileName] - Optional filename for Buffers/Blobs.
 * @returns {Promise<string>} The secure URL (`secure_url`) of the uploaded image.
 * @throws {DaitanConfigurationError} If configuration is missing or input type is invalid.
 * @throws {DaitanFileOperationError} If reading a local file fails.
 * @throws {DaitanApiError} If the Cloudinary API request fails.
 */
export const uploadImageToCloudinary = async (fileSource, options = {}) => {
  const configManager = getConfigManager(); // Lazy-load
  const callId = `cloudinaryUpload-${Date.now().toString(36)}`;
  logger.info(`[${callId}] Initiating image upload to Cloudinary.`, {
    fileSourceType: typeof fileSource,
    fileName: fileSource instanceof File ? fileSource.name : undefined,
  });

  const cloudName =
    options.cloudName || configManager.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = options.apiKey || configManager.get('CLOUDINARY_API_KEY');
  const uploadPreset =
    options.uploadPreset || configManager.get('CLOUDINARY_UPLOAD_PRESET');
  const apiSecret =
    options.apiSecret || configManager.get('CLOUDINARY_API_SECRET');

  if (!cloudName) {
    throw new DaitanConfigurationError(
      'Cloudinary cloud name (CLOUDINARY_CLOUD_NAME) is not configured.'
    );
  }
  if (!uploadPreset && !apiSecret) {
    logger.warn(
      `[${callId}] No upload_preset provided and no api_secret for signing. Cloudinary upload might fail.`
    );
  }
  if (!apiKey && !uploadPreset) {
    throw new DaitanConfigurationError(
      'Cloudinary needs either an upload_preset or an apiKey.'
    );
  }

  const formData = new FormData();
  if (apiKey) formData.append('api_key', apiKey);
  if (uploadPreset) formData.append('upload_preset', uploadPreset);
  if (options.folder) formData.append('folder', options.folder);
  if (options.publicId) formData.append('public_id', options.publicId);
  if (options.tags) formData.append('tags', options.tags);
  if (options.eager) formData.append('eager', options.eager);

  let fileDataForUpload;
  let inferredContentType = 'application/octet-stream';

  if (typeof fileSource === 'string') {
    if (fileSource.startsWith('data:')) {
      logger.debug(`[${callId}] Processing base64 data URL for Cloudinary.`);
      fileDataForUpload = fileSource;
    } else if (isValidURL(fileSource)) {
      logger.debug(
        `[${callId}] Using URL directly for Cloudinary upload: ${fileSource}`
      );
      fileDataForUpload = fileSource;
    } else {
      if (typeof window !== 'undefined') {
        throw new DaitanConfigurationError(
          'Local file paths for Cloudinary upload are not supported in browser environment.'
        );
      }
      const fs = await import('fs/promises');
      const pathUtil = await import('path');
      const mimeTypes = await import('mime-types');
      logger.debug(
        `[${callId}] Reading local file for Cloudinary upload: ${fileSource}`
      );
      try {
        const fileBuffer = await fs.readFile(fileSource);
        inferredContentType =
          mimeTypes.lookup(fileSource) || 'application/octet-stream';
        fileDataForUpload = fileBuffer;
        if (!options.fileName && pathUtil.basename(fileSource)) {
          formData.append('original_filename', pathUtil.basename(fileSource));
        }
        logger.debug(
          `[${callId}] Read local file into Buffer for Cloudinary. Content-Type: ${inferredContentType}`
        );
      } catch (error) {
        const errMsg = `Error reading local file "${fileSource}" for Cloudinary.`;
        logger.error(`[${callId}] ${errMsg}`, { errorMessage: error.message });
        throw new DaitanFileOperationError(
          `${errMsg}: ${error.message}`,
          { path: fileSource, operation: 'read' },
          error
        );
      }
    }
  } else if (fileSource instanceof Buffer && typeof window === 'undefined') {
    logger.debug(`[${callId}] Processing Buffer for Cloudinary upload.`);
    fileDataForUpload = fileSource;
    inferredContentType = options.contentType || 'application/octet-stream';
  } else if (typeof File !== 'undefined' && fileSource instanceof File) {
    logger.debug(`[${callId}] Processing File object for Cloudinary upload.`);
    fileDataForUpload = fileSource;
    inferredContentType =
      fileSource.type || options.contentType || 'application/octet-stream';
  } else if (typeof Blob !== 'undefined' && fileSource instanceof Blob) {
    logger.debug(`[${callId}] Processing Blob object for Cloudinary upload.`);
    fileDataForUpload = fileSource;
    inferredContentType =
      fileSource.type || options.contentType || 'application/octet-stream';
  } else {
    const errMsg = `Invalid fileSource type for Cloudinary: ${typeof fileSource}. Expected string, Buffer, File, or Blob.`;
    logger.error(`[${callId}] ${errMsg}`);
    throw new DaitanConfigurationError(errMsg);
  }

  formData.append('file', fileDataForUpload, {
    ...(options.fileName && { filename: options.fileName }),
    ...(inferredContentType && { contentType: inferredContentType }),
  });

  const resourceType = options.resourceType || 'image';
  const uploadUrl = `${CLOUDINARY_API_BASE_URL}/${cloudName}/${resourceType}/upload`;
  logger.info(`[${callId}] Posting to Cloudinary...`, {
    uploadUrl,
    resourceType,
  });

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      const errorMsg = `Cloudinary upload failed: ${
        result.error?.message ||
        response.statusText ||
        'Unknown Cloudinary error'
      }`;
      logger.error(
        `[${callId}] Cloudinary upload failed. Status: ${response.status}`,
        {
          statusText: response.statusText,
          cloudinaryError: result.error,
          responseBodyPreview: JSON.stringify(result).substring(0, 200),
        }
      );
      throw new DaitanApiError(errorMsg, 'Cloudinary Upload', response.status, {
        cloudinaryError: result.error,
      });
    }

    const imageUrl = result.secure_url || result.url;
    if (!imageUrl) {
      const errorMsg = 'Cloudinary response successful but missing image URL.';
      logger.error(`[${callId}] ${errorMsg}`, { result });
      throw new DaitanOperationError(errorMsg);
    }

    logger.info(`[${callId}] Image uploaded successfully to Cloudinary.`, {
      imageUrl,
      publicId: result.public_id,
      version: result.version,
    });
    return imageUrl;
  } catch (error) {
    const errorMsg = `Error during Cloudinary upload request or response processing: ${error.message}`;
    logger.error(`[${callId}] ${errorMsg}`);
    if (
      error instanceof DaitanApiError ||
      error instanceof DaitanOperationError ||
      error instanceof DaitanConfigurationError
    ) {
      throw error;
    }
    throw new DaitanOperationError(
      `Cloudinary upload process failed: ${error.message}`,
      { uploadUrl, fileSourcePreview: String(fileSource).substring(0, 70) },
      error
    );
  }
};
