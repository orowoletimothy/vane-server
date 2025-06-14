import User from "../models/User.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, userTimeZone } = req.body;
    const checkEmail = await User.findOne({ email });
    if (checkEmail)
      return res.status(400).json({ msg: "Email already exists" });

    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
    });
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      userTimeZone,
    });
    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password, userTimeZone } = req.body; // get email from request body
    const user = await User.findOne({ email }); // find user by email
    if (!user) return res.status(400).json({ msg: "Email does not exist." }); //return if email doesn't exist

    const isMatch = await argon2.verify(user.password, password); // check if password is correct
    if (!isMatch) return res.status(400).json({ msg: "Incorrect password." }); // if password isn't correct

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    }); // generate token
    const filter = { _id: user._id };
    const doc = { userTimeZone: userTimeZone };
    const result = await User.updateOne(filter, { $set: doc }); // update timezone
    user.password = "";
    res.status(200).json({ token, user, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const getUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found." });
    user.password = "";
    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
