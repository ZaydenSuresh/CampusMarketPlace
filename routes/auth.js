const express = require("express");
const authRouter = express.Router();
// Swap out direct supabase client for SSR-aware helper
const { createSupabaseClient } = require("../lib/supabase");

// Google Authentication Flow
authRouter.get("/google", async (req, res) => {
  try {
    // Use the SSR client to ensure PKCE state is handled with cookies
    const supabase = createSupabaseClient(req, res);
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

    // DEBUG OUTPUT
    console.log("[DEBUG] Redirecting to Google OAuth at:", data.url);

    // Redirect to Supabase's Google OAuth URL
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

  console.log("[DEBUG] /auth/callback query:", req.query);

  if (oauthError) {
    return res.status(401).json({
      ok: false,
      message: errorMsg || "Google sign-in was not completed",
    });
  }

  if (!code) {
    return res.status(400).json({
      ok: false,
      message: "Invalid callback request: missing code.",
      query: req.query,
    });
  }

  // Use SSR-aware Supabase client for proper PKCE state
  const supabase = createSupabaseClient(req, res);
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

    // Optionally, store key user data in session as before
    req.session.userId = data.user.id;
    req.session.email = data.user.email;
    req.session.name = data.user.user_metadata?.name;
    req.session.supabase_token = data.session?.access_token;
    req.session.supabase_refresh_token = data.session?.refresh_token;
    req.session.supabase_expires_at = data.session?.expires_at;

    // redirect to dashboard.html
    return res.redirect(302, "/dashboard.html");
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Unexpected error while exchanging code for session",
    });
  }
});

authRouter.get("/me", (req, res) => {
  // Check if the session exists and the user ID is set (i.e., user is logged in)
  if (req.session && req.session.userId) {
    return res.status(200).json({
      ok: true,
      user: {
        // User's unique Supabase ID
        id: req.session.userId,
        // User's email address as stored in Supabase
        email: req.session.email,
        // User's name, if provided by Google/Supabase
        name: req.session.name,
        // Access token used for making authorized Supabase requests (keep this secret!)
        access_token: req.session.supabase_token,
      },
    });
  } else {
    // No user in session — they are not logged in
    return res.status(401).json({ ok: false, message: "Not logged in" });
  }
});

authRouter.post("/logout", async (req, res) => {
  // Temporary response for testing route wiring only.
  return res
    .status(200)
    .json({ ok: true, route: "/auth/logout", message: "placeholder" });
});

module.exports = { authRouter };

// Classic Authentication Flow
async function signup(newUser) {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newUser.email,
      password: newUser.password,
    });

    if (authError || !authData?.user) {
      console.error("Signup error:", authError?.message);
      return null;
    }

    const { error: profileError } = await supabase.from("User_test").insert({
      id: authData.user.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });

    if (profileError) {
      console.error("Profile creation error:", profileError.message);
      return null;
    }

    console.log("Signup successful:", authData.user);
    return authData.user;
  } catch (err) {
    console.error("Unexpected signup error:", err);
    return null;
  }
}

async function login(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Login error:", error.message);
      return null;
    }

    console.log("Login successful:", data.user);
    return data.user;
  } catch (err) {
    console.error("Unexpected error during login:", err);
    return null;
  }
}

async function logout() {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error.message);
    } else {
      console.log("Logout successful");
    }
  } catch (err) {
    console.error("Unexpected logout error", err);
  }
}

module.exports = { signup, login, logout };
