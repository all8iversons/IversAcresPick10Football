import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      new URL("/sign-in?error=callback", requestUrl.origin),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Authentication callback failed", error.message);
    return NextResponse.redirect(
      new URL("/sign-in?error=callback", requestUrl.origin),
    );
  }

  return NextResponse.redirect(new URL("/leagues", requestUrl.origin));
}
