import admin from 'firebase-admin';

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  INTERNAL_SERVER_ERROR: 500,
};

// List of required environment variables
const requiredEnvVars = [
  'FIREBASE_TYPE',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_AUTH_URI',
  'FIREBASE_TOKEN_URI',
  'FIREBASE_AUTH_PROVIDER_CERT_URL',
  'FIREBASE_CLIENT_CERT_URL',
];

// Validate required environment variables
for (const varName of requiredEnvVars) {
  if (!process.env[varName] || process.env[varName].trim() === '') {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}

// Safely parse the private key
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (!privateKey || !privateKey.includes('BEGIN PRIVATE KEY')) {
  throw new Error('FIREBASE_PRIVATE_KEY is missing or invalid');
}
privateKey = privateKey.replace(/\\n/g, '\n');

// Firebase service account configuration
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: privateKey,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
};

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || undefined, // Optional
    });
    console.info('[Firebase] Admin SDK initialized successfully.');
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize Admin SDK:', error.message);
  throw new Error('Failed to initialize Firebase Admin SDK');
}

const auth = admin.auth();

export { auth };
