import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import passportLocalMongoose from 'passport-local-mongoose';
const modelName = 'User';

const UserSchema = new Schema({
    userid: { type: String, default: "" },
    username: { type: String },
    authentication: { type: String, default: "" },
    root: {type: Boolean,default: false},
    email: {type: String,default: ""},
    firstname: {type: String,default: ""},
    lastname: {type: String,default: ""},
    language: {type: String, default: ""},
    country: {type: String, default: ""},
    profilepicture: {type: String, default: ""},
    mobile: { type: String, default: "" },
    notetoself: { type: String, default: "" },
    verified: {type: Boolean,default: false},
    termsaccepted: {type: Boolean,default: false},
    location: {type: String,default: ""},
    affiliate: {type: Schema.Types.ObjectId,ref : 'User'},
    provider: {type: Schema.Types.ObjectId,ref : 'Provider'},
    hasclickedon: [{type: Schema.Types.ObjectId,ref : 'Skill'}],
    coordinates: {type: [Number],default: [ 0, 0 ] },
    requests: {type: [{type: Schema.Types.ObjectId,ref: 'Request'}], default: []},
    rewardsaccrued: {type: Number, default: 0},
    rewardspaid: {type: Number, default: 0},
    tokensincited: {type: Number, default: 0}
});

UserSchema.plugin(passportLocalMongoose);

export default mongoose.models[modelName] || mongoose.model(modelName, UserSchema);
