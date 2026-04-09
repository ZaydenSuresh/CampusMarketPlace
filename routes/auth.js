const express = require("express");
const authRouter = express.Router();

authRouter.get("/google", async (req, res) => {
  // Temporary response for testing route wiring only.
  return res
    .status(200)
    .json({ ok: true, route: "/auth/google", message: "placeholder" });
});

authRouter.get("/callback", async (req, res) => {
  // Temporary response for testing route wiring only.
  return res
    .status(200)
    .json({ ok: true, route: "/auth/callback", message: "placeholder" });
});

authRouter.get("/me", async (req, res) => {
  // Temporary response for testing route wiring only.
  return res
    .status(200)
    .json({ ok: true, route: "/auth/me", message: "placeholder" });
});

authRouter.post("/logout", async (req, res) => {
  // Temporary response for testing route wiring only.
  return res
    .status(200)
    .json({ ok: true, route: "/auth/logout", message: "placeholder" });
});

module.exports = { authRouter };
