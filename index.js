import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/task.js";
import habitRoutes from "./routes/habit.js";

// Configurations
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
app.use(express.json());
app.use(cors());
app.use(morgan("common"));
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(bodyParser.json({ limit: "30mb", extended: true }));
app.use(bodyParser.urlencoded({ limit: "30mb", extended: true }));

app.use("/assets", express.static(path.join(__dirname, "/public/assets")));
// storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/assets");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

// ROUTES
app.use("/auth", authRoutes);
app.use("/users/tasks/", taskRoutes);
app.use("/users/habits/", habitRoutes);

app.get("/users/:userId/minimal", (req, res) => {
  const userId = req.params.userId;
  console.log(userId);
  res.status(200).send("successful");
});

const PORT = process.env.PORT || 3005;
mongoose
  .connect(process.env.MONGO_LOCAL)
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on PORT ${PORT}...`));
  })
  .catch((err) => console.log(err, "did not connect"));
