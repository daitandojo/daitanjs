// data/src/models/question.js
/**
 * @file Mongoose schema definition for the Question model.
 * @module @daitanjs/data/models/question
 */
import mongoose from 'mongoose';

const Schema = mongoose.Schema;
const modelName = 'Question';

// A sub-schema for structured answer options in multiple-choice questions.
const AnswerOptionSchema = new Schema(
  {
    id: { type: String, required: true, trim: true }, // e.g., 'a', 'b', '1', '2'
    text: { type: String, required: true, trim: true },
    isCorrect: { type: Boolean }, // Optional, if it's a quiz-like question
  },
  { _id: false } // Do not create a separate _id for each answer option
);

// A sub-schema for storing individual responses to a question.
const ResponseDetailSchema = new Schema(
  {
    responderId: { type: Schema.Types.ObjectId, refPath: 'responderModel' }, // Can refer to User or Provider
    responderModel: { type: String, enum: ['User', 'Provider'] },
    selectedAnswerId: { type: String }, // Corresponds to AnswerOptionSchema.id for multiple choice
    responseText: { type: String, trim: true }, // For open-ended responses
    respondedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const QuestionSchema = new Schema(
  {
    questionId: {
      type: Number,
      index: true,
    },
    questionType: {
      type: String,
      trim: true,
      enum: [
        'multiple_choice',
        'single_choice',
        'text_input',
        'rating',
        'yes_no',
      ],
      required: [true, 'Question type is required.'],
    },
    // The `description` was `[{}]`, now using Mixed for flexibility.
    // A better approach for i18n would be { en: String, es: String }, but Mixed retains original flexibility.
    description: {
      type: Schema.Types.Mixed,
      default: {},
      required: [true, 'Question description/text is required.'],
    },
    // The `answers` field, now `answerOptions` for clarity.
    answerOptions: {
      type: [AnswerOptionSchema],
      default: undefined,
    },
    // Stores actual responses from users/providers
    responses: {
      type: [ResponseDetailSchema],
      default: [],
    },
    instructions: {
      type: Schema.Types.Mixed,
      default: {},
    },
    // Metadata for the question
    category: { type: String, trim: true, index: true },
    difficultyLevel: { type: Number, min: 1, max: 5 }, // e.g., 1 (easy) to 5 (hard)
    tags: [{ type: String, trim: true, lowercase: true, index: true }],
    isActive: { type: Boolean, default: true, index: true },
    needsReviewing: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// --- Indexes ---
QuestionSchema.index({ questionType: 1, category: 1 });

// Idempotent model registration
export default mongoose.models[modelName] ||
  mongoose.model(modelName, QuestionSchema);
