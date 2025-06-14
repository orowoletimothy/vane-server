import express from "express";
import { registerUser, loginUser, getUser } from "../controllers/auth.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);

router.get("/user/:userId", verifyToken, getUser);

export default router;
