// data/src/models/provider.js
/**
 * @file Mongoose schema definition for the Provider model.
 * @module @daitanjs/data/models/provider
 */
import mongoose from 'mongoose';

const Schema = mongoose.Schema;
const modelName = 'Provider';

const ProviderSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Reference to the User model
      required: [true, 'Provider must have an owner (User ID).'],
      index: true,
    },
    language: { type: String, default: 'en', trim: true, lowercase: true },
    businessName: {
      type: String,
      trim: true,
      required: [true, 'Business name is required.'],
    },
    providerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    publicCategory: { type: String, trim: true, index: true },
    location: { type: String, trim: true },
    distance: { type: Number, default: 30, min: 0 },

    // More structured address components
    street: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    city: { type: String, trim: true, index: true },
    county: { type: String, trim: true },
    province: { type: String, trim: true },
    country: { type: String, trim: true, index: true },
    countryCode: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 2,
    },

    businessPhone: { type: String, trim: true },
    website: { type: String, trim: true },

    // Service preferences/capabilities (booleans)
    doEnglish: { type: Boolean, default: false },
    doDomestic: { type: Boolean, default: false },
    doRemotely: { type: Boolean, default: false },
    doUrgent: { type: Boolean, default: false },
    doLargeProjects: { type: Boolean, default: false },
    doLicenseRequiredWork: { type: Boolean, default: false },
    doManageProjects: { type: Boolean, default: false },
    doTravel: { type: Boolean, default: false },
    doReferrals: { type: Boolean, default: false },
    doBudgetWork: { type: Boolean, default: false },

    license: { type: String, trim: true },
    passport: { type: String, trim: true },
    noteToSelf: { type: String, trim: true },

    // Image URLs
    certifyImageURL: { type: String, trim: true },
    identifyImageURL: { type: String, trim: true },
    logoURL: { type: String, trim: true },
    showcaseImageURLs: [{ type: String, trim: true }],

    description: {
      type: [String],
      default: () => ['', '', '', ''],
    },
    writeUp: { type: String, trim: true },

    skillNumbers: [String],
    skills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
    onlineSkills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],

    specialties: [String],

    unsubscribed: { type: Boolean, default: false, index: true },
    tokens: { type: Number, default: 0, min: 0 },
    paymentModel: { type: Number, default: 1 },

    // Geospatial data for location-based queries
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },

    // Relational fields
    requestPool: [{ type: Schema.Types.ObjectId, ref: 'Request' }],
    requestsSeen: [{ type: Schema.Types.ObjectId, ref: 'Request' }],
    requestsPaidFor: [{ type: Schema.Types.ObjectId, ref: 'Request' }],
    requestsDone: [{ type: Schema.Types.ObjectId, ref: 'Request' }],
    reviews: [{ type: Schema.Types.ObjectId, ref: 'Review' }],
    transactions: [{ type: Schema.Types.ObjectId, ref: 'Transaction' }],

    // Additional useful fields
    isActive: { type: Boolean, default: true, index: true },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    profileCompletionScore: { type: Number, default: 0, min: 0, max: 100 },
  },
  {
    timestamps: true,
  }
);

// --- Indexes ---
ProviderSchema.index({ coordinates: '2dsphere' });
ProviderSchema.index({ providerEmail: 1 }, { unique: true, sparse: true });
ProviderSchema.index({
  businessName: 'text',
  publicCategory: 'text',
  specialties: 'text',
}); // Example text index for searching

// --- Hooks ---
// Post hook for cascading delete of associated reviews.
ProviderSchema.post('findOneAndDelete', async function (doc) {
  if (doc && doc.reviews && doc.reviews.length > 0) {
    try {
      // Safely access the Review model to avoid issues in certain environments
      const Review = mongoose.model('Review');
      const result = await Review.deleteMany({ _id: { $in: doc.reviews } });
      // In a real application, use a proper logger here.
      console.log(
        `[ProviderSchema Hook] Cascading delete: Removed ${result.deletedCount} reviews for provider ${doc._id}`
      );
    } catch (error) {
      console.error(
        `[ProviderSchema Hook] Error during cascading delete of reviews for provider ${doc._id}:`,
        error
      );
    }
  }
});

export default mongoose.models[modelName] ||
  mongoose.model(modelName, ProviderSchema);
