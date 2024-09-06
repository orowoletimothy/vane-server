import express from "express";
import {
  createTask,
  updateTask,
  markCompleted,
  deleteTask,
} from "../controllers/task.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

router.post("/:userId/", verifyToken, createTask);
router.put("/:userId/:taskId", verifyToken, updateTask);
router.put("/:userId/:taskId/complete", verifyToken, markCompleted);
router.delete("/:userId/:taskId/", verifyToken, deleteTask);

export default router;
