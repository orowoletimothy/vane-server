import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    habitId: { type: mongoose.Schema.Types.ObjectId, ref: "Habit", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ["HABIT_REMINDER", "FRIEND_REQUEST", "STREAK_MILESTONE"], default: "HABIT_REMINDER" },
    isRead: { type: Boolean, default: false },
    scheduledFor: { type: Date, required: true },
    status: { type: String, enum: ["PENDING", "SENT", "FAILED"], default: "PENDING" }
}, {
    timestamps: true
});

// Index for querying notifications efficiently
notificationSchema.index({ userId: 1, scheduledFor: 1, status: 1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification; 