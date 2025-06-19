import Habit from "../models/Habit.js";
import User from "../models/User.js";
import HabitCompletion from "../models/HabitCompletion.js";
import moment from "moment-timezone";
import { scheduleHabitNotifications } from "./notification.js";
import { checkHabitFeasibility } from "../services/habitFeasibilityService.js";

export const createHabit = async (req, res) => {
  try {
    let { title, icon, reminderTime, repeatDays, target_count, is_public, isPublic, notes, skipFeasibilityCheck } = req.body;
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

    // Perform feasibility check unless explicitly skipped
    if (!skipFeasibilityCheck) {
      const feasibilityResult = await checkHabitFeasibility(userId, {
        title,
        reminderTime,
        repeatDays,
        target_count,
        notes
      });

      // If not feasible, return the result without creating the habit
      if (!feasibilityResult.feasible) {
        return res.status(409).json({
          msg: "Habit not feasible",
          feasibility: feasibilityResult
        });
      }

      // If feasible but with warnings, include them in the response
      if (feasibilityResult.warnings.length > 0 || feasibilityResult.confidence !== 'high') {
        // Store feasibility info for inclusion in success response
        req.feasibilityResult = feasibilityResult;
      }
    }

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

    const response = { 
      result: newHabit, 
      msg: "Habit created successfully." 
    };

    // Include feasibility information if it was checked and has warnings
    if (req.feasibilityResult) {
      response.feasibility = req.feasibilityResult;
    }

    res.status(201).json(response);
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

    const today = moment().startOf('day').toDate();

    if (status === "complete" && habit.status !== "complete") {
      // Mark habit as complete
      habit.lastCompleted = new Date();
      habit.habitStreak += 1;

      // Record the completion in HabitCompletion collection
      try {
        const completion = await HabitCompletion.findOneAndUpdate(
          { 
            habitId: habitId, 
            date: today 
          },
          {
            $inc: { completedCount: 1 },
            $setOnInsert: {
              userId: userId,
              habitId: habitId,
              date: today,
              completedAt: new Date() // Record when it was completed
            },
            $set: {
              completedAt: new Date() // Update timestamp on subsequent completions
            }
          },
          {
            upsert: true,
            new: true
          }
        );
        console.log(`Recorded completion for habit ${habitId} on ${today}. Total: ${completion.completedCount}/${habit.target_count}`);
      } catch (completionError) {
        console.error("Error recording habit completion:", completionError);
        // Continue even if completion recording fails
      }
    }

    if (status === "paused") {
      habit.status = "paused";
    }

    if (habit.status === "complete" && status === "incomplete") {
      // Uncomplete the habit
      if (habit.habitStreak > 0) {
        habit.habitStreak -= 1;
      }

      // Remove or decrease completion count for today
      try {
        const completion = await HabitCompletion.findOne({
          habitId: habitId,
          date: today
        });

        if (completion) {
          if (completion.completedCount > 1) {
            completion.completedCount -= 1;
            await completion.save();
          } else {
            await HabitCompletion.deleteOne({ _id: completion._id });
          }
          console.log(`Removed completion for habit ${habitId} on ${today}`);
        }
      } catch (completionError) {
        console.error("Error removing habit completion:", completionError);
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

// Function to update user's general streak based on completion status
export const updateUserGeneralStreak = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user || user.isVacation) return; // Don't update streaks for users on vacation

    const timezone = user.userTimeZone || 'Africa/Lagos';
    const currentDay = moment().tz(timezone).format("ddd");
    const today = moment().tz(timezone).startOf('day');

    // Get today's habits that should be active (non-paused, scheduled for today)
    const habits = await Habit.find({
      userId,
      status: { $in: ['incomplete', 'complete', 'paused'] },
      $or: [
        { repeatDays: { $size: 0 } }, // Daily habits
        { repeatDays: currentDay }     // Habits scheduled for today
      ]
    });

    const nonPausedHabits = habits.filter(habit => habit.status !== 'paused');
    const allComplete = nonPausedHabits.length > 0 && nonPausedHabits.every(habit => habit.status === 'complete');

    const lastIncrement = user.lastStreakIncrement ? moment(user.lastStreakIncrement).tz(timezone).startOf('day') : null;

    if (allComplete) {
      if (!lastIncrement || !lastIncrement.isSame(today)) {
        // Not incremented today, so increment it
        const previousStreak = user.genStreakCount;
        user.genStreakCount += 1;
        user.lastStreakIncrement = today.toDate();
        if (user.genStreakCount > user.longestStreak) {
          user.longestStreak = user.genStreakCount;
        }
        await user.save();
        console.log(`Incremented general streak for user ${userId}: ${previousStreak} → ${user.genStreakCount}`);
      }
    } else {
      if (lastIncrement && lastIncrement.isSame(today)) {
        // Was incremented today, but now not all habits are complete, so decrement
        const previousStreak = user.genStreakCount;
        user.genStreakCount = Math.max(0, user.genStreakCount - 1);
        user.lastStreakIncrement = null; // Allow re-increment today
        await user.save();
        console.log(`Decremented general streak for user ${userId}: ${previousStreak} → ${user.genStreakCount}`);
      }
    }
  } catch (err) {
    console.error("Error updating user's general streak:", err);
  }
};

// Helper function to check if all habits were completed on a specific day
const checkDayCompletion = async (userId, targetDate, timezone) => {
  try {
    const dayName = targetDate.format("ddd");
    const dateStart = targetDate.toDate();
    const dateEnd = moment(targetDate).endOf('day').toDate();

    // Get habits that were active on that day
    const habits = await Habit.find({
      userId,
      createdAt: { $lte: dateEnd }, // Only habits that existed on that day
      $or: [
        { repeatDays: { $size: 0 } }, // Daily habits
        { repeatDays: dayName }        // Habits scheduled for that day
      ]
    });

    if (habits.length === 0) return true; // No habits = considered complete

    // Check completions for each habit on that day
    for (const habit of habits) {
      const completion = await HabitCompletion.findOne({
        habitId: habit._id,
        userId,
        date: {
          $gte: dateStart,
          $lte: dateEnd
        }
      });

      // If any habit wasn't completed (or doesn't meet target), day is incomplete
      if (!completion || completion.completedCount < habit.target_count) {
        return false;
      }
    }

    return true; // All habits were completed
  } catch (error) {
    console.error("Error checking day completion:", error);
    return false;
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
      user.todayStreakEarned = undefined; // Reset today's streak status for new day
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
    if (!userId)
      return res.status(400).json({ msg: "Parameter is not present" });

    const user = await User.findById(userId).select('userTimeZone');
    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    const habits = await Habit.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json(habits);
  } catch (err) {
    console.error("Error getting user habits:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getHabitCompletionHistory = async (req, res) => {
  try {
    const { userId, habitId } = req.params;
    const { days = 180 } = req.query; // Default to 180 days

    if (!userId || !habitId)
      return res.status(400).json({ msg: "Parameters are missing" });

    const habit = await Habit.findOne({ _id: habitId, userId });
    if (!habit) {
      return res.status(404).json({ msg: "Habit not found." });
    }

    // Calculate date range
    const endDate = moment().endOf('day').toDate();
    const startDate = moment().subtract(parseInt(days), 'days').startOf('day').toDate();

    // Get actual completion data from the database
    const completions = await HabitCompletion.find({
      habitId: habitId,
      userId: userId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).select('date completedCount');

    // Create a map of date -> completion count
    const completionMap = {};
    completions.forEach(completion => {
      const dateStr = moment(completion.date).format('YYYY-MM-DD');
      completionMap[dateStr] = completion.completedCount;
    });

    // Build the complete data structure with all dates
    const completionData = {};
    const today = moment();

    for (let i = parseInt(days); i >= 0; i--) {
      const date = moment(today).subtract(i, 'days');
      const dateStr = date.format('YYYY-MM-DD');

      // Only include completion data if the date is after the habit was created
      const habitCreatedDate = moment(habit.createdAt);
      if (date.isSameOrAfter(habitCreatedDate, 'day')) {
        completionData[dateStr] = completionMap[dateStr] || 0;
      } else {
        // Don't show any data for dates before the habit existed
        completionData[dateStr] = null;
      }
    }

    res.status(200).json({
      habitId,
      habitTitle: habit.title,
      targetCount: habit.target_count,
      completionData,
      totalDays: Object.keys(completionData).filter(key => completionData[key] !== null).length,
      completedDays: Object.values(completionData).filter(count => count > 0).length
    });
  } catch (err) {
    console.error("Error getting habit completion history:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getUserPerformanceAnalytics = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 90 } = req.query; // Default to 90 days for analytics

    if (!userId)
      return res.status(400).json({ msg: "User ID is missing" });

    // Calculate date range
    const endDate = moment().endOf('day').toDate();
    const startDate = moment().subtract(parseInt(days), 'days').startOf('day').toDate();

    // Get all completions for the user in the date range
    const completions = await HabitCompletion.find({
      userId: userId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).select('completedAt date habitId');

    // Get user's habits for context
    const habits = await Habit.find({ userId }).select('target_count');
    const habitTargets = {};
    habits.forEach(habit => {
      habitTargets[habit._id.toString()] = habit.target_count;
    });

    // Initialize analytics data
    const timeOfDayStats = {
      morning: { completed: 0, total: 0 }, // 6-12
      afternoon: { completed: 0, total: 0 }, // 12-18
      evening: { completed: 0, total: 0 } // 18-24
    };

    const dayOfWeekStats = {
      0: { completed: 0, total: 0 }, // Sunday
      1: { completed: 0, total: 0 }, // Monday
      2: { completed: 0, total: 0 }, // Tuesday
      3: { completed: 0, total: 0 }, // Wednesday
      4: { completed: 0, total: 0 }, // Thursday
      5: { completed: 0, total: 0 }, // Friday
      6: { completed: 0, total: 0 }  // Saturday
    };

    // Process completions
    completions.forEach(completion => {
      const completionTime = moment(completion.completedAt);
      const hour = completionTime.hour();
      const dayOfWeek = completionTime.day();
      const target = habitTargets[completion.habitId.toString()] || 1;

      // Time of day analysis
      let timeSlot;
      if (hour >= 6 && hour < 12) {
        timeSlot = 'morning';
      } else if (hour >= 12 && hour < 18) {
        timeSlot = 'afternoon';
      } else {
        timeSlot = 'evening';
      }

      timeOfDayStats[timeSlot].completed += 1;
      timeOfDayStats[timeSlot].total += target;

      // Day of week analysis
      dayOfWeekStats[dayOfWeek].completed += 1;
      dayOfWeekStats[dayOfWeek].total += target;
    });

    // Calculate percentages
    const timeOfDayPercentages = {};
    Object.keys(timeOfDayStats).forEach(timeSlot => {
      const stats = timeOfDayStats[timeSlot];
      timeOfDayPercentages[timeSlot] = stats.total > 0
        ? Math.round((stats.completed / stats.total) * 100)
        : 0;
    });

    const dayOfWeekPercentages = {};
    Object.keys(dayOfWeekStats).forEach(day => {
      const stats = dayOfWeekStats[day];
      dayOfWeekPercentages[day] = stats.total > 0
        ? Math.round((stats.completed / stats.total) * 100)
        : 0;
    });

    res.status(200).json({
      timeOfDay: {
        morning: timeOfDayPercentages.morning,
        afternoon: timeOfDayPercentages.afternoon,
        evening: timeOfDayPercentages.evening
      },
      dayOfWeek: {
        sunday: dayOfWeekPercentages[0],
        monday: dayOfWeekPercentages[1],
        tuesday: dayOfWeekPercentages[2],
        wednesday: dayOfWeekPercentages[3],
        thursday: dayOfWeekPercentages[4],
        friday: dayOfWeekPercentages[5],
        saturday: dayOfWeekPercentages[6]
      },
      totalCompletions: completions.length,
      dateRange: {
        start: startDate,
        end: endDate,
        days: parseInt(days)
      }
    });
  } catch (err) {
    console.error("Error getting user performance analytics:", err);
    res.status(500).json({ error: err.message });
  }
};

// Function to check and reset streaks for users who missed days
export const checkAndResetMissedStreaks = async () => {
  try {
    console.log("Running daily streak check...");
    
    // Get all users with active streaks (excluding vacation mode users)
    const users = await User.find({ 
      genStreakCount: { $gt: 0 },
      isVacation: { $ne: true } // Don't reset streaks for users on vacation
    }).select('_id genStreakCount userTimeZone lastStreakUpdate isVacation');

    for (const user of users) {
      const timezone = user.userTimeZone || 'Africa/Lagos';
      const today = moment().tz(timezone).startOf('day');
      const yesterday = moment().tz(timezone).subtract(1, 'day').startOf('day');
      
      // Check if user updated streak yesterday
      const lastStreakUpdate = user.lastStreakUpdate ? 
        moment(user.lastStreakUpdate).tz(timezone).startOf('day') : null;
      
      // If last update was not yesterday and not today, check if yesterday was completed
      if (!lastStreakUpdate || (!lastStreakUpdate.isSame(yesterday) && !lastStreakUpdate.isSame(today))) {
        const yesterdayCompleted = await checkDayCompletion(user._id, yesterday, timezone);
        
        if (!yesterdayCompleted) {
          // Reset streak as user missed yesterday
          user.genStreakCount = 0;
          user.lastStreakUpdate = null;
          await user.save();
          console.log(`Reset streak for user ${user._id} due to missed day`);
        }
      }
    }
    
    console.log("Daily streak check completed");
  } catch (error) {
    console.error("Error in daily streak check:", error);
  }
};

// Check habit feasibility before creation
export const checkHabitFeasibilityEndpoint = async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, reminderTime, repeatDays, target_count, notes } = req.body;

    if (!userId) {
      return res.status(400).json({ msg: "User id is not present" });
    }

    if (!title || !reminderTime) {
      return res.status(400).json({
        msg: "Missing required fields for feasibility check",
        details: {
          missing: {
            title: !title,
            reminderTime: !reminderTime
          }
        }
      });
    }

    const feasibilityResult = await checkHabitFeasibility(userId, {
      title,
      reminderTime,
      repeatDays,
      target_count,
      notes
    });

    res.status(200).json({
      msg: "Feasibility check completed",
      feasibility: feasibilityResult
    });

  } catch (err) {
    console.error("Error checking habit feasibility:", err);
    res.status(500).json({ 
      error: err.message,
      feasibility: {
        feasible: true,
        confidence: 'low',
        message: '⚠️ Could not fully evaluate feasibility, but you can proceed.',
        warnings: ['Feasibility check encountered an error.'],
        suggestions: [],
        metrics: {}
      }
    });
  }
};

// Test function to verify streak logic (remove this in production)
export const testStreakLogic = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const timezone = user.userTimeZone || 'Africa/Lagos';
    const currentDay = moment().tz(timezone).format("ddd");
    
    // Get today's habits
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

    res.status(200).json({
      userId,
      currentStreak: user.genStreakCount,
      todayStreakEarned: user.todayStreakEarned,
      lastStreakUpdate: user.lastStreakUpdate,
      totalHabits: habits.length,
      nonPausedHabits: nonPausedHabits.length,
      completedHabits: nonPausedHabits.filter(h => h.status === 'complete').length,
      allComplete,
      habitStatuses: nonPausedHabits.map(h => ({
        title: h.title,
        status: h.status,
        target: h.target_count
      }))
    });
  } catch (err) {
    console.error("Error in test streak logic:", err);
    res.status(500).json({ error: err.message });
  }
};
