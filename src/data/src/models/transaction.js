import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const modelName = 'Transaction';

const schemaOptions = {
    timestamps: {createdAt: "dateposted", updatedAt: "lastdateamended"}
};

const TransactionSchema = Schema({
    provider: {type: Schema.Types.ObjectId,ref: 'User'},
    request: {type: Schema.Types.ObjectId,ref: 'Request'},
    transactionid: String,
    type: String,
    tokens: Number,
    amount: Number,
    currency: String,
    objective: String,
}, schemaOptions);

export default mongoose.models[modelName] || mongoose.model(modelName, TransactionSchema);
