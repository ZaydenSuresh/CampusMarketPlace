const express = require("express");
const cors = require("cors");
require("dotenv").config();
const supabase = require("./database");
const authRouter = require("./routes/auth");
const slotsRouter = require("./routes/slots");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_CHECK_TABLE = process.env.DB_CHECK_TABLE || "testing";

app.use(cors());
app.use(express.static("pages"));

app.use(express.json())
app.use("/auth", authRouter);

app.use("/slots", slotsRouter);
;

// check server health
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "campus-marketplace-api" });
});

// check database connection
app.get("/db-check", async (req, res) => {
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
  console.log(`Server is running on http://localhost:${PORT}`);
});
