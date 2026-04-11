const { createServerClient } = require('@supabase/ssr');
const cookie = require('cookie');

// SSR-aware Supabase client with PKCE-compliant cookie handlers for Express
module.exports.createSupabaseClient = (req, res) => {
  const myRes = res;
  return createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          // Read cookies from the incoming request header
          const cookies = cookie.parse(req.headers.cookie || '');
          return cookies[name];
        },
        set: function(name, value, options) {
          if (myRes.headersSent) {
            console.warn(`[supabase.js][SAFE] Tried to set cookie "${name}" after headers sent—skipped!`);
            return;
          }
          const serialized = cookie.serialize(name, value, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            ...options,
          });
          
          let prev = myRes.getHeader && myRes.getHeader('Set-Cookie');
          let newVal;
          if (!prev) {
            newVal = serialized;
          } else if (Array.isArray(prev)) {
            newVal = [...prev, serialized];
          } else {
            newVal = [prev, serialized];
          }
          myRes.setHeader('Set-Cookie', newVal);
          
          
        },
        remove: function(name, options) {
          if (myRes.headersSent) {
            console.warn(`[supabase.js][SAFE] Tried to remove cookie "${name}" after headers sent—skipped!`);
            return;
          }
          this.set(name, '', { ...options, maxAge: 0 });
        }
      }
    }
  );
};
