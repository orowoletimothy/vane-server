import express from "express";
import { saveMood, getTodayMood, getMoodHistory } from "../controllers/mood.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

// All mood routes require authentication
router.use(verifyToken);

// POST /api/mood - Save today's mood
router.post("/", saveMood);

// GET /api/mood/today - Get today's mood
router.get("/today", getTodayMood);

// GET /api/mood/history - Get mood history
router.get("/history", getMoodHistory);

export default router; 