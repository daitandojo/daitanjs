// src/authentication/src/firebaseAdmin.js (version 1.01)
import admin from 'firebase-admin';
import { getLogger, getRequiredEnvVariable, getOptionalEnvVariable } from '@daitanjs/development';
import { DaitanError, DaitanConfigurationError, DaitanOperationError } from '@daitanjs/error';
import crypto from 'crypto';

const firebaseAdminLogger = getLogger('daitan-auth-firebase-admin');

class FirebaseAdminManager {
  constructor() {
    this.appInstance = null;
    this.authInstance = null;
    this.lock = Promise.resolve();
    this.isInitializing = false;
    this.healthCheckInterval = null;
    this.appName = 'DAITANJS_AUTH_FIREBASE_ADMIN_APP';
  }

  async acquireLock() {
    while (this.isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.isInitializing = true;
  }

  releaseLock() {
    this.isInitializing = false;
  }

  async initialize() {
    await this.acquireLock();
    
    try {
      if (this.appInstance && this.authInstance) {
        firebaseAdminLogger.debug('Firebase Admin already initialized');
        return this.appInstance;
      }

      firebaseAdminLogger.info(`Initializing Firebase Admin for app: ${this.appName}`);
      
      const projectId = getRequiredEnvVariable('FIREBASE_PROJECT_ID', 'string', 'Firebase Project ID');
      const clientEmail = getRequiredEnvVariable('FIREBASE_ADMIN_CLIENT_EMAIL', 'string', 'Firebase Admin Client Email');
      const privateKey = this.sanitizePrivateKey(
        getRequiredEnvVariable('FIREBASE_ADMIN_PRIVATE_KEY', 'string', 'Firebase Admin Private Key')
      );
      
      const serviceAccount = {
        type: 'service_account',
        project_id: projectId,
        private_key_id: getOptionalEnvVariable('FIREBASE_ADMIN_PRIVATE_KEY_ID'),
        private_key: privateKey,
        client_email: clientEmail,
        client_id: getOptionalEnvVariable('FIREBASE_ADMIN_CLIENT_ID'),
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`
      };

      const existingApp = admin.apps.find(app => app && app.name === this.appName);
      
      if (existingApp) {
        firebaseAdminLogger.info(`Reusing existing Firebase app: ${this.appName}`);
        this.appInstance = existingApp;
      } else {
        this.appInstance = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          httpAgent: {
            keepAlive: true,
            maxSockets: 50
          }
        }, this.appName);
        firebaseAdminLogger.info(`Created new Firebase app: ${this.appName}`);
      }

      this.authInstance = this.appInstance.auth();
      this.startHealthCheck();
      
      return this.appInstance;
    } catch (error) {
      firebaseAdminLogger.error('Firebase Admin initialization failed', {
        error: error.message,
        stack: error.stack
      });
      throw new DaitanConfigurationError(
        `Firebase Admin initialization failed: ${error.message}`
      );
    } finally {
      this.releaseLock();
    }
  }

  sanitizePrivateKey(key) {
    if (!key) return key;
    return key.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
  }

  startHealthCheck() {
    if (this.healthCheckInterval) return;
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.authInstance?.listUsers(1);
        firebaseAdminLogger.debug('Firebase Admin health check passed');
      } catch (error) {
        firebaseAdminLogger.error('Firebase Admin health check failed', {
          error: error.message
        });
      }
    }, 30000); // Check every 30 seconds
  }

  getAuth() {
    if (!this.authInstance) {
      throw new DaitanOperationError(
        'Firebase Admin Auth not initialized. Call initialize() first.'
      );
    }
    return this.authInstance;
  }

  getApp() {
    if (!this.appInstance) {
      throw new DaitanOperationError(
        'Firebase Admin App not initialized. Call initialize() first.'
      );
    }
    return this.appInstance;
  }

  async shutdown() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.appInstance) {
      await this.appInstance.delete();
      this.appInstance = null;
      this.authInstance = null;
      firebaseAdminLogger.info('Firebase Admin shutdown complete');
    }
  }
}

const firebaseManager = new FirebaseAdminManager();

export const getFirebaseAdminAuth = async () => {
  await firebaseManager.initialize();
  return firebaseManager.getAuth();
};

export const getFirebaseAdminApp = async () => {
  await firebaseManager.initialize();
  return firebaseManager.getApp();
};

export const auth = {
  get value() {
    if (!firebaseManager.authInstance) {
      throw new DaitanOperationError(
        'Firebase Admin Auth not initialized. Use getFirebaseAdminAuth() for async access.'
      );
    }
    return firebaseManager.authInstance;
  }
};

export const adminApp = {
  get value() {
    if (!firebaseManager.appInstance) {
      throw new DaitanOperationError(
        'Firebase Admin App not initialized. Use getFirebaseAdminApp() for async access.'
      );
    }
    return firebaseManager.appInstance;
  }
};

export const verifyAdminAuthConnection = async () => {
  try {
    const auth = await getFirebaseAdminAuth();
    await auth.listUsers(1);
    return true;
  } catch (error) {
    firebaseAdminLogger.error('Connection verification failed', { error: error.message });
    return false;
  }
};

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  await firebaseManager.shutdown();
});

process.on('SIGINT', async () => {
  await firebaseManager.shutdown();
});