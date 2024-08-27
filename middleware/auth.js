import jwt from "jsonwebtoken";

const verifyToken = (req, res, next) => {
  try {
    let token = req.header("Authorization");

    if (token && token.startsWith("Bearer ")) {
      token = token.substring(7);
    } else {
      return res.status(401).send({ message: "Access denied." });
    }
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (!verified) return res.status(401).send({ message: "Invalid token." });
    req.user = verified;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export default verifyToken;
