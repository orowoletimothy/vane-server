import Mood from "../models/Mood.js";

// Save or update today's mood
export const saveMood = async (req, res) => {
  try {
    const { mood, motivation = "" } = req.body;
    const userId = req.user.id;
    
    
    // Get today's date string in user's timezone
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Check if mood already exists for today
    const existingMood = await Mood.findOne({ 
      userId, 
      dateString 
    });

    if (existingMood) {
      // Update existing mood
      existingMood.mood = mood;
      existingMood.motivation = motivation;
      await existingMood.save();
      return res.status(200).json(existingMood);
    }

    // Create new mood entry
    const newMood = new Mood({
      userId,
      mood,
      motivation,
      dateString
    });

    await newMood.save();
    res.status(201).json(newMood);
  } catch (error) {
    console.error("Error saving mood:", error);
    res.status(500).json({ error: "Failed to save mood" });
  }
};

// Get today's mood for the user
export const getTodayMood = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    
    const mood = await Mood.findOne({ 
      userId, 
      dateString 
    });

    res.status(200).json(mood);
  } catch (error) {
    console.error("Error getting today's mood:", error);
    res.status(500).json({ error: "Failed to get today's mood" });
  }
};

// Get mood history for the user
export const getMoodHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 30 } = req.query; // Default to last 30 days
    
    const moods = await Mood.find({ userId })
      .sort({ date: -1 })
      .limit(parseInt(limit));

    res.status(200).json(moods);
  } catch (error) {
    console.error("Error getting mood history:", error);
    res.status(500).json({ error: "Failed to get mood history" });
  }
}; 