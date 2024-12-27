import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const modelName = 'Request';

const opts = { toJSON: { virtuals: true } };

const schemaOptions = {
    timestamps: {createdAt: "dateposted", updatedAt: "lastdateamended"}
};

// Conversation Subdocument Schema
const ConversationSchema = new Schema({
  provider: { type: Schema.Types.ObjectId, ref: "Provider" },
  messages: [{ 
    message: String,
    date: { type: Date, default: Date.now },
  }],
});

// Notes Subdocument Schema
const NotesSchema = new Schema({
  provider: { type: Schema.Types.ObjectId, ref: "Provider" },
  note: String,
});

const RequestSchema = Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User" },
    skill: { type: Schema.Types.ObjectId, ref: "Skill" },
    cost: { type: Number, default: 3 },
    country: String,
    location: String,
    coordinates: { type: [Number], default: [0, 0] },
    remotelyonly: { type: Boolean, default: false },
    remotelyok: { type: Boolean, default: false },
    answers: [String],
    needsenglish: { type: Boolean, default: false },
    needsdomestic: { type: Boolean, default: false },
    needsmanage: { type: Boolean, default: false },
    needslarge: { type: Boolean, default: false },
    needsurgent: { type: Boolean, default: false },
    needsmultiple: { type: Boolean, default: false },
    hasbudget: { type: Boolean, default: false },
    additionalinformation: { type: String, default: "" },
    images: [String],
    discardedbyuser: { type: Boolean, default: false },
    discardedbyroot: { type: Boolean, default: false },
    submitted: { type: Boolean, default: false },
    proposedfor: [{ type: Schema.Types.ObjectId, ref: "Provider" }],
    sentto: [{ type: Schema.Types.ObjectId, ref: "Provider" }],
    seenby: [{ type: Schema.Types.ObjectId, ref: "Provider" }],
    paidforby: [{ type: Schema.Types.ObjectId, ref: "Provider" }],
    discardedby: [{ type: Schema.Types.ObjectId, ref: "Provider" }],
    doneby: { type: Schema.Types.ObjectId, ref: "Provider" },
    userreview: { type: Schema.Types.ObjectId, ref: "Review" },
    providerreview: { type: Schema.Types.ObjectId, ref: "Review" },
    conversation: [ConversationSchema],
    notes: [NotesSchema],
  },
  schemaOptions
);

RequestSchema.post('findOneAndDelete', async function (doc) {
    if (doc) {
        await Review.deleteMany({
          _id: {
              $in: doc.reviews
          }
        })
    }
})

export default mongoose.models[modelName] || mongoose.model(modelName, RequestSchema);