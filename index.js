import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import habitRoutes from "./routes/habit.js";
import notificationRoutes from "./routes/notification.js";
import { processPendingNotifications } from "./controllers/notification.js";
import socialRoutes from "./routes/social.js"

// Configurations
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
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

// MongoDB connection
mongoose.connect(process.env.MONGO_LOCAL)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((error) => console.log(`${error} did not connect`));

// Set up notification scheduler
const NOTIFICATION_CHECK_INTERVAL = 60000; // Check every minute
setInterval(async () => {
  await processPendingNotifications();
}, NOTIFICATION_CHECK_INTERVAL);

// ROUTES
app.use("/auth", authRoutes);
app.use("/users/habits", habitRoutes);
app.use("/notifications", notificationRoutes);
app.use("/social", socialRoutes);

app.get("/users/:userId/minimal", (req, res) => {
  const userId = req.params.userId;
  console.log(userId);
  res.status(200).send("successful");
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`Server running on PORT ${PORT}...`));
