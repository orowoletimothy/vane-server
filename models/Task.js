import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  dueDate: { type: Date, required: true },
  reminderTime: { type: Number, enum: [0, 5, 15, 30, 1], default: 0 },
  repeat: {
    type: String,
    enum: ["none", "weekly", "monthly", "yearly"],
    default: "none",
  },
  completed: { type: Boolean, default: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});

const Task = mongoose.model("Task", taskSchema);

export default Task;
