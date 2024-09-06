import User from "../models/User.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
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
    });
    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body; // get email from request body
    const user = await User.findOne({ email }); // find user by email
    if (!user) return res.status(400).json({ msg: "Email does not exist." }); //return if email doesn't exist

    const isMatch = await argon2.verify(user.password, password); // check if password is correct
    if (!isMatch) return res.status(400).json({ msg: "Incorrect password." }); // if password isn't correct

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    }); // generate token
    user.password = "";
    res.status(200).json({ token, user });
  } catch (err) {
    console.error(err);
  }
};
