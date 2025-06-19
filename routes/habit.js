import express from "express";
import {
  createHabit,
  updateHabit,
  deleteHabit,
  setHabitStatus,
  getUserHabitsToday,
  getAllUserHabits,
  getHabitCompletionHistory,
  getUserPerformanceAnalytics,
  getUserPublicHabits,
  getAllUserHabits,
} from "../controllers/habit.js";
import verifyToken from "../middleware/auth.js";
import { updateTimezone } from "../middleware/timezone.js";

const router = express.Router();

//get routes
router.get("/:userId/today", updateTimezone, verifyToken, getUserHabitsToday);
router.get("/:userId/all", verifyToken, getAllUserHabits);
router.get("/:userId/:habitId/history", verifyToken, getHabitCompletionHistory);
router.get("/:userId/analytics", verifyToken, getUserPerformanceAnalytics);
router.get("/:userId/public", getUserPublicHabits);
router.get("/:userId/all", getAllUserHabits);

//  create routes
router.post("/:userId", verifyToken, createHabit);

// update routes
router.put("/:userId/:habitId", verifyToken, updateHabit);
router.put("/:userId/:habitId/status", verifyToken, setHabitStatus);

//delete endpoint
router.delete("/:userId/:habitId", verifyToken, deleteHabit);

export default router;
