// images/src/firebase.js
/**
 * @file Firebase Storage image upload functionalities.
 * @module @daitanjs/images/firebase
 */
import {
  getStorage,
  ref,
  uploadString,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanFileOperationError,
  DaitanOperationError,
} from '@daitanjs/error';
import { query as apiQuery } from '@daitanjs/apiqueries';
import { Buffer } from 'buffer';
import path from 'path'; // For path.basename on URL and local paths
import { isValidURL } from '@daitanjs/validation'; // Use canonical validation helper

const logger = getLogger('daitan-images-firebase');

const DAITANJS_FIREBASE_IMAGES_APP_NAME = 'DAITANJS_IMAGES_STORAGE_APP';
let firebaseAppInstance = null;
let firebaseStorageInstance = null;
let firebaseInitializationAttempted = false;

/**
 * Initializes Firebase app and storage specifically for the @daitanjs/images package.
 * @private
 * @returns {{app: import('firebase/app').FirebaseApp, storage: import('firebase/storage').FirebaseStorage}}
 * @throws {DaitanConfigurationError} If Firebase configuration is missing or initialization fails.
 */
const getFirebaseServices = () => {
  const configManager = getConfigManager(); // Lazy-load
  if (firebaseAppInstance && firebaseStorageInstance) {
    return { app: firebaseAppInstance, storage: firebaseStorageInstance };
  }

  if (firebaseInitializationAttempted && !firebaseAppInstance) {
    throw new DaitanConfigurationError(
      'Firebase app for @daitanjs/images previously failed to initialize. Check logs and Firebase configuration.'
    );
  }
  firebaseInitializationAttempted = true;

  const firebaseConfig = {
    apiKey: configManager.get('FIREBASE_API_KEY'),
    authDomain: configManager.get('FIREBASE_AUTH_DOMAIN'),
    projectId: configManager.get('FIREBASE_PROJECT_ID'),
    storageBucket: configManager.get('FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: configManager.get('FIREBASE_MESSAGING_SENDER_ID'),
    appId: configManager.get('FIREBASE_APP_ID'),
    measurementId: configManager.get('FIREBASE_MEASUREMENT_ID'),
  };

  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket'];
  const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);

  if (missingKeys.length > 0) {
    const errMsg = `Firebase configuration for @daitanjs/images is incomplete. Missing keys: ${missingKeys.join(
      ', '
    )}`;
    logger.error(errMsg);
    throw new DaitanConfigurationError(errMsg);
  }

  try {
    const existingApps = getApps();
    const foundApp = existingApps.find(
      (app) => app.name === DAITANJS_FIREBASE_IMAGES_APP_NAME
    );

    if (foundApp) {
      logger.info(
        `Using existing Firebase app instance: ${DAITANJS_FIREBASE_IMAGES_APP_NAME}`
      );
      firebaseAppInstance = foundApp;
    } else {
      if (existingApps.length > 0) {
        logger.warn(
          `Other Firebase app(s) exist ([${existingApps
            .map((a) => a.name)
            .join(
              ', '
            )}]). Initializing new app "${DAITANJS_FIREBASE_IMAGES_APP_NAME}" for @daitanjs/images.`
        );
      }
      firebaseAppInstance = initializeApp(
        firebaseConfig,
        DAITANJS_FIREBASE_IMAGES_APP_NAME
      );
      logger.info(
        `Initialized new Firebase app for @daitanjs/images: ${DAITANJS_FIREBASE_IMAGES_APP_NAME}`
      );
    }

    firebaseStorageInstance = getStorage(firebaseAppInstance);
    logger.info(
      `Firebase Storage instance obtained for app: ${DAITANJS_FIREBASE_IMAGES_APP_NAME}`
    );
    return { app: firebaseAppInstance, storage: firebaseStorageInstance };
  } catch (error) {
    logger.error(
      `Failed to initialize Firebase services for @daitanjs/images: ${error.message}`,
      {
        firebaseConfigUsed: { ...firebaseConfig, apiKey: '***' },
        errorName: error.name,
      }
    );
    firebaseAppInstance = null;
    firebaseStorageInstance = null;
    throw new DaitanConfigurationError(
      `Firebase initialization for @daitanjs/images failed: ${error.message}`,
      {},
      error
    );
  }
};

