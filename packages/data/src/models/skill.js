// data/src/models/skill.js
/**
 * @file Mongoose schema definition for the Skill model.
 * @module @daitanjs/data/models/skill
 */
import mongoose from 'mongoose';

const Schema = mongoose.Schema;
const modelName = 'Skill';

const SkillSchema = new Schema(
  {
    taskId: {
      type: Number,
      required: [true, 'taskId is required for a Skill.'],
      unique: true,
      index: true,
    },
    // Hierarchical relationships
    parents: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
    children: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],

    // Multilingual or structured fields. Using Mixed for flexibility as in original.
    description: { type: Schema.Types.Mixed, default: {} },
    intro: { type: Schema.Types.Mixed, default: {} },
    conclusion: { type: Schema.Types.Mixed, default: {} },
    keywords: {
      type: Schema.Types.Mixed,
      default: {},
    },

    embedding: [{ type: Number }], // Vector embedding for semantic search

    // Skill attributes
    availableOnline: { type: Boolean, default: false, index: true },
    typicalSessions: { type: Number, default: 0, min: 0 },
    pricePerSession: { type: Number, default: 0, min: 0 },

    // Analytics / Tracking
    timesShown: { type: Number, default: 0, min: 0 },
    timesClicked: { type: Number, default: 0, min: 0 },
    touchedByIp: [String], // Array of IP addresses - consider GDPR implications
    tokens: { type: Number, default: 0, min: 0 },
    clickedByUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    timesRequested: { type: Number, default: 0, min: 0 },
    requestedByUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // Questions related to this skill
    questionNumbers: [String], // List of question identifiers/codes.
    questions: [{ type: Schema.Types.ObjectId, ref: 'Question' }],

    blogPosts: [{ type: Schema.Types.ObjectId, ref: 'BlogPost' }],

    // Status fields
    needsReviewing: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    category: { type: String, trim: true, index: true },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// --- Indexes ---
// Example text index on english keywords and description if using a multilingual object structure.
// This requires the data to be in the format: { keywords: { en: '...', es: '...' } }
// SkillSchema.index({ 'keywords.en': 'text', 'description.en': 'text' });

// Idempotent model registration
export default mongoose.models[modelName] ||
  mongoose.model(modelName, SkillSchema);
