const express = require("express");
const cors = require("cors");
import env from "dotenv";
require("dotenv").config();

env.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "campus-marketplace-api" });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
