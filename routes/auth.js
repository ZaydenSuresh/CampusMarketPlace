const express = require("express");
const { createSupabaseClient } = require("../lib/supabase");

const router = express.Router();

// handles the Google OAuth flow by redirecting the user to Google's OAuth page
router.get("/google", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.APP_URL}/auth/callback`,
      },
    });

    if (error) {
      return res.status(500).json({
        ok: false,
        message: "Failed to start Google OAuth",
      });
    }

    if (!data?.url) {
      return res.status(500).json({
        ok: false,
        message: "OAuth URL was not returned by Supabase",
      });
    }

    return res.redirect(302, data.url);
  } catch (error) {
    console.error("[/auth/google] OAuth start error:", error);
    return res.status(500).json({
      ok: false,
      message: error.message || "Google OAuth failed",
    });
  }
});

// callback endpoint handles the OAuth callback from Google and inserts the user into the database
router.get("/callback", async (req, res) => {
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

  const supabase = createSupabaseClient(req, res);

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (error) throw error;

    if (!user) {
      return res.status(400).json({
        ok: false,
        message: "No user returned after Google sign-in.",
      });
    }

    const { data: existingProfile, error: lookupError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (lookupError) {
      console.error("Profile lookup error:", lookupError);
    }

    if (!existingProfile) {
      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email.split("@")[0],
        role: "Student", // default role
      });

      // redirect to dashboard after profile creation
      return res.redirect(302, "/dashboard.html");
    }

    // Redirect to page based on role
    if (existingProfile.role === "Student") {
      return res.redirect(302, "/dashboard.html");
    } else if (existingProfile.role === "Trade Facility Staff") {
      return res.redirect(302, "/manage-slots.html");
    }
  } catch (error) {
    console.error("[/auth/callback] OAuth callback error:", error);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// me endpoint returns the user's profile information & supabase session
router.get("/me", async (req, res) => {
  // Use SSR-aware Supabase client to read session cookies
  const supabase = createSupabaseClient(req, res);

  // Get user from Supabase session (validates cookies from browser)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // If no valid session, user is not logged in
  if (error || !user) {
    return res.status(401).json({ ok: false, message: "Not logged in" });
  }

  // Query profiles table to get the user's name from the database
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role") // select name and role from profiles table
    .eq("id", user.id)
    .single();

  // Return user info to client
  return res.status(200).json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: profile?.name || user.email.split("@")[0],
      role: profile?.role || "Student",
    },
  });
});

router.get("/profiles/:id", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  const { id } = req.params;

  const { data, error } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", id)
    .single();

  if (error) {
    console.error("PROFILE ERROR:", error);
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// register endpoint inserts the user into the database
router.post("/register", async (req, res) => {
  // create supabase client
  const supabase = createSupabaseClient(req, res);
  // send user info in request body
  const { email, password, name, role } = req.body;
  const user = await signup(supabase, { email, password, name, role });

  // check if the user was made successfully
  if (!user)
    return res.status(400).json({ ok: false, message: "Signup failed" });

  return res.status(200).json({ ok: true, user, message: "Signup successful" });
});

// login endpoint signs in the user and returns the user object
router.post("/login", async (req, res) => {
  const supabase = createSupabaseClient(req, res);
  const { email, password } = req.body;

  const user = await login(supabase, email, password);

  if (!user)
    return res.status(400).json({ ok: false, message: "Login failed" });
  console.log(req.params.name);
  return res.status(200).json({ ok: true, user, message: "Login successful" });
});

// logout endpoint call clears supabase session
router.post("/logout", async (req, res) => {
  const supabase = createSupabaseClient(req, res);
  const { error } = await logout(supabase);

  if (error)
    return res.status(400).json({ ok: false, message: "Logout failed" });

  return res.status(200).json({ ok: true, message: "Logout successful" });
});

// Classic Authentication Flow
async function signup(supabase, newUser) {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newUser.email,
      password: newUser.password,
    });

    if (authError || !authData?.user) {
      console.error("Signup error:", authError?.message);
      return null;
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        email: authData.user.email,
        name: newUser.name,
        role: newUser.role || "Student",
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

async function login(supabase, email, password) {
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
    console.log(data.user.name);
    return data.user;
  } catch (err) {
    console.error("Unexpected error during login:", err);
    return null;
  }
}

async function logout(supabase) {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error.message);
      return error;
    }

    console.log("Logout successful");
    return null;
  } catch (err) {
    console.error("Unexpected logout error", err);
    return err;
  }
}

module.exports = { router, signup, login, logout };
