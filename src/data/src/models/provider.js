import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import Review from './review.js'
const modelName = 'Provider';

const opts = { toJSON: { virtuals: true } };

const ProviderSchema = Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    language: { type: String, default: "" },
    businessname: { type: String, default: "" },
    provideremail: { type: String, default: "" },
    publiccategory: { type: String, default: "" },
    location: { type: String, default: "" },
    distance: { type: Number, default: 30 },
    street: { type: String, default: "" },
    zipcode: { type: String, default: "" },
    city: { type: String, default: "" },
    county: { type: String, default: "" },
    province: { type: String, default: "" },
    country: { type: String, default: "" },
    countrycode: { type: String, default: "" },
    businessphone: { type: String, default: "" },
    website: { type: String, default: "" },
    doenglish: { type: Boolean, default: false },
    dodomestic: { type: Boolean, default: false },
    doremotely: { type: Boolean, default: false },
    dourgent: { type: Boolean, default: false },
    dolarge: { type: Boolean, default: false },
    dolicense: { type: Boolean, default: false },
    domanage: { type: Boolean, default: false },
    dotravel: { type: Boolean, default: false },
    doreferrals: { type: Boolean, default: false },
    dobudget: { type: Boolean, default: false },
    license: { type: String, default: "" },
    passport: { type: String, default: "" },
    notetoself: { type: String, default: "" },
    certifyimage: { type: String, default: "" },
    identifyimage: { type: String, default: "" },
    description: { type: [String], default: ["", "", "", ""] },
    writeup: { type: String, default: "" },
    logo: { type: String, default: "" },
    showcaseimages: [{ type: String, default: "" }],
    skillnumbers: [String],
    skills: [{ type: Schema.Types.ObjectId, ref: "Skill" }],
    onlineskills: [{ type: Schema.Types.ObjectId, ref: "Skill" }],
    specialties: [],
    unsubscribed: { type: Boolean, default: false },
    tokens: { type: Number, default: 0 },
    paymentmodel: { type: Number, default: 1 },
    coordinates: { type: [Number], default: [0, 0], required: true },
    requestpool: [{ type: Schema.Types.ObjectId, ref: "Request" }],
    requestsseen: [{ type: Schema.Types.ObjectId, ref: "Request" }],
    requestspaidfor: [{ type: Schema.Types.ObjectId, ref: "Request" }],
    requestsdone: [{ type: Schema.Types.ObjectId, ref: "Request" }],
    reviews: [{ type: Schema.Types.ObjectId, ref: "Review" }],
    transactions: [{ type: Schema.Types.ObjectId, ref: "Transaction" }],
  },
  opts
);

ProviderSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await Review.deleteMany({
      _id: {
        $in: doc.reviews,
      },
    });
  }
});

export default mongoose.models[modelName] || mongoose.model(modelName, ProviderSchema);
