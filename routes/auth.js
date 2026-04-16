const express = require("express");
const { createSupabaseClient } = require("../lib/supabase");

const router = express.Router();

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
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        role: "Student", // ✅ FIXED
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