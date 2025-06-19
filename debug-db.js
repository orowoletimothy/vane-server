import mongoose from 'mongoose';
import HabitCompletion from './models/HabitCompletion.js';
import Habit from './models/Habit.js';
import User from './models/User.js';

async function debugDatabase() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/streaks');
    console.log('Connected to MongoDB');
    
    console.log('\n=== RECENT HABIT COMPLETIONS ===');
    const completions = await HabitCompletion.find({}).sort({date: -1}).limit(10);
    console.log('Found', completions.length, 'completions');
    completions.forEach(c => {
      console.log(`- ${c.date} | Habit: ${c.habitId} | Count: ${c.completedCount} | User: ${c.userId}`);
    });
    
    console.log('\n=== RECENT HABITS ===');
    const habits = await Habit.find({}).sort({updatedAt: -1}).limit(5);
    console.log('Found', habits.length, 'habits');
    habits.forEach(h => {
      console.log(`- ID: ${h._id} | Title: ${h.title} | Status: ${h.status} | User: ${h.userId}`);
    });
    
    console.log('\n=== USERS ===');
    const users = await User.find({}).limit(3);
    console.log('Found', users.length, 'users');
    users.forEach(u => {
      console.log(`- User: ${u._id} | Timezone: ${u.userTimeZone}`);
    });
    
    mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

debugDatabase(); 