import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const modelName = 'Question';

const QuestionSchema = Schema({
  questionid: Number,
  questiontype: String,
  description: {},
  answers: [{}],
  responses: [{}],
  instructions: [{}],
  needsreviewing: { type: Boolean, default: false }
});

export default mongoose.models[modelName] || mongoose.model(modelName, QuestionSchema);