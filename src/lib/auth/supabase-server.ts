import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAuthCookieOptions } from "@/lib/auth/supabase-cookie-options";
import { getInternalSupabaseRuntimeConfig } from "@/lib/config/supabase-runtime";
import type { Database } from "@/lib/db/database.types";

export async function createSupabaseServerClient() {
  const { internalUrl, anonKey, url } = getInternalSupabaseRuntimeConfig();

  const cookieStore = await cookies();
  return createServerClient<Database>(internalUrl, anonKey, {
    cookieOptions: getSupabaseAuthCookieOptions(url),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies; middleware or route handlers refresh them.
        }
      },
    },
  });
}
