// Supabase Edge Function — resets a user's password after verifying their
// date of birth, instead of the usual email-link flow (no email provider
// configured for this hackathon build). Runs server-side because actually
// changing another user's password requires the service role key, which
// must never reach the browser.
//
// Deploy: supabase functions deploy reset-password
// No extra secret needed — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// provided automatically inside every Edge Function.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { email, dob, newPassword } = await req.json();
    if (!email || !dob || !newPassword) {
      return json({ error: "Missing email, dob, or newPassword" }, 400);
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id, dob")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (profileErr) return json({ error: profileErr.message }, 500);
    if (!profile) return json({ error: "No account found with that email." }, 404);
    if (!profile.dob || profile.dob !== dob) {
      return json({ error: "Date of birth doesn't match our records." }, 401);
    }

    const { error: updateErr } = await admin.auth.admin.updateUserById(profile.id, {
      password: newPassword,
    });
    if (updateErr) return json({ error: updateErr.message }, 500);

    return json({ success: true });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
