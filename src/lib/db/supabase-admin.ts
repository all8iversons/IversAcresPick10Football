import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabaseRuntimeConfig } from "@/lib/config/supabase-runtime";
import type { Database } from "@/lib/db/database.types";

export function createSupabaseAdminClient() {
  const { internalUrl, serviceRoleKey } = getServerSupabaseRuntimeConfig();

  return createClient<Database>(internalUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
