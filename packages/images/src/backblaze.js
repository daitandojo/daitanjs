// images/src/backblaze.js
/**
 * @file Backblaze B2 image upload functionalities.
 * @module @daitanjs/images/backblaze
 */
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanApiError,
  DaitanFileOperationError,
  DaitanOperationError,
} from '@daitanjs/error';
import { query as apiQuery } from '@daitanjs/apiqueries';
import { Buffer } from 'buffer'; // Node.js Buffer
import crypto from 'crypto'; // For SHA1 hash, if enabled
import path from 'path'; // For path operations

const logger = getLogger('daitan-images-backblaze-b2');

const B2_API_VERSION = 'v2'; // Use B2 API v2
let b2AuthDataCache = null; // Cache for { apiUrl, authorizationToken, downloadUrl, recommendedPartSize, absoluteMinimumPartSize, accountId }

/**
 * Authorizes with Backblaze B2 API.
 * Caches authorization details to avoid repeated calls.
 * The cached token is typically valid for 24 hours.
 * @private
 * @param {string} callId - For logging context.
 * @returns {Promise<object>} B2 authorization data.
 * @throws {DaitanConfigurationError} If B2 credentials are not configured.
 * @throws {DaitanApiError} If authorization API call fails.
 */
const getB2Authorization = async (callId) => {
  const now = Date.now();
  if (
    b2AuthDataCache &&
    b2AuthDataCache.authorizationToken &&
    b2AuthDataCache.expiresAt &&
    b2AuthDataCache.expiresAt > now + 5 * 60 * 1000
  ) {
    logger.debug(
      `[${callId}] Using cached B2 authorization. Expires at: ${new Date(
        b2AuthDataCache.expiresAt
      ).toISOString()}`,
      {
        apiUrl: b2AuthDataCache.apiUrl,
      }
    );
    return b2AuthDataCache;
  }
  logger.info(
    `[${callId}] Requesting new B2 authorization (or cache expired/invalid)...`
  );

  const configManager = getConfigManager(); // Lazy-load
  const keyId = configManager.get('B2_KEY_ID');
  const applicationKey = configManager.get('B2_APPLICATION_KEY');

  if (!keyId || !applicationKey) {
    const errorMsg = `Backblaze B2 credentials (B2_KEY_ID, B2_APPLICATION_KEY) not configured.`;
    logger.error(`[${callId}] ${errorMsg}`);
    throw new DaitanConfigurationError(errorMsg);
  }

  const credentials = Buffer.from(`${keyId}:${applicationKey}`).toString(
    'base64'
  );
  const authUrl = `https://api.backblazeb2.com/b2api/${B2_API_VERSION}/b2_authorize_account`;

  try {
    const response = await apiQuery({
      url: authUrl,
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        'User-Agent': 'DaitanJS/ImagesClient/1.0',
      },
      responseType: 'json',
      summary: 'B2 Authorize Account',
    });

    b2AuthDataCache = {
      ...response,
      expiresAt: now + 23 * 60 * 60 * 1000,
    };
    logger.info(
      `[${callId}] B2 authorization successful. Token will be cached.`,
      {
        apiUrl: b2AuthDataCache.apiUrl,
        accountId: b2AuthDataCache.accountId,
      }
    );
    return b2AuthDataCache;
  } catch (error) {
    b2AuthDataCache = null;
    logger.error(
      `[${callId}] Error during B2 authorization: ${error.message}`,
      { errorName: error.name, errorDetails: error.details }
    );
    if (error instanceof DaitanApiError) throw error;
    throw new DaitanOperationError(
      `B2 authorization request processing failed: ${error.message}`,
      {},
      error
    );
  }
};

/**
 * Gets the upload URL from Backblaze B2 for a specific bucket.
 * @private
 * @param {object} auth - B2 authorization data from `getB2Authorization`.
 * @param {string} bucketId - The B2 bucket ID.
 * @param {string} callId - For logging context.
 * @returns {Promise<{uploadUrl: string, authorizationToken: string}>} B2 upload URL data.
 * @throws {DaitanApiError} If getting upload URL fails.
 */
