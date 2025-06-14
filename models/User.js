import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, min: 2, max: 50 },
  lastName: { type: String, required: true, min: 2, max: 50 },
  email: { type: String, required: true, max: 50, unique: true },
  password: { type: String, required: true, min: 5 },
  profilePicture: { type: String, default: "default-profile.png" },
  habitIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Habit" }],
  taskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
  vacationMode: { type: Boolean, default: false },
  genStreakCount: { type: Number, default: 0 },
  userTimeZone: { type: String, default: "" },
});

const User = mongoose.model("User", userSchema);
export default User;
