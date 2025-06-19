import mongoose from "mongoose";

const moodSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  mood: { 
    type: String, 
    required: true,
    enum: ["😊", "😐", "😔", "😤", "🥳", "😴", "🤔", "😰"] // Available mood emojis
  },
  motivation: { 
    type: String, 
    maxlength: 200,
    default: ""
  },
  date: { 
    type: Date, 
    required: true,
    default: Date.now
  },
  dateString: { 
    type: String, 
    required: true // Format: YYYY-MM-DD for easy querying
  }
}, {
  timestamps: true
});

// Ensure one mood entry per user per day
moodSchema.index({ userId: 1, dateString: 1 }, { unique: true });

const Mood = mongoose.model("Mood", moodSchema);
export default Mood; 