import express from "express"
import {
    getFriends,
    getFriendRequests,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
} from "../controllers/social.js"
import verifyToken from "../middleware/auth.js"

const router = express.Router()

// Get user's friends
router.get("/user/:userId/friends", verifyToken, getFriends)

// Get user's friend requests
router.get("/user/:userId/friend-requests", verifyToken, getFriendRequests)

// Search users
router.get("/search", verifyToken, searchUsers)

// Send friend request
router.post("/user/:userId/friend-request", verifyToken, sendFriendRequest)

// Accept friend request
router.post("/user/:userId/accept-friend", verifyToken, acceptFriendRequest)

// Reject friend request
router.post("/user/:userId/reject-friend", verifyToken, rejectFriendRequest)

// Remove friend
router.delete("/user/:userId/friend", verifyToken, removeFriend)

export default router 