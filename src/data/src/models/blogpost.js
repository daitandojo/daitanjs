// data/src/models/blogpost.js
/**
 * @file Mongoose schema definition for the BlogPost model.
 * @module @daitanjs/data/models/blogpost
 */
import mongoose from 'mongoose';

const Schema = mongoose.Schema;
const modelName = 'BlogPost';

const BlogPostSchema = new Schema(
  {
    title: {
      type: String,
      trim: true,
      required: [true, 'Blog post title is required.'],
    },
    author: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    language: {
      // ISO language code, e.g., 'en', 'es'
      type: String,
      trim: true,
      lowercase: true,
    },
    body: [{}], // Flexible array of objects for structured content (e.g., paragraphs, images, code blocks)
    tags: [{ type: String, trim: true, lowercase: true, index: true }], // Array of string tags, indexed
    category: {
      type: String,
      trim: true,
      index: true, // Index category for faster filtering
    },
    isPublished: { type: Boolean, default: false, index: true }, // For quick filtering of published posts

    // Engagement metrics
    reads: { type: Number, default: 0, min: 0 },
    upvotes: { type: Number, default: 0, min: 0 },
    downvotes: { type: Number, default: 0, min: 0 },

    // SEO related fields
    metaDescription: { type: String, trim: true, maxlength: 160 },
    slug: {
      type: String,
      trim: true,
      unique: true, // Ensure SEO-friendly URLs are unique
      sparse: true, // Allows multiple documents to have null/undefined for this field
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Example of a pre-save hook for automatically generating a slug from the title
BlogPostSchema.pre('save', function (next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove non-word chars
      .replace(/[\s_-]+/g, '-') //- // Replace spaces/underscores/hyphens with a single hyphen
      .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
  }
  next();
});

// Idempotent model registration:
// Checks if the model already exists before trying to define it.
export default mongoose.models[modelName] ||
  mongoose.model(modelName, BlogPostSchema);
