const { createServerClient, parseCookieHeader, serializeCookieHeader } = require('@supabase/ssr');

// Generates a Supabase SSR client for each Express request/response cycle
module.exports.createSupabaseClient = (req, res) => {
  return createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {

    }
  );
};
