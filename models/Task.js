import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  dueDate: { type: Date, required: true},
  reminderTime: { type: Number },
  repeat: { type: String, enum: ['none', 'weekly', 'monthly', 'yearly'], default: 'none'},
  userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true}
})

const Task = mongoose.model('Task', taskSchema);

export default Task;
