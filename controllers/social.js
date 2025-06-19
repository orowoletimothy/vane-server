import User from "../models/User.js"

// Get user's friends
export const getFriends = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate("friends", "displayName username profilePicture")

        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        res.json(user.friends)
    } catch (error) {
        console.error("Error getting friends:", error)
        res.status(500).json({ message: "Error getting friends" })
    }
}

// Get user's friend requests
export const getFriendRequests = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate("friendRequests", "displayName username profilePicture")

        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        res.json(user.friendRequests)
    } catch (error) {
        console.error("Error getting friend requests:", error)
        res.status(500).json({ message: "Error getting friend requests" })
    }
}

// Search users
export const searchUsers = async (req, res) => {
    try {
        const { query } = req.query
        if (!query) {
            return res.status(400).json({ message: "Search query is required" })
        }

        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: "i" } },
                { displayName: { $regex: query, $options: "i" } }
            ],
            _id: { $ne: req.user._id } // Exclude current user
        }).select("displayName username profilePicture longestStreak genStreakCount email")

        res.json(users)
    } catch (error) {
        console.error("Error searching users:", error)
        res.status(500).json({ message: "Error searching users" })
    }
}

// Send friend request
export const sendFriendRequest = async (req, res) => {
    try {
        const { friendId } = req.body
        const userId = req.params.userId

        // Check if users exist
        const [user, friend] = await Promise.all([
            User.findById(userId),
            User.findById(friendId)
        ])

        if (!user || !friend) {
            return res.status(404).json({ message: "User not found" })
        }

        // Check if already friends
        if (user.friends.includes(friendId)) {
            return res.status(400).json({ message: "Already friends" })
        }

        // Check if request already sent
        if (friend.friendRequests.includes(userId)) {
            return res.status(400).json({ message: "Friend request already sent" })
        }

        // Add to friend requests
        friend.friendRequests.push(userId)
        await friend.save()

        res.json({ message: "Friend request sent" })
    } catch (error) {
        console.error("Error sending friend request:", error)
        res.status(500).json({ message: "Error sending friend request" })
    }
}

// Accept friend request
export const acceptFriendRequest = async (req, res) => {
    try {
        const { friendId } = req.body
        const userId = req.params.userId

        // Check if users exist
        const [user, friend] = await Promise.all([
            User.findById(userId),
            User.findById(friendId)
        ])

        if (!user || !friend) {
            return res.status(404).json({ message: "User not found" })
        }

        // Check if request exists
        if (!user.friendRequests.includes(friendId)) {
            return res.status(400).json({ message: "Friend request not found" })
        }

        // Remove from friend requests
        user.friendRequests = user.friendRequests.filter(id => id.toString() !== friendId)

        // Add to friends list for both users
        user.friends.push(friendId)
        friend.friends.push(userId)

        await Promise.all([user.save(), friend.save()])

        res.json({ message: "Friend request accepted" })
    } catch (error) {
        console.error("Error accepting friend request:", error)
        res.status(500).json({ message: "Error accepting friend request" })
    }
}

// Reject friend request
export const rejectFriendRequest = async (req, res) => {
    try {
        const { friendId } = req.body
        const userId = req.params.userId

        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        // Remove from friend requests
        user.friendRequests = user.friendRequests.filter(id => id.toString() !== friendId)
        await user.save()

        res.json({ message: "Friend request rejected" })
    } catch (error) {
        console.error("Error rejecting friend request:", error)
        res.status(500).json({ message: "Error rejecting friend request" })
    }
}

// Remove friend
export const removeFriend = async (req, res) => {
    try {
        const { friendId } = req.body
        const userId = req.params.userId

        // Check if users exist
        const [user, friend] = await Promise.all([
            User.findById(userId),
            User.findById(friendId)
        ])

        if (!user || !friend) {
            return res.status(404).json({ message: "User not found" })
        }

        // Remove from friends list for both users
        user.friends = user.friends.filter(id => id.toString() !== friendId)
        friend.friends = friend.friends.filter(id => id.toString() !== userId)

        await Promise.all([user.save(), friend.save()])

        res.json({ message: "Friend removed" })
    } catch (error) {
        console.error("Error removing friend:", error)
        res.status(500).json({ message: "Error removing friend" })
    }
} 