const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_CHECK_TABLE = process.env.DB_CHECK_TABLE || "testing";

console.log("Starting server...");
console.log("SUPABASE_URL set:", !!process.env.SUPABASE_URL);
console.log("SUPABASE_ANON_KEY set:", !!process.env.SUPABASE_ANON_KEY);

let supabase;
try {
  supabase = require("./database");
} catch (err) {
  console.error("Failed to load database:", err.message);
  supabase = null;
}

const { router: authRouter } = require("./routes/auth");
const slotsRouter = require("./routes/slots");

app.use(cors());
app.use("/styles", express.static("styles"));
app.use("/scripts", express.static("scripts"));
app.use("/components", express.static("components"));
app.use(express.static("pages"));
app.use(express.json());
app.use("/auth", authRouter);
app.use("/slots", slotsRouter);

// check server health
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "campus-marketplace-api" });
});

// check database connection
app.get("/db-check", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ ok: false, message: "Database not initialized" });
  }
  try {
    const { data, error } = await supabase
      .from(DB_CHECK_TABLE)
      .select("*")
      .limit(1);

    if (error) {
      return res.status(500).json({
        ok: false,
        message: "Supabase query failed",
        details: error.message,
      });
    }

    return res.status(200).json({
      ok: true,
      table: DB_CHECK_TABLE,
      rowCount: data.length,
      sample: data[0] || null,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Unexpected server error during db-check",
      details: error.message,
    });
  }
});

const listingsRouter = require("./routes/listings");
app.use("/listings", listingsRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});