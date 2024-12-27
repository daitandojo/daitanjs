import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const modelName = 'BlogPost';

const BlogPostSchema = Schema({
    // skill: { type: Schema.Types.ObjectId, ref: 'Skill' },
    title: { type: String },
    author: { type: String },
    date: { type: Date, default: Date.now },
    language: { type: String },
    body: [{}],
    reads: { type: Number, default: 0 },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
});

export default mongoose.models[modelName] || mongoose.model(modelName, BlogPostSchema);
