import User from "../models/User.js";
import Habit from "../models/Habit.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

const COOKIE_OPTIONS = {
  httpOnly: true, // Prevents JavaScript access
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'lax', // CSRF protection
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/' // Cookie is valid for all paths
};

export const signupUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Check if email or username exists
    const existingUser = await User.findOne({
      $or: [
        { email },
        { username: username.toLowerCase() }
      ]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ message: "Email already exists" });
      } else if (existingUser.username === username.toLowerCase()) {
        return res.status(400).json({ message: "Username already exists" });
      }
    }

    // Hash password
    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    // Create new user
    const newUser = new User({
      username: username.toLowerCase(),
      displayName: username,
      email,
      password: hashedPassword,
      profilePicture: 'default-profile.png',
      habitIds: [],
      taskIds: [],
      friends: [],
      friendRequests: [],
      isVacation: false,
      genStreakCount: 0,
      userTimeZone: req.body.timezone || "Africa/Nigeria"
    });

    await newUser.save();

    // Generate JWT token
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    // Set JWT in HTTP-only cookie
    res.cookie('token', token, COOKIE_OPTIONS);

    // Return user data without password with mapped field names
    const userToReturn = newUser.toObject();
    delete userToReturn.password;
    
    const userResponse = {
      ...userToReturn,
      date_joined: userToReturn.createdAt,
      longest_streak: userToReturn.longestStreak,
      recovery_points: userToReturn.recoveryPoints,
      is_vacation: userToReturn.isVacation
    };

    res.status(201).json({ user: userResponse });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, userTimeZone } = req.body;

    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      userTimeZone,
      profilePicture: 'default-profile.png',
      habitIds: [],
      taskIds: [],
      friends: [],
      friendRequests: [],
      isVacation: false,
      genStreakCount: 0
    });

    await newUser.save();

    const userToReturn = newUser.toObject();
    delete userToReturn.password;

    res.status(201).json(userToReturn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    console.log('Login attempt with body:', req.body);
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      console.log('Missing credentials:', { emailOrUsername: !!emailOrUsername, password: !!password });
      return res.status(400).json({ message: "Email/username and password are required." });
    }
    let user = await User.findOne({
      $or: [
        { email: emailOrUsername },
        { username: emailOrUsername.toLowerCase() }
      ]
    });

    if (!user) {
      console.log('User not found for:', emailOrUsername);
      return res.status(400).json({ message: "Email or username does not exist." });
    }

    const isMatch = await argon2.verify(user.password, password);
    if (!isMatch) {
      console.log('Password mismatch for user:', emailOrUsername);
      return res.status(400).json({ message: "Incorrect password." });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    // Set JWT in HTTP-only cookie
    res.cookie('token', token, COOKIE_OPTIONS);

    const userToReturn = user.toObject();
    delete userToReturn.password;

    // Format user response with mapped field names
    const userResponse = {
      ...userToReturn,
      date_joined: userToReturn.createdAt,
      longest_streak: userToReturn.longestStreak,
      recovery_points: userToReturn.recoveryPoints,
      is_vacation: userToReturn.isVacation
    };

    console.log('Login successful for user:', emailOrUsername);
    if (req.body.timezone) {
      await User.findByIdAndUpdate(user._id, {
        userTimeZone: req.body.timezone
      });
    }
    res.status(200).json({ user: userResponse });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: "An error occurred during login. Please try again." });
  }
};

export const logoutUser = async (req, res) => {
  try {
    // Clear the JWT cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Error during logout" });
  }
};

export const getUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('-password')
      .populate('friends', '-password')
      .populate('friendRequests', '-password');

    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    // Get user's habits to calculate statistics
    const habits = await Habit.find({ userId: user._id });
    const totalStreakDays = habits.reduce((total, habit) => total + habit.habitStreak, 0);

    // Format user object with mapped field names for frontend compatibility
    const userResponse = {
      ...user.toObject(),
      date_joined: user.createdAt,
      longest_streak: user.longestStreak,
      recovery_points: user.recoveryPoints,
      is_vacation: user.isVacation,
      totalStreakDays: totalStreakDays,
      totalHabits: habits.length
    };

    res.status(200).json(userResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Friend system endpoints
export const sendFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const { friendId } = req.body;

    const user = await User.findById(friendId);
    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    if (user.friendRequests.includes(userId)) {
      return res.status(400).json({ msg: "Friend request already sent." });
    }

    if (user.friends.includes(userId)) {
      return res.status(400).json({ msg: "Users are already friends." });
    }

    user.friendRequests.push(userId);
    await user.save();

    res.status(200).json({ msg: "Friend request sent successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const { friendId } = req.body;

    const [user, friend] = await Promise.all([
      User.findById(userId),
      User.findById(friendId)
    ]);

    if (!user || !friend) {
      return res.status(404).json({ msg: "User not found." });
    }

    // Remove friend request
    user.friendRequests = user.friendRequests.filter(id => id.toString() !== friendId);

    // Add to friends list for both users
    user.friends.push(friendId);
    friend.friends.push(userId);

    await Promise.all([user.save(), friend.save()]);

    res.status(200).json({ msg: "Friend request accepted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const rejectFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const { friendId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    user.friendRequests = user.friendRequests.filter(id => id.toString() !== friendId);
    await user.save();

    res.status(200).json({ msg: "Friend request rejected." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const removeFriend = async (req, res) => {
  try {
    const { userId } = req.params;
    const { friendId } = req.body;

    const [user, friend] = await Promise.all([
      User.findById(userId),
      User.findById(friendId)
    ]);

    if (!user || !friend) {
      return res.status(404).json({ msg: "User not found." });
    }

    user.friends = user.friends.filter(id => id.toString() !== friendId);
    friend.friends = friend.friends.filter(id => id.toString() !== userId);

    await Promise.all([user.save(), friend.save()]);

    res.status(200).json({ msg: "Friend removed successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const checkUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username: username.toLowerCase() });
    if (user) {
      return res.json({ available: false });
    }
    return res.json({ available: true });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    const { displayName, profilePicture } = req.body;

    // Validate displayName if provided
    if (displayName !== undefined) {
      if (!displayName.trim()) {
        return res.status(400).json({ message: "Display name cannot be empty." });
      }
      if (displayName.length > 50) {
        return res.status(400).json({ message: "Display name must be 50 characters or less." });
      }
    }

    // Build update object with only provided fields
    const updateData = {};
    if (displayName !== undefined) updateData.displayName = displayName.trim();
    if (profilePicture !== undefined) updateData.profilePicture = profilePicture;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    // Format response with mapped field names
    const userResponse = {
      ...updatedUser.toObject(),
      date_joined: updatedUser.createdAt,
      longest_streak: updatedUser.longestStreak,
      recovery_points: updatedUser.recoveryPoints,
      is_vacation: updatedUser.isVacation
    };

    res.status(200).json({ user: userResponse });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Failed to update profile." });
  }
};

export const toggleVacationMode = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Toggle vacation mode
    user.isVacation = !user.isVacation;
    await user.save();

    // Format response with mapped field names
    const userResponse = {
      ...user.toObject(),
      date_joined: user.createdAt,
      longest_streak: user.longestStreak,
      recovery_points: user.recoveryPoints,
      is_vacation: user.isVacation
    };

    res.status(200).json({ 
      user: userResponse,
      message: `Vacation mode ${user.isVacation ? 'enabled' : 'disabled'}.`
    });
  } catch (err) {
    console.error("Toggle vacation mode error:", err);
    res.status(500).json({ message: "Failed to toggle vacation mode." });
  }
};
