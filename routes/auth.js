const express = require("express");
const authRouter = express.Router();
const supabase = require("../database");

authRouter.get("/google", async (req, res) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback.",
      },
    });

    if (error) {
      return res.status(500).json({
        ok: false,
        message: `Failed to start Google OAuth`,
      });
    }

    if (!data || !data.url) {
      return res
        .status(500)
        .json({ ok: false, message: "OAuth URL was not returned by Supabase" });
    }

    return res.redirect(302, data.url);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Unexpected error while starting Google OAuth",
    });
  }
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
