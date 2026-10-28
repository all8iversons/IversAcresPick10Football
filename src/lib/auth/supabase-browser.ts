"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseAuthCookieOptions } from "@/lib/auth/supabase-cookie-options";
import type { Database } from "@/lib/db/database.types";

const publicConfigSchema = z.object({
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(1),
});

let clientPromise: Promise<SupabaseClient<Database>> | undefined;

async function loadSupabaseBrowserClient(): Promise<SupabaseClient<Database>> {
  const response = await fetch("/api/config", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Supabase browser configuration is unavailable.");
  }

  const parsedConfig = publicConfigSchema.safeParse(await response.json());
  if (!parsedConfig.success) {
    throw new Error("Supabase browser configuration is invalid.");
  }
  const url = new URL(parsedConfig.data.supabaseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Supabase browser configuration is invalid.");
  }

  return createBrowserClient<Database>(
    parsedConfig.data.supabaseUrl,
    parsedConfig.data.supabaseAnonKey,
    {
      cookieOptions: getSupabaseAuthCookieOptions(
        parsedConfig.data.supabaseUrl,
      ),
    },
  );
}

export function createSupabaseBrowserClient(): Promise<
  SupabaseClient<Database>
> {
  if (!clientPromise) {
    clientPromise = loadSupabaseBrowserClient().catch((error: unknown) => {
      clientPromise = undefined;
      throw error;
    });
  }

  return clientPromise;
}
