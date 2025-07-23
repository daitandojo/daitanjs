// data/src/models/transaction.js
/**
 * @file Mongoose schema definition for the Transaction model.
 * @module @daitanjs/data/models/transaction
 */
import mongoose from 'mongoose';

const Schema = mongoose.Schema;
const modelName = 'Transaction';

const TransactionSchema = new Schema(
  {
    partyId: {
      type: Schema.Types.ObjectId,
      required: [
        true,
        'Party (User or Provider) ID is required for a transaction.',
      ],
      refPath: 'partyModel',
      index: true, // This index is fine as it's part of a compound index below
    },
    partyModel: {
      type: String,
      required: true,
      enum: ['User', 'Provider'],
    },
    request: {
      type: Schema.Types.ObjectId,
      ref: 'Request',
      default: null,
      // REMOVED: index: true (will be defined explicitly below to avoid duplication)
    },
    externalTransactionId: {
      type: String,
      trim: true,
      index: true,
      unique: true,
      sparse: true,
    },
    type: {
      type: String,
      required: [true, 'Transaction type is required.'],
      trim: true,
      lowercase: true,
      index: true,
      enum: [
        'token_purchase',
        'request_unlock',
        'service_payment',
        'payout',
        'refund',
        'subscription_fee',
        'other',
      ],
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded', 'disputed'],
      default: 'pending',
      required: true,
      index: true,
    },
    tokens: { type: Number },
    amount: {
      type: Number,
      required: [true, 'Transaction amount is required.'],
    },
    currency: {
      type: String,
      required: [true, 'Transaction currency is required.'],
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 3,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    paymentGateway: {
      type: String,
      trim: true,
      lowercase: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    originalTransaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'datePosted', updatedAt: 'lastDateAmended' },
  }
);

// --- Indexes ---
// CORRECTED: Define all indexes explicitly here for clarity and to avoid duplicates.
TransactionSchema.index({ request: 1 }, { sparse: true }); // Index on the request field, sparse because it can be null.
TransactionSchema.index({ partyId: 1, partyModel: 1, datePosted: -1 });
TransactionSchema.index({ type: 1, status: 1 });
// The index on externalTransactionId is already defined inline, which is fine for a unique constraint.

// Idempotent model registration
export default mongoose.models[modelName] ||
  mongoose.model(modelName, TransactionSchema);
