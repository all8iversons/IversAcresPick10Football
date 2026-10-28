export interface PublicSupabaseRuntimeConfig {
  url: string;
  anonKey: string;
}

export interface InternalSupabaseRuntimeConfig extends PublicSupabaseRuntimeConfig {
  internalUrl: string;
}

export interface ServerSupabaseRuntimeConfig extends InternalSupabaseRuntimeConfig {
  serviceRoleKey: string;
}

export class SupabaseRuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseRuntimeConfigurationError";
  }
}

function requiredUrl(value: string | undefined, setting: string): string {
  if (!value) {
    throw new SupabaseRuntimeConfigurationError(
      `Required Supabase setting ${setting} is missing.`,
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SupabaseRuntimeConfigurationError(
      `Required Supabase setting ${setting} is invalid.`,
    );
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new SupabaseRuntimeConfigurationError(
      `Required Supabase setting ${setting} is invalid.`,
    );
  }

  return value.replace(/\/+$/, "");
}

export function getPublicSupabaseRuntimeConfig(): PublicSupabaseRuntimeConfig {
  const url = requiredUrl(
    process.env.SUPABASE_PUBLIC_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    "SUPABASE_PUBLIC_URL",
  );
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new SupabaseRuntimeConfigurationError(
      "Required Supabase setting SUPABASE_ANON_KEY is missing.",
    );
  }

  return { url, anonKey };
}

export function getInternalSupabaseRuntimeConfig(): InternalSupabaseRuntimeConfig {
  const publicConfig = getPublicSupabaseRuntimeConfig();
  const internalUrl = requiredUrl(
    process.env.SUPABASE_INTERNAL_URL || publicConfig.url,
    "SUPABASE_INTERNAL_URL",
  );

  return { ...publicConfig, internalUrl };
}

export function getServerSupabaseRuntimeConfig(): ServerSupabaseRuntimeConfig {
  const internalConfig = getInternalSupabaseRuntimeConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new SupabaseRuntimeConfigurationError(
      "Required Supabase setting SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
  }

  return { ...internalConfig, serviceRoleKey };
}
