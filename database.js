const { createClient } = require("@supabase/supabase-js");

const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY"];

// validate environment variables
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.warn(`Warning: Missing environment variable: ${key}`);
  }
}

let supabase = null;

// Only create client if both required vars are present
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
  );
  console.log("Supabase client created successfully");
} else {
  console.warn("Supabase client NOT created - missing required env vars");
}

module.exports = supabase;
