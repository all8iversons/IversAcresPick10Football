export const SUPABASE_AUTH_COOKIE_NAME = "pick10-auth-token";

export function getSupabaseAuthCookieOptions(publicSupabaseUrl: string): {
  name: string;
  secure: boolean;
} {
  return {
    name: SUPABASE_AUTH_COOKIE_NAME,
    secure: new URL(publicSupabaseUrl).protocol === "https:",
  };
}
