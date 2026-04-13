const express = require("express");
const { createSupabaseClient } = require("../lib/supabase");
const router = express.Router();

// Google Authentication Flow
router.get("/google", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "http://localhost:3000/auth/callback" },
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
    console.error("[/auth/google] OAuth start error:", error);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/callback", async (req, res) => {
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
    return res.status(400).json({
      ok: false,
      message: "Invalid callback request: missing code.",
    });
  }

  // Use SSR-aware Supabase client for proper PKCE state
  const supabase = createSupabaseClient(req, res);
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;

    // NOTE: implementation code for adding profile after GOOGLE signup
    // check if profile exits
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // add profile only if it doesn't exist yet
    if (!existingProfile) {
      await supabase.from("profiles").insert({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email.split("@")[0],
        role: "Student", // default role
      });
    }

    // Redirect to dashboard.
    return res.redirect(302, "/dashboard.html");
  } catch (error) {
    console.error("[/auth/callback] OAuth callback error:", error);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/me", async (req, res) => {
  // Use SSR-aware Supabase client to read session cookies
  const supabase = createSupabaseClient(req, res);
  
  // Get user from Supabase session (validates cookies from browser)
  const { data: { user }, error } = await supabase.auth.getUser();
  
  // If no valid session, user is not logged in
  if (error || !user) {
    return res.status(401).json({ ok: false, message: "Not logged in" });
  }
  
  // Query profiles table to get the user's name from the database
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();
  
  // Return user info to client
  return res.status(200).json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: profile?.name || user.email.split("@")[0]
    }
  });
});

// Placeholder for logout; expands as needed for Supabase signOut
router.post("/logout", async (req, res) => {
  return res
    .status(200)
    .json({ ok: true, route: "/auth/logout", message: "placeholder" });
});

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

    // NOTE: implementation code for profile syncing after manual signup
    // check if the profile already exists
    const { data: exisistingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    // if the profile doesn't exist, add it to the profiles table
    if (!exisistingProfile) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        email: authData.user.email,
        name: newUser.name,
        role: newUser.role || "Student", // default role
      });

      if (profileError) {
        console.error("Profile creation error:", profileError.message);
      }
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

module.exports = { signup, login, logout, router };
