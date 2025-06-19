import express from "express";
import {
    getUserNotifications,
    markNotificationRead,
    deleteNotification,
    savePushSubscription,
    updateNotificationPreferences
} from "../controllers/notification.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

// Get all notifications for a user
router.get("/:userId", verifyToken, getUserNotifications);

// Mark notification as read
router.put("/:notificationId/read", verifyToken, markNotificationRead);

// Delete notification
router.delete("/:notificationId", verifyToken, deleteNotification);

// Save push subscription for a user
router.post("/:userId/push-subscription", verifyToken, savePushSubscription);

// Update notification preferences
router.put("/:userId/preferences", verifyToken, updateNotificationPreferences);

export default router;