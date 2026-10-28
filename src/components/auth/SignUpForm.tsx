"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const supabase = await createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: String(form.get("email")),
        password: String(form.get("password")),
        options: {
          data: { display_name: String(form.get("displayName")).trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpError) {
        setError("Account creation failed. Check the details and try again.");
        return;
      }
      if (!data.session) {
        setNotice("Check your email to confirm your account, then sign in.");
        return;
      }
      router.replace("/leagues");
      router.refresh();
    } catch (caught) {
      console.error("Sign-up request failed", caught);
      setError("Unable to create an account right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label className="form-field">
        Display name
        <input autoComplete="name" maxLength={80} name="displayName" required />
      </label>
      <label className="form-field">
        Email
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label className="form-field">
        Password
        <input
          autoComplete="new-password"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <button className="button" disabled={busy} type="submit">
        {busy ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
