import jwt from "jsonwebtoken";

const verifyToken = (req, res, next) => {
  try {
    let token = req.header("Authorization");

    if (token && token.startsWith("Bearer ")) {
      token = token.substring(7);
    } else {
      return res.status(401).send({ msg: "Access denied." });
    }
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ msg: "Token expired." });
    } else if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ msg: "Invalid token." });
    }
    res.status(500).json({ error: err.message });
  }
};

export default verifyToken;
