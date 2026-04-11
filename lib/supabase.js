const { createServerClient, parseCookieHeader, serializeCookieHeader } = require('@supabase/ssr');

// Generates a Supabase SSR client for each Express request/response cycle
module.exports.createSupabaseClient = (req, res) => {
  return createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          // Parse cookies from the incoming request header
          return parseCookieHeader(req.headers.cookie ?? '');
        },
        setAll(cookiesToSet, headers) {
          // Attach Set-Cookie headers to response, so browser stores updated state
          cookiesToSet.forEach(({ name, value, options }) => {
            res.append
              ? res.append('Set-Cookie', serializeCookieHeader(name, value, options))
              : res.setHeader('Set-Cookie', serializeCookieHeader(name, value, options));
          });
          // Forward cache-control and other session-related headers if provided
          if (headers && typeof res.setHeader === 'function') {
            Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
          }
        }
      },
    }
  );
};
