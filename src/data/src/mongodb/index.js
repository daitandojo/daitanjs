import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { MongoClient } from 'mongodb';

dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });
const MONGO_URI = process.env.MONGO_URI;

let client = null; 

export async function connectToDatabase(url = MONGO_URI) {
  console.log('Connect function called');
  if (mongoose.connection.readyState === 1) {
    console.log('Using existing MongoDB connection.');
    return mongoose.connection;
  }
  try {
    console.log(`Connecting to MongoDB at ${url}...`);
    await mongoose.connect(url, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 60000,
    });
    console.log('Connection established, checking readyState...');
    console.log('Mongoose connection state:', mongoose.connection.readyState);
    console.log('Successfully connected to MongoDB.');

    // Initialize MongoClient for raw operations
    client = new MongoClient(url);
    await client.connect();

    return mongoose.connection;
  } catch (error) {
    console.error('Detailed error connecting to MongoDB:', error);
    throw error;
  }
}

export async function disconnect() {
  if (mongoose.connection.readyState !== 0) {
    try {
      console.log('Disconnecting from MongoDB...');
      await mongoose.disconnect();
      if (client) {
        await client.close();
      }
      console.log('Successfully disconnected from MongoDB.');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
    }
  } else {
    console.log('No active MongoDB connection to disconnect.');
  }
}

export async function query(sql, params = []) {
  if (!client) {
    throw new Error('MongoDB client not initialized. Call connect() first.');
  }
  try {
    const db = client.db();
    const result = await db.command({ eval: sql, args: params });
    return result.retval;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

export async function insertOne(collection, document) {
  if (!client) {
    throw new Error('MongoDB client not initialized. Call connect() first.');
  }
  try {
    const db = client.db();
    const result = await db.collection(collection).insertOne(document);
    return result.insertedId.toString();
  } catch (error) {
    console.error('Error inserting document:', error);
    throw error;
  }
}

export async function findOne(collection, query = {}) {
  if (!client) {
    throw new Error('MongoDB client not initialized. Call connect() first.');
  }
  try {
    const db = client.db();
    return await db.collection(collection).findOne(query);
  } catch (error) {
    console.error('Error finding document:', error);
    throw error;
  }
}

export async function findMany(collection, query = {}) {
  if (!client) {
    throw new Error('MongoDB client not initialized. Call connect() first.');
  }
  try {
    const db = client.db();
    return await db.collection(collection).find(query).toArray();
  } catch (error) {
    console.error('Error finding documents:', error);
    throw error;
  }
}

export async function updateOne(collection, query, update, options = {}) {
  if (!client) {
    throw new Error('MongoDB client not initialized. Call connect() first.');
  }
  try {
    const db = client.db();
    return await db.collection(collection).updateOne(query, update, options);
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
}

export async function findOneAndUpdate(collection, query, update, options = {}) {
  if (!client) {
    throw new Error('MongoDB client not initialized. Call connect() first.');
  }
  try {
    const db = client.db();
    return await db.collection(collection).findOneAndUpdate(query, update, options);
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
}

export async function deleteOne(collection, query) {
  if (!client) {
    throw new Error('MongoDB client not initialized. Call connect() first.');
  }
  try {
    const db = client.db();
    await db.collection(collection).deleteOne(query);
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
}
export async function deleteMany(collection, query) {
  if (!client) {
    throw new Error('MongoDB client not initialized. Call connect() first.');
  }
  try {
    const db = client.db();
    const result = await db.collection(collection).deleteMany(query);
    return result; // Return the result to get information about the deleted documents
  } catch (error) {
    console.error('Error deleting documents:', error);
    throw error;
  }
};

export async function logDatabaseStructure(config = null) {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Database Structure:');
    for (const collection of collections) {
      const name = collection.name;
      const count = await db.collection(name).countDocuments();
      console.log(`Collection: ${name}, Size: ${count} documents`);
      // Log sample documents for insight
      const sampleDocs = await db.collection(name).find().limit(3).toArray();
      console.log(`Sample documents from ${name}:`, sampleDocs);
    }
    // Optional: log model schemas
    if (config && config.models && config.models.length > 0) {
      console.log('Model Schemas:');
      config.models.forEach(model => {
        console.log(`Model: ${model.modelName}`);
        console.log(model.schema.paths);
      });
    }
  } catch (error) {
    console.error('Error logging database structure:', error);
  }
}
