import Habit from "../models/Habit.js";
import User from "../models/User.js";
import moment from "moment-timezone";
import { scheduleHabitNotifications } from "./notification.js";

export const createHabit = async (req, res) => {
  try {
    let { title, icon, reminderTime, repeatDays, target_count, is_public, isPublic, notes } = req.body;
    const { userId } = req.params;

    // Handle both is_public and isPublic for backward compatibility
    const publicStatus = is_public !== undefined ? is_public : isPublic;

    console.log('Received habit creation request:', { title, icon, reminderTime, repeatDays, target_count, is_public, isPublic, notes, userId });

    if (!title || !reminderTime) {
      return res.status(400).json({
        msg: "Missing required fields",
        details: {
          missing: {
            title: !title,
            reminderTime: !reminderTime
          }
        }
      });
    }
    if (!userId) return res.status(400).json({ msg: "User id is not present" });

    if (req.body.timezone) {
      await User.findByIdAndUpdate(userId, {
        userTimeZone: req.body.timezone
      });
    }

    const newHabit = new Habit({
      title,
      reminderTime,
      repeatDays: repeatDays || [],
      userId,
      habitStreak: 0,
      status: 'incomplete',
      icon,
      target_count,
      is_public: publicStatus,
      notes
    });

    try {
      await newHabit.validate();
    } catch (err) {
      console.error("Validation error:", err.errors);
      throw err;
    }

    await newHabit.save();

    // Update user's habitIds array
    await User.findByIdAndUpdate(userId, {
      $push: { habitIds: newHabit._id }
    });

    // Schedule notification for the new habit
    await scheduleHabitNotifications(newHabit._id);

    res.status(201).json({ result: newHabit, msg: "Habit created successfully." });
  } catch (err) {
    console.error("Error creating habit:", err);
    res.status(500).json({ error: err.message });
  }
};

export const updateHabit = async (req, res) => {
  try {
    const { title, reminderTime, repeatDays, icon, target_count, is_public, notes } = req.body;
    const { userId, habitId } = req.params;

    if (!title || !reminderTime)
      return res.status(400).json({ msg: "Fill in the required fields" });
    if (!userId) return res.status(400).json({ msg: "User id is not present" });

    const updateFields = {
      title,
      reminderTime,
      repeatDays,
      icon,
      target_count,
      is_public,
      notes
    };

    const updatedHabit = await Habit.findOneAndUpdate(
      { _id: habitId, userId },
      updateFields,
      { new: true }
    );

    if (!updatedHabit) {
      return res.status(400).json({ msg: "Habit not found." });
    }

    // Reschedule notification with updated time
    await scheduleHabitNotifications(updatedHabit._id);

    res.status(200).json({ result: updatedHabit, msg: "Habit updated successfully." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteHabit = async (req, res) => {
  try {
    const { userId, habitId } = req.params;
    if (!userId || !habitId)
      return res.status(400).json({ msg: "Parameter is absent." });

    const deletedHabit = await Habit.findOneAndDelete({ _id: habitId, userId });
    if (!deletedHabit) {
      return res.status(404).json({ msg: "Habit not found." });
    }

    // Remove habit from user's habitIds array
    await User.findByIdAndUpdate(userId, {
      $pull: { habitIds: habitId }
    });

    res.status(204).json({ msg: "Habit deleted successfully." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

export const setHabitStatus = async (req, res) => {
  try {
    const { userId, habitId } = req.params;
    const { status } = req.body;
    if (!userId || !habitId)
      return res.status(400).json({ msg: "Parameter is absent." });
    if (!status || !["complete", "incomplete", "paused"].includes(status))
      return res.status(400).json({ msg: "Invalid or missing status value. Use 'complete', 'incomplete', or 'paused'." });

    const habit = await Habit.findOne({ _id: habitId, userId });
    if (!habit) {
      return res.status(404).json({ msg: "Habit not found." });
    }

    if (status === "complete" && habit.status === "incomplete") {
      habit.lastCompleted = new Date();
      habit.habitStreak += 1;
    }
    if (status === "paused") {
      habit.status = "paused"
    }
    if (habit.status === "complete" && status === "incomplete") {
      // Ensure streak doesn't go below 0
      if (habit.habitStreak > 0) {
        habit.habitStreak -= 1;
      }

      const today = moment().startOf('day');
      const lastCompletedDate = moment(habit.lastCompleted).startOf('day');
      if (!lastCompletedDate.isSame(today)) {
        habit.lastCompleted = habit.lastCompleted; // Clear if not today
      }
    }

    habit.status = status;
    await habit.save();

    await updateUserGeneralStreak(userId);

    res.status(200).json({
      result: habit,
      msg: `Habit status updated to ${status}.`
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

// Function to update user's general streak if all non-paused habits are complete
export const updateUserGeneralStreak = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const timezone = user.userTimeZone || 'Africa/Lagos';
    const currentDay = moment().tz(timezone).format("ddd");

    const habits = await Habit.find({
      userId,
      status: { $in: ['incomplete', 'complete', 'paused'] },
      $or: [
        { repeatDays: { $size: 0 } },
        { repeatDays: currentDay }
      ]
    });

    const nonPausedHabits = habits.filter(habit => habit.status !== 'paused');
    const allComplete = nonPausedHabits.length > 0 && nonPausedHabits.every(habit => habit.status === 'complete');

    if (allComplete) {
      user.genStreakCount += 1;
      await user.save();
      console.log(`Updated general streak for user ${userId} to ${user.genStreakCount}`);
    }
  } catch (err) {
    console.error("Error updating user's general streak:", err);
  }
};

export const getUserHabitsToday = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId)
      return res.status(400).json({ msg: "Parameter is not present" });

    const user = await User.findById(userId).select('userTimeZone');
    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    const timezone = user.userTimeZone || 'Africa/Lagos';
    const currentTime = moment().tz(timezone);
    const currentDay = currentTime.format("ddd");
    console.log("Current day: ", currentDay);

    // Check if it's a new day and reset habit statuses if necessary
    const lastReset = user.lastHabitReset ? moment(user.lastHabitReset).tz(timezone).startOf('day') : moment().tz(timezone).startOf('day');
    const today = currentTime.startOf('day');
    if (lastReset.isBefore(today)) {
      await Habit.updateMany(
        { userId, status: "complete" },
        { $set: { status: "incomplete" } }
      );
      user.lastHabitReset = new Date();
      await user.save();
      console.log(`Reset habit statuses for user ${userId} on new day`);
    }

    const habits = await Habit.find({
      userId,
      $or: [
        { repeatDays: { $size: 0 } },
        { repeatDays: currentDay }
      ]
    });
    console.log(habits)

    res.status(200).json(habits);
  } catch (err) {
    console.error("Error getting today's habits:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getUserPublicHabits = async (req, res) => {
  try {
    const { userId } = req.params;
    const habits = await Habit.find({ userId, is_public: true }).select('icon title _id habitStreak');
    res.status(200).json(habits.map(h => ({
      _id: h._id,
      icon: h.icon,
      title: h.title,
      streak: h.habitStreak
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const getAllUserHabits = async (req, res) => {
  try {
    const { userId } = req.params;
    const habits = await Habit.find({ userId });
    res.status(200).json(habits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
