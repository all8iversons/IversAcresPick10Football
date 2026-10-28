import { describe, expect, it } from "vitest";
import {
  getSupabaseAuthCookieOptions,
  SUPABASE_AUTH_COOKIE_NAME,
} from "@/lib/auth/supabase-cookie-options";

describe("Supabase auth cookie options", () => {
  it("uses the same explicit cookie name regardless of the Supabase host", () => {
    expect(getSupabaseAuthCookieOptions("http://192.168.1.109:8001")).toEqual({
      name: SUPABASE_AUTH_COOKIE_NAME,
      secure: false,
    });
    expect(getSupabaseAuthCookieOptions("http://api-gw:8000")).toEqual({
      name: SUPABASE_AUTH_COOKIE_NAME,
      secure: false,
    });
  });

  it("marks the auth cookie Secure when the public URL uses HTTPS", () => {
    expect(
      getSupabaseAuthCookieOptions("https://supabase.example.test"),
    ).toEqual({
      name: SUPABASE_AUTH_COOKIE_NAME,
      secure: true,
    });
  });
});
