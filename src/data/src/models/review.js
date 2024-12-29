import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const opts = { toJSON: { virtuals: true } };
const modelName = 'Review';

const schemaOptions = {
    timestamps: {createdAt: "dateposted", updatedAt: "lastdateamended"}
};

const reviewSchema = new Schema({
    price: { type: Number, default: 0 },
    quality: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
    sustainability: { type: Number, default: 0 },
    responsiveness: { type: Number, default: 0 },
    politeness: { type: Number, default: 0 },
    paymentspeed: { type: Number, default: 0 },
    wouldrecommend: { type: Number, default: 0 },
    commentary: { type: String, default: "" },
    request: {type: Schema.Types.ObjectId, ref: 'Request'},
    target: { type: String, default: "" },
    operator: { type: String, default: "" },
    submitted: { type: Boolean, default: false }
}, schemaOptions);

export default mongoose.models[modelName] || mongoose.model(modelName, reviewSchema);
