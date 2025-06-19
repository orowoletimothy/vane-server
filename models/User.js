import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, min: 3, max: 30 },
  displayName: { type: String },
  email: { type: String, required: true, max: 50, unique: true },
  password: { type: String, required: true, min: 5 },
  habitIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Habit" }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  genStreakCount: { type: Number, default: 0 },
  userTimeZone: { type: String, default: "Africa/Lagos" },
  longestStreak: { type: Number, default: 0 },
  lastStreakUpdate: { type: Date },
  todayStreakEarned: { type: Boolean }, // Track if today's streak increment is earned
  recoveryPoints: { type: Number, default: 3 },
  isVacation: { type: Boolean, default: false },
  profilePicture: { type: String, default: "default-profile.png" },
  lastHabitReset: { type: Date },
  pushSubscription: { type: pushSubscriptionSchema, default: null },
  notificationPreferences: {
    friendRequests: { type: Boolean, default: true },
    habitReminders: { type: Boolean, default: true },
    streakMilestones: { type: Boolean, default: true }
  }
}, {
  timestamps: true // This will add createdAt and updatedAt fields
});

// Add pre-save hook to lowercase username
userSchema.pre('save', function (next) {
  if (this.username) {
    this.username = this.username.toLowerCase();
  }
  next();
});

const User = mongoose.model("User", userSchema);
export default User;
