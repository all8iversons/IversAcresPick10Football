import { NextResponse } from "next/server";
import {
  getServerSupabaseRuntimeConfig,
  SupabaseRuntimeConfigurationError,
} from "@/lib/config/supabase-runtime";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";

export const dynamic = "force-dynamic";

function notReady() {
  return NextResponse.json(
    { status: "not_ready" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  try {
    getServerSupabaseRuntimeConfig();
    const { error } = await createSupabaseAdminClient()
      .from("leagues")
      .select("id")
      .limit(0);

    if (error) {
      console.error("Supabase readiness check failed.");
      return notReady();
    }

    return NextResponse.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (!(error instanceof SupabaseRuntimeConfigurationError)) {
      console.error("Supabase readiness check failed.");
    }

    return notReady();
  }
}
