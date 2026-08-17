import { supabase } from "./supabase.js";

/** Resets a user's password after verifying their date of birth, via the
 * reset-password Supabase Edge Function (the actual password change needs
 * the service role key, which never reaches the browser). Returns an error
 * message string on failure, or null on success. */
export async function resetPasswordWithDob(email, dob, newPassword) {
  if (!supabase) return "Backend not configured.";
  try {
    const { data, error } = await supabase.functions.invoke("reset-password", {
      body: { email: email.trim().toLowerCase(), dob, newPassword },
    });
    if (error) return error.message || "Something went wrong. Try again.";
    if (data?.error) return data.error;
    return null;
  } catch {
    return "Something went wrong. Try again.";
  }
}
