import mongoose from "mongoose";

const habitSchema = new mongoose.Schema({
  title: { type: String, required: true },
  habitStreak: { type: Number, default: 0 },
  reminderTime: { type: String, required: true },
  repeatDays: {
    type: [String],
    enum: [
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ],
  },
  status: {
    type: String,
    enum: ["complete", "incomplete", "paused"],
    default: "incomplete",
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  target_count: { type: Number, default: 1 },
  is_public: { type: Boolean, default: false },
  lastCompleted: { type: Date },
  notes: { type: String },
  icon: { type: String }
}, {
  timestamps: true // This will add createdAt and updatedAt fields
});

const Habit = mongoose.model("Habit", habitSchema);
export default Habit;
