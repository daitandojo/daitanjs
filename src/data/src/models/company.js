import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const modelName = 'Company';

const CompanySchema = new Schema({
  href: { type: String },
  originalHref: { type: String },
  companyName: { type: String, unique: true },
  director: { type: String, default: 'N/A' },
  directorName: { type: String, default: 'N/A' },
  cvrNumber: { type: String, default: 'N/A' },
  phoneNumber: { type: String, default: 'N/A' },
  address: { type: String, default: 'N/A' },
  balanceSheet: { type: Number },
  motherLink: { type: String, default: null },
  coordinates: [{ type: Number }],
}, { collection: "companies", strict: false });

export default mongoose.models[modelName] || mongoose.model(modelName, CompanySchema);