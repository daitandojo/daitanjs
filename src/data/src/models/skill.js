import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const modelName = 'Skill';

const QuestionSchema = new Schema({
  question: String,
  answerType: Number,
  answerOptions: [String],
  representation: String,
});

const SkillSchema = new Schema({
  taskid: { type: Number, required: true, unique: true },
  parents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Skill" }],
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Skill" }],
  description: {},
  intro: {},
  conclusion: {},
  keywords: {},
  embedding: [{ type: Number }],
  availableonline: { type: Boolean, default: false },
  typicalsessions: { type: Number, default: 0 },
  pricepersession: { type: Number, default: 0 },
  timesshown: { type: Number, default: 0 },
  timesclicked: { type: Number, default: 0 },
  touchedbyip: [String],
  tokens: { type: Number, default: 0 },
  clickedby: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  timesrequested: { type: Number, default: 0 },
  requestedby: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  questionnumbers: [String],
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
  blogposts: [{ type: mongoose.Schema.Types.ObjectId, ref: "BlogPost" }],
  needsreviewing: { type: Boolean, default: false },
});

SkillSchema.index({ taskid: 1 });

export default mongoose.models[modelName] || mongoose.model(modelName, SkillSchema);