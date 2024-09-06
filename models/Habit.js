import mongoose from "mongoose";

const habitSchema = new mongoose.Schema({
  title: { type: String, required: true },
  habitStreak: { type: Number, default: 0 },
  goal: { type: String, enum: ["daily", "weekly"], required: true },
  reminderTime: { type: String, required: true },
  repeatDays: {
    type: [String],
    enum: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
  },
  status: {
    type: String,
    enum: ["complete", "paused", "incomplete"],
    default: "incomplete",
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});

const Habit = mongoose.model("Habit", habitSchema);
export default Habit;
