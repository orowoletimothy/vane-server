import express from "express";
import {
  createHabit,
  updateHabit,
  deleteHabit,
  markComplete,
  getUserHabitsToday,
} from "../controllers/habit.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

//get routes
router.get("/:userId/today", verifyToken, getUserHabitsToday);

//  create routes
router.post("/:userId", verifyToken, createHabit);

// update routes
router.put("/:userId/:habitId", verifyToken, updateHabit);
router.put("/:userId/:habitId/complete", verifyToken, markComplete);

//delete endpoint
router.delete("/:userId/:habitId", verifyToken, deleteHabit);

export default router;
