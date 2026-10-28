import { HttpError } from "@/lib/http/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

export async function requireCurrentParticipant() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  }
  if (!data.user) {
    throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  }
  return { supabase, user: data.user };
}
