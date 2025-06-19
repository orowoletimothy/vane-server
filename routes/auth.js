import express from "express";
import {
    registerUser,
    loginUser,
    getUser,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    signupUser,
    logoutUser,
    checkUsername,
    updateUserProfile
} from "../controllers/auth.js";
import verifyToken from "../middleware/auth.js";
import { updateTimezone } from "../middleware/timezone.js";
import { createHabit } from "../controllers/habit.js";

const router = express.Router();

// Auth routes
// router.post("/register", registerUser);
router.post("/login", updateTimezone, loginUser);
router.post("/signup", updateTimezone, signupUser);
router.post("/logout", verifyToken, logoutUser);
router.get("/user/:userId", verifyToken, getUser);

// Friend system routes
router.post("/user/:userId/friend-request", verifyToken, sendFriendRequest);
router.post("/user/:userId/accept-friend", verifyToken, acceptFriendRequest);
router.post("/user/:userId/reject-friend", verifyToken, rejectFriendRequest);
router.delete("/user/:userId/friend", verifyToken, removeFriend);

router.get("/check-username/:username", checkUsername);

router.post("/:userId", verifyToken, updateTimezone, createHabit);

// Update user profile
router.patch("/user/:userId", verifyToken, updateUserProfile);

export default router;
