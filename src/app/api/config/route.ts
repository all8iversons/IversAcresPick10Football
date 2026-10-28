import { NextResponse } from "next/server";
import {
  getPublicSupabaseRuntimeConfig,
  SupabaseRuntimeConfigurationError,
} from "@/lib/config/supabase-runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getPublicSupabaseRuntimeConfig();
    return NextResponse.json(
      { supabaseUrl: config.url, supabaseAnonKey: config.anonKey },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (!(error instanceof SupabaseRuntimeConfigurationError)) {
      throw error;
    }

    return NextResponse.json(
      { error: "Public Supabase configuration is missing or invalid." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
