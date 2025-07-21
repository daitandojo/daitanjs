// data/src/models/user.js
/**
 * @file Mongoose schema definition for the User model.
 * @module @daitanjs/data/models/user
 *
 * @description
 * Defines the schema for user documents in MongoDB using Mongoose.
 * This schema includes fields for user identification (Firebase UID, email, username),
 * personal details (names, language, country), profile information (picture),
 * authentication status (verified, provider), tracking (last login, IP),
 * location, relational links (affiliate parent, provider profile),
 * and a simple token/reward system.
 */
import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import passportLocalMongoose from 'passport-local-mongoose';

const modelName = 'User';

const UserSchema = new Schema(
  {
    firebaseUid: {
      type: String,
      index: true,
      unique: true,
      sparse: true, // Allows multiple documents to have null/undefined for this field
      trim: true,
    },
    username: {
      type: String,
      trim: true,
      index: true,
      lowercase: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      required: [true, 'Email is required for a user.'],
      index: true,
      match: [/.+@.+\..+/, 'Please provide a valid email address.'],
    },
    authProvider: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'unknown',
    },
    isRootAdmin: { type: Boolean, default: false, index: true },

    // Personal Details
    firstName: { type: String, default: '', trim: true },
    lastName: { type: String, default: '', trim: true },
    displayName: { type: String, trim: true },

    language: { type: String, default: 'en', trim: true, lowercase: true },
    country: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 2,
    },

    // Profile Information
    profilePictureUrl: { type: String, default: '', trim: true },
    mobileNumber: { type: String, default: '', trim: true },
    noteToSelf: { type: String, default: '', trim: true },

    // Status & Verification
    isVerified: { type: Boolean, default: false, index: true },
    termsAcceptedVersion: { type: String, trim: true, default: null },
    termsAcceptedAt: { type: Date, default: null },

    // Tracking
    lastLoginAt: { type: Date, default: null },
    lastIpAddress: { type: String, trim: true, default: null },

    // Location
    locationString: { type: String, default: '', trim: true },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
      },
    },

    // Relational Fields
    affiliateParentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    providerProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      default: null,
      index: true,
      unique: true,
      sparse: true,
    },

    // User Activity
    skillsClickedOn: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
    requestsMade: [{ type: Schema.Types.ObjectId, ref: 'Request' }],

    // Token / Reward System
    tokenBalance: { type: Number, default: 0, min: 0 },
    rewardsAccrued: { type: Number, default: 0, min: 0 },
    rewardsPaidOut: { type: Number, default: 0, min: 0 },
    tokensFromInvites: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

// --- Indexes ---
UserSchema.index({ coordinates: '2dsphere' }, { sparse: true });

// --- Passport-Local-Mongoose Plugin ---
UserSchema.plugin(passportLocalMongoose, {
  usernameField: 'email',
  usernameQueryFields: ['email'],
});

// --- Virtuals ---
UserSchema.virtual('fullName').get(function () {
  const first = this.firstName || '';
  const last = this.lastName || '';
  if (first && last) {
    return `${first} ${last}`;
  }
  return first || last || this.displayName || this.email;
});

// Idempotent model registration
export default mongoose.models[modelName] ||
  mongoose.model(modelName, UserSchema);
