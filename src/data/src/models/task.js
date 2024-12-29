import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const modelName = 'Task';

const TaskSchema = new Schema ({
    skill: {type: mongoose.Schema.Types.ObjectId, ref : 'Skill'},
    skillquestions: [{type: mongoose.Schema.Types.ObjectId, ref : 'Question'}],
    requester: {type: mongoose.Schema.Types.ObjectId, ref : 'User'},
    taskimages: [{type: mongoose.Schema.Types.ObjectId, ref : 'Image'}],
    providers: [{type: mongoose.Schema.Types.ObjectId, ref : 'Provider'}],
    doneby: [{type: mongoose.Schema.Types.ObjectId, ref : 'Provider'}],
    rating: Number,
    feedback: String,
});

export default mongoose.models[modelName] || mongoose.model(modelName, TaskSchema);