const getB2UploadUrl = async (auth, bucketId, callId) => {
  logger.info(
    `[${callId}] Requesting B2 upload URL for bucket ID: ${bucketId}`
  );
  if (!auth || !auth.apiUrl || !auth.authorizationToken) {
    throw new DaitanConfigurationError(
      'Invalid B2 auth data provided to getB2UploadUrl.'
    );
  }
  const uploadUrlRequestUrl = `${auth.apiUrl}/b2api/${B2_API_VERSION}/b2_get_upload_url`;

  try {
    const response = await apiQuery({
      url: uploadUrlRequestUrl,
      method: 'POST',
      headers: {
        Authorization: auth.authorizationToken,
      },
      data: { bucketId },
      responseType: 'json',
      summary: `B2 Get Upload URL for bucket ${bucketId}`,
    });

    if (!response.uploadUrl || !response.authorizationToken) {
      throw new DaitanApiError(
        'B2 get_upload_url response missing uploadUrl or authorizationToken.',
        'Backblaze B2 GetUploadUrl',
        undefined,
        { responseData: response }
      );
    }
    logger.info(`[${callId}] B2 upload URL received successfully.`);
    return {
      uploadUrl: response.uploadUrl,
      authorizationToken: response.authorizationToken,
    };
  } catch (error) {
    logger.error(`[${callId}] Error getting B2 upload URL: ${error.message}`, {
      bucketId,
      errorName: error.name,
      errorDetails: error.details,
    });
    if (error instanceof DaitanApiError) throw error;
    throw new DaitanOperationError(
      `B2 get_upload_url request processing failed: ${error.message}`,
      {},
      error
    );
  }
};

/**
 * Uploads an image file (from a URL or local file path) to Backblaze B2.
 *
 * @async
 * @public
 * @param {string} fileSource - URL of the image (http/https/blob) or local file path (Node.js only).
 * @param {object} [options={}] - Optional parameters for the upload.
 * @param {string} [options.bucketId] - B2 Bucket ID. Defaults to `B2_BUCKET_ID` from ConfigManager.
 * @param {string} [options.b2KeyPrefix='uploads/'] - Prefix for the B2 file name/key (e.g., 'images/gallery/').
 * @param {string} [options.contentType] - Content type of the image (e.g., 'image/jpeg').
 * @param {string} [options.fileName] - Optional custom file name. If not provided, a name is generated.
 * @param {boolean} [options.calculateSha1=false] - Whether to calculate and send SHA1 hash of the file.
 * @returns {Promise<string>} The public URL of the uploaded image on B2.
 * @throws {DaitanConfigurationError} If B2 credentials or bucket ID are missing, or `fileSource` is a local path in browser.
 * @throws {DaitanFileOperationError} If fetching the image from a URL or reading a local file fails.
 * @throws {DaitanApiError} If any B2 API calls fail.
 * @throws {DaitanOperationError} For other unexpected errors.
 */
