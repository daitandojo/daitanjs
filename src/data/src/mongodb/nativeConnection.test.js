// src/data/src/mongodb/nativeConnection.test.js
import { MongoClient } from 'mongodb';
import {
  connectNativeClient,
  disconnectNativeClient,
  getGlobalNativeClient,
} from './nativeConnection.js';
import { checkNativeClientHealth, logDatabaseStructure } from './utils.js';
import {
  insertOne,
  findOne,
  findMany,
  updateOne,
  deleteOne,
  toObjectId,
} from './queries.js';
import { DaitanConfigurationError } from '@daitanjs/error';

// This test requires a running MongoDB instance.
// Set the connection URI in an environment variable (e.g., in a .env.test file loaded by Jest).
// Example: MONGO_URI_TEST=mongodb://localhost:27017/daitan_test_db
const TEST_MONGO_URI = process.env.MONGO_URI_TEST;
const TEST_DB_NAME = 'daitan_native_test_db';
const TEST_COLLECTION = 'test_items';

// Skip these tests if the test MongoDB URI is not provided.
const describeIfMongo = TEST_MONGO_URI ? describe : describe.skip;

describeIfMongo('MongoDB Native Driver Utilities', () => {
  let client;
  let db;
  let collection;

  // Establish connection once before all tests
  beforeAll(async () => {
    try {
      client = await connectNativeClient(TEST_MONGO_URI);
      db = client.db(TEST_DB_NAME);
      collection = db.collection(TEST_COLLECTION);
    } catch (e) {
      console.error(
        'CRITICAL: Could not connect to the test MongoDB instance. All native MongoDB tests will be skipped.',
        e
      );
    }
  });

  // Clean up the collection before each test
  beforeEach(async () => {
    if (collection) {
      await collection.deleteMany({});
    }
  });

  // Close the connection after all tests
  afterAll(async () => {
    if (client) {
      await disconnectNativeClient();
    }
  });

  describe('Connection Management', () => {
    it('should connect and return a MongoClient instance', () => {
      expect(client).toBeInstanceOf(MongoClient);
      expect(client.topology.isConnected()).toBe(true);
    });

    it('should return the same client instance on subsequent calls', async () => {
      const anotherClient = await connectNativeClient(TEST_MONGO_URI);
      expect(anotherClient).toBe(client);
    });

    it('getGlobalNativeClient should return the active client', () => {
      const globalClient = getGlobalNativeClient();
      expect(globalClient).toBe(client);
    });

    it('should perform a successful health check', async () => {
      const isHealthy = await checkNativeClientHealth(client);
      expect(isHealthy).toBe(true);
    });
  });

  describe('Query Helpers', () => {
    it('insertOne should add a document and return its ID', async () => {
      const doc = { name: 'Test Item', value: 100 };
      const insertedId = await insertOne({
        client,
        collectionName: TEST_COLLECTION,
        document: doc,
        dbName: TEST_DB_NAME,
      });

      expect(typeof insertedId).toBe('string');
      const found = await collection.findOne({ _id: toObjectId(insertedId) });
      expect(found).not.toBeNull();
      expect(found.name).toBe('Test Item');
    });

    it('findOne should retrieve a specific document', async () => {
      const doc = { name: 'FindMe', unique: true };
      await collection.insertOne(doc);

      const found = await findOne({
        client,
        collectionName: TEST_COLLECTION,
        query: { unique: true },
        dbName: TEST_DB_NAME,
      });
      expect(found).not.toBeNull();
      expect(found.name).toBe('FindMe');
    });

    it('findOne should return null if no document is found', async () => {
      const found = await findOne({
        client,
        collectionName: TEST_COLLECTION,
        query: { name: 'NotFound' },
        dbName: TEST_DB_NAME,
      });
      expect(found).toBeNull();
    });

    it('findMany should retrieve multiple documents', async () => {
      const docs = [
        { type: 'A', value: 1 },
        { type: 'B', value: 2 },
        { type: 'A', value: 3 },
      ];
      await collection.insertMany(docs);

      const results = await findMany({
        client,
        collectionName: TEST_COLLECTION,
        query: { type: 'A' },
        dbName: TEST_DB_NAME,
      });
      expect(results.length).toBe(2);
    });

    it('updateOne should modify a single document', async () => {
      const doc = { name: 'To Update', status: 'old' };
      const insertResult = await collection.insertOne(doc);
      const docId = insertResult.insertedId;

      const updateResult = await updateOne({
        client,
        collectionName: TEST_COLLECTION,
        filter: { _id: docId },
        update: { $set: { status: 'new' } },
        dbName: TEST_DB_NAME,
      });

      expect(updateResult.modifiedCount).toBe(1);
      const updatedDoc = await collection.findOne({ _id: docId });
      expect(updatedDoc.status).toBe('new');
    });

    it('deleteOne should remove a single document', async () => {
      const doc = { name: 'To Delete', temporary: true };
      await collection.insertOne(doc);

      const countBefore = await collection.countDocuments();
      expect(countBefore).toBe(1);

      const deleteResult = await deleteOne({
        client,
        collectionName: TEST_COLLECTION,
        filter: { temporary: true },
        dbName: TEST_DB_NAME,
      });
      expect(deleteResult.deletedCount).toBe(1);

      const countAfter = await collection.countDocuments();
      expect(countAfter).toBe(0);
    });
  });
});
