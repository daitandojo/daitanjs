// data/src/models/review.js
/**
 * @file Mongoose schema definition for the Review model.
 * @module @daitanjs/data/models/review
 */
import mongoose from 'mongoose';

const Schema = mongoose.Schema;
const modelName = 'Review';

const reviewSchema = new Schema(
  {
    // Rating criteria (assuming a 1-5 star scale)
    priceRating: { type: Number, default: 0, min: 0, max: 5 },
    qualityRating: { type: Number, default: 0, min: 0, max: 5 },
    speedRating: { type: Number, default: 0, min: 0, max: 5 },
    sustainabilityRating: { type: Number, default: 0, min: 0, max: 5 },
    responsivenessRating: { type: Number, default: 0, min: 0, max: 5 },
    politenessRating: { type: Number, default: 0, min: 0, max: 5 },
    // For when a provider reviews a user
    paymentSpeedRating: { type: Number, default: 0, min: 0, max: 5 },
    wouldRecommend: { type: Number, default: 0, min: 0, max: 1 }, // 0 = No, 1 = Yes

    commentary: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'Review commentary cannot exceed 2000 characters.'],
    },

    request: {
      type: Schema.Types.ObjectId,
      ref: 'Request',
      required: [true, 'A review must be associated with a request.'],
      index: true,
    },

    // Who is being reviewed? (The target of the review)
    reviewTargetId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'reviewTargetModel', // Dynamic reference based on reviewTargetModel
    },
    reviewTargetModel: {
      type: String,
      required: true,
      enum: ['User', 'Provider'],
    },

    // Who wrote the review? (The author of the review)
    reviewerId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'reviewerModel', // Dynamic reference
    },
    reviewerModel: {
      type: String,
      required: true,
      enum: ['User', 'Provider'],
    },

    submitted: { type: Boolean, default: false, index: true },
    isPublished: { type: Boolean, default: false, index: true },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    moderationComment: { type: String, trim: true },
  },
  {
    timestamps: { createdAt: 'datePosted', updatedAt: 'lastDateAmended' },
  }
);

// --- Indexes ---
reviewSchema.index({ request: 1 });
reviewSchema.index({
  reviewTargetId: 1,
  reviewTargetModel: 1,
  isPublished: 1,
  datePosted: -1,
}); // For fetching all published reviews for a user/provider
reviewSchema.index({ reviewerId: 1, reviewerModel: 1, datePosted: -1 }); // For fetching all reviews written by a user/provider

// Idempotent model registration
export default mongoose.models[modelName] ||
  mongoose.model(modelName, reviewSchema);
