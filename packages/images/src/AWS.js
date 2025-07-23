// images/src/AWS.js
/**
 * @file AWS S3 image upload functionalities.
 * @module @daitanjs/images/AWS
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanFileOperationError,
  DaitanOperationError,
} from '@daitanjs/error';
import { query as apiQuery } from '@daitanjs/apiqueries'; // For fetching image from URL
import { Buffer } from 'buffer'; // Node.js Buffer, ensure available in environment

const logger = getLogger('daitan-images-aws-s3');

let s3ClientInstance = null;

/**
 * Initializes and returns the S3 client instance.
 * Caches the client instance for reuse.
 * @private
 * @returns {S3Client} The initialized S3Client instance.
 * @throws {DaitanConfigurationError} If AWS credentials or region are not configured.
 */
const getS3Client = () => {
  if (s3ClientInstance) {
    return s3ClientInstance;
  }

  const configManager = getConfigManager(); // Lazy-load
  const awsRegion = configManager.get('AWS_REGION');
  const awsAccessKeyId = configManager.get('AWS_ACCESS_KEY_ID');
  const awsSecretAccessKey = configManager.get('AWS_SECRET_ACCESS_KEY');

  if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) {
    const missing = [];
    if (!awsRegion) missing.push('AWS_REGION');
    if (!awsAccessKeyId) missing.push('AWS_ACCESS_KEY_ID');
    if (!awsSecretAccessKey) missing.push('AWS_SECRET_ACCESS_KEY');
    logger.error(
      `AWS S3 client configuration incomplete. Missing: ${missing.join(', ')}.`
    );
    throw new DaitanConfigurationError(
      `AWS S3 configuration is incomplete. Required environment variables: ${missing.join(
        ', '
      )}.`
    );
  }

  try {
    s3ClientInstance = new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });
    logger.info('AWS S3 client initialized successfully.');
    return s3ClientInstance;
  } catch (error) {
    logger.error('Failed to initialize AWS S3 client.', {
      errorMessage: error.message,
    });
    throw new DaitanConfigurationError(
      `Failed to initialize AWS S3 client: ${error.message}`,
      {},
      error
    );
  }
};

/**
 * Uploads an image file (from a URL or local file path) to AWS S3.
 *
 * @async
 * @public
 * @param {string} fileSource - URL of the image (http/https/blob) or local file path (Node.js only).
 * @param {object} [options={}] - Optional parameters for the upload.
 * @param {string} [options.bucketName] - S3 bucket name. Defaults to `S3_BUCKET_NAME` from ConfigManager.
 * @param {string} [options.s3KeyPrefix='uploads/'] - Prefix for the S3 object key (e.g., 'images/profiles/').
 * @param {string} [options.contentType] - Content type of the image (e.g., 'image/jpeg', 'image/png').
 *                                         If not provided, attempts to infer for local files or defaults to 'application/octet-stream'.
 * @param {string} [options.fileName] - Optional custom file name for the S3 object.
 *                                      If not provided, a name is generated (e.g., based on timestamp or source name).
 * @param {'private' | 'public-read' | 'authenticated-read'} [options.acl='private'] - S3 Canned ACL for the object.
 *        Ensure your bucket policy allows the specified ACL. 'private' is generally safest.
 * @returns {Promise<string>} The public URL of the uploaded image on S3 (format depends on region and bucket settings).
 * @throws {DaitanConfigurationError} If bucket name is missing or `fileSource` is a local path in browser.
 * @throws {DaitanFileOperationError} If fetching the image from a URL or reading a local file fails.
 * @throws {DaitanOperationError} If the S3 upload operation itself fails.
 */
