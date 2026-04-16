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
    }

    // Redirect to dashboard.
    return res.redirect(302, "/dashboard.html");
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
    .select("name")
    .eq("id", user.id)
    .single();

  // Return user info to client
  return res.status(200).json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: profile?.name || user.email.split("@")[0],
    },
  });
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

  return res.status(200).json({ ok: true, user, message: "Login successful" });
});

// logout endpoint call clears supabase session
router.post("/logout", async (req, res) => {
  const supabase = createSupabaseClient(req, res);
  const { error } = await logout(supabase);

  if (error)
    return res.status(400).json({ ok: false, message: "Logout failed" });

  // redirect to login page after logout
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

    // implementation code for profile syncing after manual signup
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
        role: newUser.role,
      });

      if (insertError) {
        console.error("Profile insert error:", insertError);
        return res.status(500).json({
          ok: false,
          message: insertError.message,
        });
      }
    }

    return res.redirect(302, "/dashboard.html");
  } catch (error) {
    console.error("[/auth/callback] OAuth callback error:", error);
    return res.status(500).json({
      ok: false,
      message: error.message || "OAuth callback failed",
    });
  }
});

router.post("/register", async (req, res) => {
  const supabase = createSupabaseClient(req, res);
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      ok: false,
      message: "Name, email and password are required.",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      ok: false,
      message: "Password must be at least 6 characters.",
    });
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData?.user) {
      return res.status(400).json({
        ok: false,
        message: authError?.message || "Registration failed",
      });
    }

    const { data: existingProfile, error: lookupError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (lookupError) {
      console.error("Profile lookup error:", lookupError);
    }

    if (!existingProfile) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        email: authData.user.email,
        name,
        role: "Student", // ✅ FIXED
      });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        return res.status(500).json({
          ok: false,
          message: profileError.message,
        });
      }
    }

    return res.status(201).json({
      ok: true,
      message: "Account created successfully",
      user: authData.user,
      session: authData.session || null,
    });
  } catch (err) {
    console.error("Unexpected signup error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error during registration",
    });
  }
});

router.post("/login", async (req, res) => {
  const supabase = createSupabaseClient(req, res);
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      message: "Email and password are required.",
    });
  }

async function login(supabase, email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user) {
      return res.status(401).json({
        ok: false,
        message: error?.message || "Login failed",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Login successful",
      user: data.user,
      session: data.session || null,
    });
  } catch (err) {
    console.error("Unexpected login error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error during login",
    });
  }
});

router.get("/me", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return res.status(401).json({
      ok: false,
      message: "Not logged in",
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  return res.status(200).json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: profile?.name || user.email?.split("@")[0] || "User",
    },
  });
});

router.post("/logout", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

async function logout(supabase) {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(500).json({
        ok: false,
        message: error.message || "Logout failed",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Logout successful",
    });
  } catch (err) {
    console.error("Unexpected logout error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error during logout",
    });
  }
});

module.exports = { router };