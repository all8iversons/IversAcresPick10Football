import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getInternalSupabaseRuntimeConfig } from "@/lib/config/supabase-runtime";
import type { Database } from "@/lib/db/database.types";

export async function createSupabaseServerClient() {
  const { internalUrl, anonKey } = getInternalSupabaseRuntimeConfig();

  const cookieStore = await cookies();
  return createServerClient<Database>(internalUrl, anonKey, {
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