export const uploadImageToB2 = async (fileSource, options = {}) => {
  const callId = `b2Upload-${Date.now().toString(36)}`;
  logger.info(`[${callId}] Initiating image upload to Backblaze B2.`, {
    fileSourcePreview: String(fileSource).substring(0, 70),
  });

  const configManager = getConfigManager(); // Lazy-load

  const authData = await getB2Authorization(callId);

  const bucketId = options.bucketId || configManager.get('B2_BUCKET_ID');
  if (!bucketId) {
    const errorMsg = 'B2_BUCKET_ID is not configured.';
    logger.error(`[${callId}] ${errorMsg}`);
    throw new DaitanConfigurationError(errorMsg);
  }

  const b2KeyPrefix = options.b2KeyPrefix || 'uploads/';
  let { contentType, fileName } = options;
  const calculateSha1 = options.calculateSha1 || false;
  let resolvedFileName = fileName;

  let imageArrayBuffer;
  try {
    if (
      fileSource.startsWith('http://') ||
      fileSource.startsWith('https://') ||
      fileSource.startsWith('blob:')
    ) {
      logger.debug(`[${callId}] Fetching image from URL for B2: ${fileSource}`);
      imageArrayBuffer = await apiQuery({
        url: fileSource,
        responseType: 'arraybuffer',
        summary: `Fetch image for B2 upload: ${fileSource.substring(0, 50)}`,
      });
      if (!resolvedFileName) {
        try {
          const urlPath = new URL(fileSource).pathname;
          resolvedFileName = path.basename(urlPath) || `${Date.now()}.tmp`;
        } catch (e) {
          resolvedFileName = `${Date.now()}.tmp`;
        }
      }
      contentType = contentType || 'application/octet-stream';
    } else {
      if (typeof window !== 'undefined') {
        throw new DaitanConfigurationError(
          'Local file uploads for B2 are not supported in browser environment. Provide a URL or use a browser-specific mechanism.'
        );
      }
      const fs = await import('fs/promises');
      const mimeTypes = await import('mime-types');

      logger.debug(
        `[${callId}] Reading image from local path for B2: ${fileSource}`
      );
      const fileBuffer = await fs.readFile(fileSource);
      imageArrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      );
      if (!resolvedFileName) {
        resolvedFileName = path.basename(fileSource);
      }
      contentType =
        contentType ||
        mimeTypes.lookup(fileSource) ||
        'application/octet-stream';
    }
    logger.debug(
      `[${callId}] Image data processed for B2. ArrayBuffer size: ${imageArrayBuffer.byteLength} bytes. Content-Type: ${contentType}`
    );
  } catch (error) {
    logger.error(`[${callId}] Error fetching/reading image source for B2.`, {
      fileSource,
      errorMessage: error.message,
    });
    if (
      error instanceof DaitanApiError ||
      error instanceof DaitanConfigurationError
    )
      throw error;
    throw new DaitanFileOperationError(
      `Failed to fetch or read image from "${fileSource}" for B2: ${error.message}`,
      { path: fileSource, operation: 'read' },
      error
    );
  }

  const finalB2FileName = `${
    b2KeyPrefix.endsWith('/') ? b2KeyPrefix : b2KeyPrefix + '/'
  }${
    resolvedFileName || Date.now() + '.' + (contentType.split('/')[1] || 'bin')
  }`;
  const uploadUrlData = await getB2UploadUrl(authData, bucketId, callId);

  const uploadHeaders = {
    Authorization: uploadUrlData.authorizationToken,
    'X-Bz-File-Name': encodeURIComponent(finalB2FileName),
    'Content-Type': contentType,
    'Content-Length': imageArrayBuffer.byteLength.toString(),
  };

  if (calculateSha1) {
    const hash = crypto.createHash('sha1');
    hash.update(Buffer.from(imageArrayBuffer));
    uploadHeaders['X-Bz-Content-Sha1'] = hash.digest('hex');
  } else {
    uploadHeaders['X-Bz-Content-Sha1'] = 'do_not_verify';
  }

  logger.info(`[${callId}] Uploading to B2...`, {
    uploadUrl: uploadUrlData.uploadUrl,
    fileName: finalB2FileName,
    contentLength: imageArrayBuffer.byteLength,
    sha1Header: uploadHeaders['X-Bz-Content-Sha1'],
  });

  try {
    const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
      method: 'POST',
      headers: uploadHeaders,
      body: imageArrayBuffer,
    });

    const responseText = await uploadResponse.text();
    let uploadResultData;
    try {
      uploadResultData = JSON.parse(responseText);
    } catch (e) {
      logger.error(
        `[${callId}] B2 upload - Non-JSON response. Status: ${uploadResponse.status}`,
        {
          statusText: uploadResponse.statusText,
          responsePreview: responseText.substring(0, 500),
        }
      );
      throw new DaitanApiError(
        `B2 upload failed: Unexpected non-JSON response (Status ${
          uploadResponse.status
        }). Preview: ${responseText.substring(0, 100)}`,
        'Backblaze B2 Upload',
        uploadResponse.status,
        { responseData: responseText }
      );
    }

    if (!uploadResponse.ok || uploadResultData.code) {
      logger.error(
        `[${callId}] Failed to upload image to B2. Status: ${uploadResponse.status}`,
        { statusText: uploadResponse.statusText, b2Error: uploadResultData }
      );
      throw new DaitanApiError(
        `Failed to upload image to B2: ${
          uploadResultData.message || uploadResultData.code || responseText
        }`,
        'Backblaze B2 Upload',
        uploadResponse.status,
        { responseData: uploadResultData }
      );
    }

    const bucketNameForUrl =
      configManager.get('B2_BUCKET_NAME_FOR_URL') || bucketId;
    const location = `${
      authData.downloadUrl
    }/file/${bucketNameForUrl}/${encodeURIComponent(finalB2FileName)}`;

    logger.info(`[${callId}] Image uploaded successfully to B2.`, {
      location,
      b2FileId: uploadResultData.fileId,
      b2FileName: uploadResultData.fileName,
    });
    return location;
  } catch (error) {
    logger.error(
      `[${callId}] Error during B2 upload HTTP request: ${error.message}`,
      { fileName: finalB2FileName, errorName: error.name }
    );
    if (
      error instanceof DaitanApiError ||
      error instanceof DaitanOperationError
    )
      throw error;
    throw new DaitanOperationError(
      `B2 upload request processing failed: ${error.message}`,
      { fileName: finalB2FileName },
      error
    );
  }
};
