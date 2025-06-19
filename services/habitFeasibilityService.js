import Habit from "../models/Habit.js";
import HabitCompletion from "../models/HabitCompletion.js";
import moment from "moment-timezone";

// Configuration constants for feasibility limits
const FEASIBILITY_CONFIG = {
  // Time slot limits (minutes per day)
  MAX_DAILY_HABIT_TIME: 180, // 3 hours
  MAX_WEEKLY_HABIT_TIME: 720, // 12 hours per week
  
  // Habit count limits
  MAX_DAILY_HABITS: 8,
  MAX_WEEKLY_HABITS: 15,
  
  // Completion rate thresholds
  MIN_COMPLETION_RATE: 0.7, // 70% success rate
  HIGH_COMPLETION_RATE: 0.85, // 85% success rate
  
  // Streak duration thresholds (days)
  MIN_STREAK_FOR_STACKING: 7,
  OPTIMAL_STREAK_FOR_STACKING: 21,
  
  // Time slot conflict window (minutes)
  TIME_CONFLICT_WINDOW: 30,
  
  // Default habit time estimates (minutes)
  DEFAULT_HABIT_TIME: 15,
  HABIT_TIME_BY_KEYWORD: {
    'workout': 45,
    'exercise': 45,
    'gym': 60,
    'run': 30,
    'jog': 30,
    'meditation': 20,
    'meditate': 20,
    'read': 30,
    'study': 45,
    'journal': 15,
    'write': 30,
    'cook': 30,
    'clean': 20,
    'water': 2,
    'vitamin': 1,
    'stretch': 10
  }
};

/**
 * Extract estimated time for a habit based on its title and description
 */
const estimateHabitTime = (title, notes = '') => {
  const text = `${title} ${notes}`.toLowerCase();
  
  // Check for explicit time mentions (e.g., "30 minutes", "1 hour")
  const timeMatch = text.match(/(\d+)\s*(min|minute|minutes|hour|hours|hr|hrs)/);
  if (timeMatch) {
    const value = parseInt(timeMatch[1]);
    const unit = timeMatch[2];
    if (unit.includes('hour') || unit.includes('hr')) {
      return value * 60;
    }
    return value;
  }
  
  // Check for keyword-based estimates
  for (const [keyword, time] of Object.entries(FEASIBILITY_CONFIG.HABIT_TIME_BY_KEYWORD)) {
    if (text.includes(keyword)) {
      return time;
    }
  }
  
  return FEASIBILITY_CONFIG.DEFAULT_HABIT_TIME;
};

/**
 * Calculate completion rate for a habit over the last N days
 */
const calculateCompletionRate = async (habitId, days = 30) => {
  const endDate = moment().endOf('day').toDate();
  const startDate = moment().subtract(days, 'days').startOf('day').toDate();
  
  const habit = await Habit.findById(habitId);
  if (!habit) return 0;
  
  // Get all completion records within the date range
  const completions = await HabitCompletion.find({
    habitId,
    date: { $gte: startDate, $lte: endDate }
  });
  
  // Calculate expected completions based on repeatDays
  const expectedDays = [];
  const current = moment(startDate);
  
  while (current.isSameOrBefore(endDate, 'day')) {
    const dayName = current.format('ddd');
    
    // If no repeat days specified, assume daily
    if (!habit.repeatDays || habit.repeatDays.length === 0 || habit.repeatDays.includes(dayName)) {
      expectedDays.push(current.format('YYYY-MM-DD'));
    }
    current.add(1, 'day');
  }
  
  // Count successful completions (where completed count >= target count)
  const successfulCompletions = completions.filter(
    completion => completion.completedCount >= habit.target_count
  ).length;
  
  return expectedDays.length > 0 ? successfulCompletions / expectedDays.length : 0;
};

/**
 * Calculate current streak for a habit
 */
const calculateCurrentStreak = async (habitId) => {
  const habit = await Habit.findById(habitId);
  if (!habit) return 0;
  
  return habit.habitStreak || 0;
};

/**
 * Check for time slot conflicts with existing habits
 */
