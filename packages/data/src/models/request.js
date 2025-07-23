// data/src/models/request.js
/**
 * @file Mongoose schema definition for the Request model.
 * @module @daitanjs/data/models/request
 */
import mongoose from 'mongoose';

const Schema = mongoose.Schema;
const modelName = 'Request';

// --- Subdocument Schemas for better structure ---

const ConversationMessageSchema = new Schema(
  {
    sender: { type: String, enum: ['user', 'provider'], required: true },
    // Optional: Could store specific User or Provider ObjectId for direct linking
    // senderId: { type: Schema.Types.ObjectId, refPath: 'senderModel' },
    // senderModel: { type: String, enum: ['User', 'Provider'] },
    message: { type: String, trim: true, required: true },
    read: { type: Boolean, default: false },
  },
  { _id: true, timestamps: { createdAt: 'date', updatedAt: false } }
);

const ConversationSchema = new Schema(
  {
    provider: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    messages: [ConversationMessageSchema],
    lastMessageAt: { type: Date, index: true },
  },
  { _id: true, timestamps: true }
);

const NoteSchema = new Schema(
  {
    provider: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    note: { type: String, trim: true, required: true },
  },
  { _id: true, timestamps: true }
);

// --- Main Request Schema ---

const RequestSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required.'],
      index: true,
    },
    skill: {
      type: Schema.Types.ObjectId,
      ref: 'Skill',
      required: [true, 'Skill is required.'],
      index: true,
    },
    cost: { type: Number, default: 3, min: 0 },
    country: { type: String, trim: true, index: true },
    location: { type: String, trim: true },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] }, // [longitude, latitude]
    },
    remotelyOnly: { type: Boolean, default: false },
    remotelyOk: { type: Boolean, default: false },
    answers: [{ type: Schema.Types.Mixed }],
    needsEnglish: { type: Boolean, default: false },
    needsDomesticHelp: { type: Boolean, default: false },
    needsProjectManagement: { type: Boolean, default: false },
    needsLargeProjectCapability: { type: Boolean, default: false },
    needsUrgentAssistance: { type: Boolean, default: false },
    needsMultipleProviders: { type: Boolean, default: false },
    hasBudgetDefined: { type: Boolean, default: false },
    additionalInformation: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5000,
    },
    imageURLs: [{ type: String, trim: true }],

    status: {
      type: String,
      enum: [
        'pending_submission',
        'submitted',
        'in_progress',
        'awaiting_payment',
        'completed',
        'cancelled_by_user',
        'cancelled_by_provider',
        'discarded_admin',
      ],
      default: 'pending_submission',
      index: true,
    },

    // Provider interaction tracking
    proposedToProviders: [{ type: Schema.Types.ObjectId, ref: 'Provider' }],
    sentToProviders: [{ type: Schema.Types.ObjectId, ref: 'Provider' }],
    seenByProviders: [{ type: Schema.Types.ObjectId, ref: 'Provider' }],
    paidForByProviders: [{ type: Schema.Types.ObjectId, ref: 'Provider' }],
    discardedByProviders: [{ type: Schema.Types.ObjectId, ref: 'Provider' }],
    completedByProvider: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      default: null,
    },

    // Reviews
    userReview: { type: Schema.Types.ObjectId, ref: 'Review', default: null },
    providerReview: {
      type: Schema.Types.ObjectId,
      ref: 'Review',
      default: null,
    },

    // Communication and Notes
    conversations: [ConversationSchema],
    notes: [NoteSchema],
  },
  {
    timestamps: { createdAt: 'datePosted', updatedAt: 'lastDateAmended' },
  }
);

// --- Indexes ---
RequestSchema.index({ coordinates: '2dsphere' }, { sparse: true });
RequestSchema.index({ user: 1, datePosted: -1 }); // For user's request history
RequestSchema.index({ skill: 1, status: 1, datePosted: -1 }); // For finding active requests for a skill

// --- Hooks ---
RequestSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    const reviewsToDelete = [];
    if (doc.userReview) reviewsToDelete.push(doc.userReview);
    if (doc.providerReview) reviewsToDelete.push(doc.providerReview);

    if (reviewsToDelete.length > 0) {
      try {
        const ReviewModel = mongoose.model('Review');
        const result = await ReviewModel.deleteMany({
          _id: { $in: reviewsToDelete },
        });
        console.log(
          `[RequestSchema Hook] Cascading delete: Removed ${result.deletedCount} reviews for request ${doc._id}`
        );
      } catch (error) {
        console.error(
          `[RequestSchema Hook] Error during cascading delete of reviews for request ${doc._id}:`,
          error
        );
      }
    }
  }
});

// Idempotent model registration
export default mongoose.models[modelName] ||
  mongoose.model(modelName, RequestSchema);
