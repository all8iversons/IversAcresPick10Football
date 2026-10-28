import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/config/route";
import {
  getInternalSupabaseRuntimeConfig,
  getPublicSupabaseRuntimeConfig,
  getServerSupabaseRuntimeConfig,
  SupabaseRuntimeConfigurationError,
} from "@/lib/config/supabase-runtime";

const runtimeEnvironmentKeys = [
  "SUPABASE_PUBLIC_URL",
  "SUPABASE_INTERNAL_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

describe("Supabase runtime configuration", () => {
  beforeEach(() => {
    for (const key of runtimeEnvironmentKeys) {
      vi.stubEnv(key, "");
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses validated runtime public values", () => {
    vi.stubEnv("SUPABASE_PUBLIC_URL", "https://supabase.example.test/");
    vi.stubEnv("SUPABASE_ANON_KEY", "public-key");

    expect(getPublicSupabaseRuntimeConfig()).toEqual({
      url: "https://supabase.example.test",
      anonKey: "public-key",
    });
  });

  it("preserves compatibility with existing local environment variable names", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-public-key");

    expect(getInternalSupabaseRuntimeConfig()).toEqual({
      url: "http://127.0.0.1:54321",
      internalUrl: "http://127.0.0.1:54321",
      anonKey: "local-public-key",
    });
  });

  it("rejects malformed or non-HTTP Supabase URLs without echoing their values", () => {
    vi.stubEnv("SUPABASE_PUBLIC_URL", "ftp://private.example.test");
    vi.stubEnv("SUPABASE_ANON_KEY", "public-key");

    expect(() => getPublicSupabaseRuntimeConfig()).toThrow(
      SupabaseRuntimeConfigurationError,
    );
    expect(() => getPublicSupabaseRuntimeConfig()).not.toThrow(
      "private.example.test",
    );
  });

  it("requires the server-only service role credential for admin clients", () => {
    vi.stubEnv("SUPABASE_PUBLIC_URL", "http://api-gw:8000");
    vi.stubEnv("SUPABASE_ANON_KEY", "public-key");
    vi.stubEnv("SUPABASE_INTERNAL_URL", "http://api-gw:8000");

    expect(() => getServerSupabaseRuntimeConfig()).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
  });

  it("returns only public configuration to site visitors", async () => {
    vi.stubEnv("SUPABASE_PUBLIC_URL", "http://unraid-host:8000");
    vi.stubEnv("SUPABASE_ANON_KEY", "public-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "must-not-be-exposed");

    const response = await GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      supabaseUrl: "http://unraid-host:8000",
      supabaseAnonKey: "public-key",
    });
    expect(JSON.stringify(body)).not.toContain("must-not-be-exposed");
  });

  it("reports invalid public configuration as unavailable without exposing credentials", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "must-not-be-exposed");

    const response = await GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Public Supabase configuration is missing or invalid.",
    });
    expect(JSON.stringify(body)).not.toContain("must-not-be-exposed");
  });
});