const checkTimeConflicts = (newReminderTime, existingHabits) => {
  const newTime = moment(newReminderTime, 'HH:mm');
  const conflicts = [];
  
  existingHabits.forEach(habit => {
    const existingTime = moment(habit.reminderTime, 'HH:mm');
    const timeDiff = Math.abs(newTime.diff(existingTime, 'minutes'));
    
    if (timeDiff <= FEASIBILITY_CONFIG.TIME_CONFLICT_WINDOW) {
      conflicts.push({
        habitTitle: habit.title,
        reminderTime: habit.reminderTime,
        timeDifference: timeDiff
      });
    }
  });
  
  return conflicts;
};

/**
 * Calculate total weekly habit frequency
 */
const calculateWeeklyFrequency = (repeatDays) => {
  if (!repeatDays || repeatDays.length === 0) {
    return 7; // Daily habit
  }
  return repeatDays.length;
};

/**
 * Main feasibility check function
 */
export const checkHabitFeasibility = async (userId, newHabitData) => {
  try {
    const { title, reminderTime, repeatDays, target_count = 1, notes } = newHabitData;
    
    // Get all existing habits for the user
    const existingHabits = await Habit.find({ userId, status: { $ne: 'paused' } });
    
    const feasibilityResult = {
      feasible: true,
      confidence: 'high', // high, medium, low
      message: '✅ You\'re ready to add this habit.',
      warnings: [],
      suggestions: [],
      metrics: {
        currentHabitCount: existingHabits.length,
        estimatedTimeLoad: 0,
        avgCompletionRate: 0,
        avgStreakDuration: 0,
        timeConflicts: []
      }
    };
    
    // Estimate time for new habit
    const newHabitTime = estimateHabitTime(title, notes);
    const newWeeklyFreq = calculateWeeklyFrequency(repeatDays);
    const newWeeklyTime = newHabitTime * newWeeklyFreq;
    
    // Calculate current metrics
    let totalWeeklyTime = newWeeklyTime;
    let totalDailyHabits = repeatDays && repeatDays.length > 0 ? 0 : 1;
    let totalWeeklyHabits = newWeeklyFreq;
    
    const habitMetrics = await Promise.all(
      existingHabits.map(async (habit) => {
        const completionRate = await calculateCompletionRate(habit._id);
        const streak = await calculateCurrentStreak(habit._id);
        const habitTime = estimateHabitTime(habit.title, habit.notes);
        const weeklyFreq = calculateWeeklyFrequency(habit.repeatDays);
        
        totalWeeklyTime += habitTime * weeklyFreq;
        if (!habit.repeatDays || habit.repeatDays.length === 0) {
          totalDailyHabits += 1;
        }
        totalWeeklyHabits += weeklyFreq;
        
        return { completionRate, streak, habitTime, weeklyFreq };
      })
    );
    
    // Calculate averages
    if (habitMetrics.length > 0) {
      feasibilityResult.metrics.avgCompletionRate = 
        habitMetrics.reduce((sum, m) => sum + m.completionRate, 0) / habitMetrics.length;
      feasibilityResult.metrics.avgStreakDuration = 
        habitMetrics.reduce((sum, m) => sum + m.streak, 0) / habitMetrics.length;
    }
    
    feasibilityResult.metrics.currentHabitCount = existingHabits.length;
    feasibilityResult.metrics.estimatedTimeLoad = totalWeeklyTime;
    
    // Check time conflicts
    const timeConflicts = checkTimeConflicts(reminderTime, existingHabits);
    feasibilityResult.metrics.timeConflicts = timeConflicts;
    
    // Apply feasibility rules
    
    // Rule 1: Check habit count limits
    if (totalDailyHabits >= FEASIBILITY_CONFIG.MAX_DAILY_HABITS) {
      feasibilityResult.feasible = false;
      feasibilityResult.confidence = 'low';
      feasibilityResult.message = '❌ You have too many daily habits. Consider reducing frequency or pausing some habits.';
      return feasibilityResult;
    }
    
    if (totalWeeklyHabits >= FEASIBILITY_CONFIG.MAX_WEEKLY_HABITS) {
      feasibilityResult.feasible = false;
      feasibilityResult.confidence = 'low';
      feasibilityResult.message = '❌ Your weekly habit load is too high. Try reducing the frequency of this habit.';
      return feasibilityResult;
    }
    
    // Rule 2: Check time load limits
    if (totalWeeklyTime >= FEASIBILITY_CONFIG.MAX_WEEKLY_HABIT_TIME) {
      feasibilityResult.feasible = false;
      feasibilityResult.confidence = 'low';
      feasibilityResult.message = '❌ Adding this habit would exceed your weekly time budget. Consider shorter habits or reducing frequency.';
      return feasibilityResult;
    }
    
    const dailyTimeEstimate = totalWeeklyTime / 7;
    if (dailyTimeEstimate >= FEASIBILITY_CONFIG.MAX_DAILY_HABIT_TIME) {
      feasibilityResult.warnings.push('Your daily habit time is approaching the recommended limit.');
      feasibilityResult.confidence = 'medium';
    }
    
    // Rule 3: Check time conflicts
    if (timeConflicts.length > 0) {
      feasibilityResult.warnings.push(
        `Time conflict detected with: ${timeConflicts.map(c => c.habitTitle).join(', ')}`
      );
      feasibilityResult.suggestions.push(
        'Consider adjusting the reminder time to avoid conflicts with existing habits.'
      );
      feasibilityResult.confidence = 'medium';
    }
    
    // Rule 4: Check user readiness based on completion rates and streaks
    if (existingHabits.length > 0) {
      const { avgCompletionRate, avgStreakDuration } = feasibilityResult.metrics;
      
      if (avgCompletionRate < FEASIBILITY_CONFIG.MIN_COMPLETION_RATE) {
        feasibilityResult.feasible = false;
        feasibilityResult.confidence = 'low';
        feasibilityResult.message = '❌ Focus on improving your current habits before adding new ones. Your completion rate needs improvement.';
        feasibilityResult.suggestions.push(
          'Try to achieve at least 70% completion rate on your current habits before adding more.'
        );
        return feasibilityResult;
      }
      
      if (avgStreakDuration < FEASIBILITY_CONFIG.MIN_STREAK_FOR_STACKING) {
        feasibilityResult.feasible = false;
        feasibilityResult.confidence = 'medium';
        feasibilityResult.message = '⏳ Wait a bit longer before adding new habits. Let your current habits become more established.';
        feasibilityResult.suggestions.push(
          'Build a streak of at least 7 days on your current habits before adding new ones.'
        );
        return feasibilityResult;
      }
      
      if (avgCompletionRate < FEASIBILITY_CONFIG.HIGH_COMPLETION_RATE || 
          avgStreakDuration < FEASIBILITY_CONFIG.OPTIMAL_STREAK_FOR_STACKING) {
        feasibilityResult.confidence = 'medium';
        feasibilityResult.message = '⚠️ You can add this habit, but consider waiting for better consistency.';
        feasibilityResult.warnings.push(
          'Your current habits could be more established before adding new ones.'
        );
      }
    }
    
    // Rule 5: Provide positive reinforcement for good metrics
    if (feasibilityResult.metrics.avgCompletionRate >= FEASIBILITY_CONFIG.HIGH_COMPLETION_RATE &&
        feasibilityResult.metrics.avgStreakDuration >= FEASIBILITY_CONFIG.OPTIMAL_STREAK_FOR_STACKING) {
      feasibilityResult.message = '🌟 Excellent! Your consistency makes you ready for a new challenge.';
      feasibilityResult.confidence = 'high';
    }
    
    return feasibilityResult;
    
  } catch (error) {
    console.error('Error checking habit feasibility:', error);
    return {
      feasible: true, // Default to allowing if check fails
      confidence: 'low',
      message: '⚠️ Could not fully evaluate feasibility, but you can proceed.',
      warnings: ['Feasibility check encountered an error.'],
      suggestions: [],
      metrics: {}
    };
  }
};

export default { checkHabitFeasibility };
