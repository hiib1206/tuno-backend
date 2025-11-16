import express from "express";
import { errorHandler } from "./middleware/error.middleware";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Hello, World!" });
});

// Error Handling
app.use(errorHandler);

export default app;