/**
 * Uploads an image to Firebase Storage.
 *
 * @async
 * @public
 * @param {string | Buffer | File | Blob} fileSource - The image source.
 * @param {object} [options={}] - Optional parameters for the upload.
 * @param {string} [options.firebasePathPrefix='uploads/'] - Path prefix in Firebase Storage.
 * @param {string} [options.contentType] - Content type of the image.
 * @param {string} [options.fileName] - Optional custom file name for storage.
 * @returns {Promise<string>} The public download URL of the uploaded image.
 * @throws {DaitanConfigurationError|DaitanFileOperationError|DaitanOperationError}
 */
export const uploadImageToFirebase = async (fileSource, options = {}) => {
  const callId = `firebaseUpload-${Date.now().toString(36)}`;
  logger.info(`[${callId}] Initiating image upload to Firebase Storage.`, {
    fileSourceType: typeof fileSource,
    fileNameOption: options.fileName,
  });

  const { storage } = getFirebaseServices();

  const firebasePathPrefix = options.firebasePathPrefix || 'uploads/';
  let { contentType, fileName: inputFileName } = options;
  let resolvedFileName = inputFileName;

  try {
    let uploadPromise;
    let finalStorageRef;

    if (typeof fileSource === 'string') {
      if (fileSource.startsWith('data:')) {
        logger.debug(`[${callId}] Processing base64 data URL for Firebase.`);
        const parts = fileSource.match(/^data:(.+?);base64,(.+)$/);
        if (!parts || parts.length !== 3) {
          throw new DaitanConfigurationError('Invalid base64 data URL format.');
        }
        const detectedContentType = parts[1];
        const base64Data = parts[2];
        contentType = contentType || detectedContentType;
        if (!resolvedFileName)
          resolvedFileName = `${Date.now()}.${
            contentType.split('/')[1] || 'bin'
          }`;
        const finalStoragePath = `${
          firebasePathPrefix.endsWith('/')
            ? firebasePathPrefix
            : firebasePathPrefix + '/'
        }${resolvedFileName}`;
        finalStorageRef = ref(storage, finalStoragePath);
        uploadPromise = uploadString(finalStorageRef, base64Data, 'base64', {
          contentType,
        });
      } else if (isValidURL(fileSource)) {
        logger.debug(
          `[${callId}] Fetching image from URL for Firebase: ${fileSource}`
        );
        const imageArrayBuffer = await apiQuery({
          url: fileSource,
          responseType: 'arraybuffer',
          summary: `Fetch image for Firebase: ${fileSource.substring(0, 50)}`,
        });
        if (!resolvedFileName) {
          try {
            resolvedFileName =
              path.basename(new URL(fileSource).pathname) ||
              `${Date.now()}.tmp`;
          } catch (e) {
            resolvedFileName = `${Date.now()}.tmp`;
          }
        }
        contentType = contentType || 'application/octet-stream';
        const finalStoragePath = `${
          firebasePathPrefix.endsWith('/')
            ? firebasePathPrefix
            : firebasePathPrefix + '/'
        }${resolvedFileName}`;
        finalStorageRef = ref(storage, finalStoragePath);
        uploadPromise = uploadBytes(finalStorageRef, imageArrayBuffer, {
          contentType,
        });
      } else {
        if (typeof window !== 'undefined') {
          throw new DaitanConfigurationError(
            'Local file paths for Firebase upload not supported in browser.'
          );
        }
        const fs = await import('fs/promises');
        const mimeTypes = await import('mime-types');
        logger.debug(
          `[${callId}] Reading local file for Firebase: ${fileSource}`
        );
        const fileBuffer = await fs.readFile(fileSource);
        const arrayBuffer = fileBuffer.buffer.slice(
          fileBuffer.byteOffset,
          fileBuffer.byteOffset + fileBuffer.byteLength
        );
        if (!resolvedFileName) resolvedFileName = path.basename(fileSource);
        contentType =
          contentType ||
          mimeTypes.lookup(fileSource) ||
          'application/octet-stream';
        const finalStoragePath = `${
          firebasePathPrefix.endsWith('/')
            ? firebasePathPrefix
            : firebasePathPrefix + '/'
        }${resolvedFileName}`;
        finalStorageRef = ref(storage, finalStoragePath);
        uploadPromise = uploadBytes(finalStorageRef, arrayBuffer, {
          contentType,
        });
      }
    } else if (fileSource instanceof Buffer && typeof window === 'undefined') {
      logger.debug(`[${callId}] Uploading Buffer object to Firebase.`);
      const arrayBuffer = fileSource.buffer.slice(
        fileSource.byteOffset,
        fileSource.byteOffset + fileSource.byteLength
      );
      if (!resolvedFileName) resolvedFileName = `${Date.now()}.bin`;
      contentType = contentType || 'application/octet-stream';
      const finalStoragePath = `${
        firebasePathPrefix.endsWith('/')
          ? firebasePathPrefix
          : firebasePathPrefix + '/'
      }${resolvedFileName}`;
      finalStorageRef = ref(storage, finalStoragePath);
      uploadPromise = uploadBytes(finalStorageRef, arrayBuffer, {
        contentType,
      });
    } else if (
      (typeof File !== 'undefined' && fileSource instanceof File) ||
      (typeof Blob !== 'undefined' && fileSource instanceof Blob)
    ) {
      logger.debug(`[${callId}] Uploading File/Blob object to Firebase.`);
      if (!resolvedFileName && fileSource.name)
        resolvedFileName = fileSource.name;
      else if (!resolvedFileName) resolvedFileName = `${Date.now()}.bin`;
      contentType =
        contentType || fileSource.type || 'application/octet-stream';
      const finalStoragePath = `${
        firebasePathPrefix.endsWith('/')
          ? firebasePathPrefix
          : firebasePathPrefix + '/'
      }${resolvedFileName}`;
      finalStorageRef = ref(storage, finalStoragePath);
      uploadPromise = uploadBytes(finalStorageRef, fileSource, { contentType });
    } else {
      throw new DaitanConfigurationError(
        `Invalid fileSource type for Firebase: ${typeof fileSource}. Expected string, Buffer, File, or Blob.`
      );
    }

    const uploadResult = await uploadPromise;
    const resultRef = uploadResult.ref;

    logger.info(
      `[${callId}] Image uploaded to Firebase Storage ref: ${resultRef.fullPath}. Fetching download URL...`
    );
    const downloadURL = await getDownloadURL(resultRef);
    logger.info(
      `[${callId}] Firebase upload successful. Download URL: ${downloadURL}`
    );
    return downloadURL;
  } catch (error) {
    logger.error(`[${callId}] Error during Firebase Storage upload.`, {
      errorMessage: error.message,
      errorCode: error.code,
      errorName: error.name,
    });
    if (
      error instanceof DaitanConfigurationError ||
      error instanceof DaitanFileOperationError
    ) {
      throw error;
    }
    throw new DaitanOperationError(
      `Firebase Storage upload failed: ${error.message} (Code: ${
        error.code || 'N/A'
      })`,
      { storagePath: inputFileName, firebaseErrorCode: error.code },
      error
    );
  }
};

/**
 * Deletes the Firebase app instance specifically created by this module.
 * @async
 * @public
 * @returns {Promise<void>}
 */
export const deleteImagesFirebaseApp = async () => {
  if (firebaseAppInstance) {
    const appName = firebaseAppInstance.name;
    try {
      await deleteApp(firebaseAppInstance);
      logger.info(
        `Firebase app "${appName}" used by @daitanjs/images has been deleted.`
      );
    } catch (error) {
      logger.error(
        `Error deleting Firebase app "${appName}": ${error.message}`
      );
    } finally {
      firebaseAppInstance = null;
      firebaseStorageInstance = null;
      firebaseInitializationAttempted = false;
    }
  } else {
    logger.info(
      'No @daitanjs/images specific Firebase app instance was active to delete.'
    );
    firebaseInitializationAttempted = false;
  }
};
