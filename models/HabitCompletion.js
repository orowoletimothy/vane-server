import mongoose from "mongoose";

const habitCompletionSchema = new mongoose.Schema({
  habitId: { type: mongoose.Schema.Types.ObjectId, ref: "Habit", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  completedCount: { type: Number, default: 1 }, // How many times completed that day
  date: { type: Date, required: true }, // The date it was completed (YYYY-MM-DD format)
  completedAt: { type: Date, default: Date.now }, // Exact timestamp when completed
}, {
  timestamps: true
});

// Create compound index to ensure one completion record per habit per day
habitCompletionSchema.index({ habitId: 1, date: 1 }, { unique: true });

const HabitCompletion = mongoose.model("HabitCompletion", habitCompletionSchema);
export default HabitCompletion; 