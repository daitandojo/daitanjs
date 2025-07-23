// data/src/models/company.js
/**
 * @file Mongoose schema definition for the Company model.
 * @module @daitanjs/data/models/company
 */
import mongoose from 'mongoose';

const Schema = mongoose.Schema;
const modelName = 'Company';

const CompanySchema = new Schema(
  {
    href: {
      type: String,
      trim: true,
    },
    originalHref: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
      required: [true, 'Company name is required.'],
    },
    director: {
      type: String,
      trim: true,
      default: 'N/A',
    },
    directorName: {
      type: String,
      trim: true,
      default: 'N/A',
    },
    cvrNumber: {
      type: String,
      trim: true,
      default: 'N/A',
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: 'N/A',
    },
    address: {
      type: String,
      trim: true,
      default: 'N/A',
    },
    balanceSheet: {
      type: Number,
    },
    motherLink: {
      type: String,
      trim: true,
      default: null,
    },
    coordinates: {
      // For geolocation [longitude, latitude]
      type: [Number], // Array of numbers
      // A 2dsphere index is applied below for geospatial queries
    },
    // --- Additional suggested fields for a more robust model ---
    website: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    industry: { type: String, trim: true, index: true },
    foundedDate: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    tags: [{ type: String, trim: true, lowercase: true }],
  },
  {
    collection: 'companies', // Explicit collection name
    strict: false, // Allows storing fields not explicitly defined in the schema
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

// --- Indexes ---
// Define all indexes in one place for clarity and to avoid redundancy.
// 1. Unique index on companyName. This is a common lookup and should be fast and unique.
CompanySchema.index({ companyName: 1 }, { unique: true });

// 2. A sparse unique index on cvrNumber. It only enforces uniqueness for documents that HAVE this field.
CompanySchema.index({ cvrNumber: 1 }, { unique: true, sparse: true });

// 3. Geospatial index for location-based queries.
CompanySchema.index({ coordinates: '2dsphere' }, { sparse: true });

// Idempotent model registration
export default mongoose.models[modelName] ||
  mongoose.model(modelName, CompanySchema);
