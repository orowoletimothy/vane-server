import Notification from "../models/Notification.js";
import Habit from "../models/Habit.js";
import User from "../models/User.js";
import moment from "moment-timezone";
import webpush from "web-push";

// Get all notifications for a user
export const getUserNotifications = async (req, res) => {
    try {
        const { userId } = req.params;
        // Fetch notifications and populate habitId
        let notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .populate('habitId', 'title status');

        // Filter: only include notifications for habits that are incomplete (if habitId exists)
        notifications = notifications.filter(n => {
            // If notification has a habitId, check its status
            if (n.habitId && n.habitId.status !== undefined) {
                return n.habitId.status === 'incomplete';
            }
            // If not related to a habit, include (e.g., friend requests, streak milestones)
            return true;
        });

        res.status(200).json(notifications);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// Mark notification as read
export const markNotificationRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ msg: "Notification not found" });
        }

        res.status(200).json(notification);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// Delete notification
export const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const notification = await Notification.findByIdAndDelete(notificationId);

        if (!notification) {
            return res.status(404).json({ msg: "Notification not found" });
        }

        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// Schedule notifications for a habit
export const scheduleHabitNotifications = async (habitId) => {
    try {
        const habit = await Habit.findById(habitId).populate('userId', 'userTimeZone');
        if (!habit) {
            throw new Error('Habit not found');
        }

        const userTimezone = habit.userId.userTimeZone || 'UTC';
        const [hours, minutes] = habit.reminderTime.split(':');

        // Calculate next reminder time in user's timezone
        const nextReminder = moment().tz(userTimezone)
            .set('hours', parseInt(hours))
            .set('minutes', parseInt(minutes))
            .set('seconds', 0);

        // If the time has passed for today, schedule for tomorrow
        if (nextReminder.isBefore(moment())) {
            nextReminder.add(1, 'day');
        }

        // For weekly habits, check if the next reminder day is in repeatDays
        if (habit.goal === 'weekly' && habit.repeatDays.length > 0) {
            while (!habit.repeatDays.includes(nextReminder.format('dddd'))) {
                nextReminder.add(1, 'day');
            }
        }

        // Create notification
        const notification = new Notification({
            userId: habit.userId._id,
            habitId: habit._id,
            title: "Habit Reminder",
            message: `Time to complete your habit: ${habit.title}`,
            scheduledFor: nextReminder.toDate(),
            type: "HABIT_REMINDER"
        });

        await notification.save();
        return notification;
    } catch (err) {
        console.error('Error scheduling notification:', err);
        throw err;
    }
};

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BLBz5U6_3VsHksHbxwJr9TX_QQrCdGqhDxpWbQl9FCohPh9-xHmAYla2xTF2Y_LGYb2tSGzSK3hDV6pcHOBcIQM';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'Fwp-ecLcjVDTpOmyA5dY_FYQJQkSFzKBSJEFQwGrW_A';

webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL || 'example@example.com'),
    vapidPublicKey,
    vapidPrivateKey
);

// Save push subscription for a user
export const savePushSubscription = async (req, res) => {
    try {
        const { userId } = req.params;
        const subscription = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ message: "Invalid subscription object" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.pushSubscription = subscription;
        await user.save();

        res.status(201).json({ message: "Push subscription saved successfully" });
    } catch (err) {
        console.error("Error saving push subscription:", err);
        res.status(500).json({ message: "Error saving push subscription" });
    }
};

// Update notification preferences
export const updateNotificationPreferences = async (req, res) => {
    try {
        const { userId } = req.params;
        const preferences = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (preferences.friendRequests !== undefined) {
            user.notificationPreferences.friendRequests = preferences.friendRequests;
        }
        if (preferences.habitReminders !== undefined) {
            user.notificationPreferences.habitReminders = preferences.habitReminders;
        }
        if (preferences.streakMilestones !== undefined) {
            user.notificationPreferences.streakMilestones = preferences.streakMilestones;
        }

        await user.save();

        res.status(200).json(user.notificationPreferences);
    } catch (err) {
        console.error("Error updating notification preferences:", err);
        res.status(500).json({ message: "Error updating notification preferences" });
    }
};

// Send push notification to a user
const sendPushNotification = async (userId, title, message, data = {}) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.pushSubscription) {
            return false;
        }

        const payload = JSON.stringify({
            title,
            message,
            ...data
        });

        await webpush.sendNotification(user.pushSubscription, payload);
        return true;
    } catch (err) {
        console.error(`Error sending push notification to user ${userId}:`, err);
        return false;
    }
};

// Process pending notifications
export const processPendingNotifications = async () => {
    try {
        const now = new Date();
        const pendingNotifications = await Notification.find({
            status: "PENDING",
            scheduledFor: { $lte: now }
        }).populate('userId').populate('habitId');

        for (const notification of pendingNotifications) {
            try {
                // Send push notification if user has subscription
                if (notification.userId && notification.userId.pushSubscription) {
                    const notificationType = notification.type;
                    const preferences = notification.userId.notificationPreferences;

                    // Check if user has enabled this type of notification
                    let shouldSend = false;
                    if (notificationType === "HABIT_REMINDER" && preferences.habitReminders) {
                        shouldSend = true;
                    } else if (notificationType === "FRIEND_REQUEST" && preferences.friendRequests) {
                        shouldSend = true;
                    } else if (notificationType === "STREAK_MILESTONE" && preferences.streakMilestones) {
                        shouldSend = true;
                    }

                    if (shouldSend) {
                        await sendPushNotification(
                            notification.userId._id,
                            notification.title,
                            notification.message,
                            { notificationId: notification._id.toString() }
                        );
                    }
                }

                // Mark as sent
                notification.status = "SENT";
                await notification.save();

                // Schedule next notification if it's a habit reminder
                if (notification.type === "HABIT_REMINDER") {
                    await scheduleHabitNotifications(notification.habitId._id);
                }
            } catch (err) {
                console.error(`Failed to process notification ${notification._id}:`, err);
                notification.status = "FAILED";
                await notification.save();
            }
        }
    } catch (err) {
        console.error('Error processing notifications:', err);
    }
};

export const sendEncouragementNote = async (req, res) => {
    try {
        const { recipientId } = req.params;
        const { senderId, note } = req.body;
        if (!senderId || !note) {
            return res.status(400).json({ message: "Sender and note content are required" });
        }
        const sender = await User.findById(senderId);
        if (!sender) {
            return res.status(404).json({ message: "Sender not found" });
        }
        const notification = new Notification({
            userId: recipientId,
            title: `Note from ${sender.displayName || sender.username}`,
            message: note,
            type: "ENCOURAGEMENT_NOTE",
            isRead: false,
            scheduledFor: new Date(),
            status: "SENT"
        });
        await notification.save();
        res.status(201).json({ message: "Encouragement note sent as notification" });
    } catch (err) {
        console.error("Error sending encouragement note:", err);
        res.status(500).json({ message: "Error sending encouragement note" });
    }
};