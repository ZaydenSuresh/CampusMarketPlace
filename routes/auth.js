const express = require("express");
const authRouter = express.Router();
const supabase = require("../database");

authRouter.get("/google", async (req, res) => {
  try {
    // sign in with Google authentication
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback",
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

    // redirect to /callback endpoint
    return res.redirect(302, data.url);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Unexpected error while starting Google OAuth",
    });
  }
});

authRouter.get("/callback", async (req, res) => {
  // parse request parameters
  const code = req.query.code;
  const oauthError = req.query.error;
  const errorMsg = req.query.error_description;

  if (oauthError) {
    return res.status(401).json({
      ok: false,
      message: errorMsg || "Google sign-in was not completed",
    });
  }

  if (!code) {
    return res
      .status(400)
      .json({ ok: false, message: "Invalid callback request" });
  }

  // exchange the code for session
  try {
    const { data, error: sessionError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (sessionError) {
      return res.status(500).json({
        ok: false,
        message: `Failed to exchange code for session`,
      });
    }

    if (!data || !data.user) {
      return res
        .status(500)
        .json({ ok: false, message: "User data was not returned by Supabase" });
    }

    // redirect to dashboard.html
    return res.redirect(302, "/dashboard.html");
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Unexpected error while exchanging code for session",
    });
  }
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