export const uploadImageToAWS = async (fileSource, options = {}) => {
  const callId = `awsUpload-${Date.now().toString(36)}`;
  logger.info(`[${callId}] Initiating image upload to AWS S3.`, {
    fileSourcePreview: String(fileSource).substring(0, 70),
  });

  const configManager = getConfigManager(); // Lazy-load

  const s3Client = getS3Client();

  const bucketName = options.bucketName || configManager.get('S3_BUCKET_NAME');
  if (!bucketName) {
    logger.error(`[${callId}] S3_BUCKET_NAME is not configured.`);
    throw new DaitanConfigurationError(
      'S3 bucket name (S3_BUCKET_NAME) is not configured.'
    );
  }

  const s3KeyPrefix = options.s3KeyPrefix || 'uploads/';
  let { contentType, fileName } = options;
  const acl = options.acl || 'private';

  let imageBuffer;
  let resolvedFileName = fileName;

  try {
    if (
      fileSource.startsWith('http://') ||
      fileSource.startsWith('https://') ||
      fileSource.startsWith('blob:')
    ) {
      logger.debug(`[${callId}] Fetching image from URL: ${fileSource}`);
      const responseArrayBuffer = await apiQuery({
        url: fileSource,
        responseType: 'arraybuffer',
        summary: `Fetch image for AWS S3 upload: ${fileSource.substring(
          0,
          50
        )}`,
      });
      imageBuffer = Buffer.from(responseArrayBuffer); // Convert ArrayBuffer to Node.js Buffer
      if (!resolvedFileName) {
        try {
          const urlPath = new URL(fileSource).pathname;
          resolvedFileName = path.basename(urlPath) || `${Date.now()}.tmp`;
        } catch (e) {
          resolvedFileName = `${Date.now()}.tmp`;
        }
      }
      // ContentType might be available from response headers if apiQuery provided them, else user must set.
      // For now, relying on user-provided contentType or a default.
      contentType = contentType || 'application/octet-stream'; // Default if not provided for URL
    } else {
      // Assuming local file path (Node.js environment only)
      if (typeof window !== 'undefined') {
        throw new DaitanConfigurationError(
          'Local file uploads are not supported in browser environment for AWS upload. Provide a URL or use a browser-specific upload mechanism.'
        );
      }
      const fs = await import('fs/promises');
      const pathUtil = await import('path'); // For path.basename
      const mimeTypes = await import('mime-types'); // For content type inference

      logger.debug(`[${callId}] Reading image from local path: ${fileSource}`);
      imageBuffer = await fs.readFile(fileSource);
      if (!resolvedFileName) {
        resolvedFileName = pathUtil.basename(fileSource);
      }
      contentType =
        contentType ||
        mimeTypes.lookup(fileSource) ||
        'application/octet-stream';
    }
    logger.debug(
      `[${callId}] Image data processed. Buffer size: ${imageBuffer.length} bytes. Content-Type: ${contentType}`
    );
  } catch (error) {
    logger.error(`[${callId}] Error fetching/reading image source.`, {
      fileSource,
      errorMessage: error.message,
    });
    if (error instanceof DaitanConfigurationError) throw error;
    throw new DaitanFileOperationError(
      `Failed to fetch or read image from "${fileSource}": ${error.message}`,
      { path: fileSource, operation: 'read' },
      error
    );
  }

  const finalS3FileName =
    resolvedFileName || `${Date.now()}.${contentType.split('/')[1] || 'bin'}`;
  const s3ObjectKey = `${
    s3KeyPrefix.endsWith('/') ? s3KeyPrefix : s3KeyPrefix + '/'
  }${finalS3FileName}`;

  const params = {
    Bucket: bucketName,
    Key: s3ObjectKey,
    Body: imageBuffer,
    ContentType: contentType,
    ACL: acl,
  };

  logger.info(`[${callId}] Uploading to S3...`, {
    bucket: bucketName,
    key: s3ObjectKey,
    acl: acl,
  });
  try {
    const command = new PutObjectCommand(params);
    const s3Response = await s3Client.send(command);

    const awsRegion = configManager.get('AWS_REGION'); // Needed for URL construction
    // Standard S3 URL format (virtual-hosted style). Path-style might be needed for some regions/setups.
    // Bucket names with dots require path-style or specific handling for SSL certs.
    let location = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${s3ObjectKey}`;
    // If bucket name contains dots and is not SSL-accelerated or using a custom domain,
    // the path-style URL might be: `https://s3.${awsRegion}.amazonaws.com/${bucketName}/${s3ObjectKey}`
    // For simplicity, using virtual-hosted style.

    logger.info(`[${callId}] Image uploaded successfully to S3.`, {
      location,
      s3ResponseETag: s3Response.ETag,
      versionId: s3Response.VersionId,
    });
    return location;
  } catch (error) {
    logger.error(`[${callId}] Error uploading image to S3.`, {
      errorMessage: error.message,
      s3Params: {
        Bucket: params.Bucket,
        Key: params.Key,
        ContentType: params.ContentType,
      },
    });
    throw new DaitanOperationError(
      `Failed to upload image to S3: ${error.message}`,
      { bucket: bucketName, key: s3ObjectKey },
      error
    );
  }
};
