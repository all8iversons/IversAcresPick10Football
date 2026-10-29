"use client";

import { FormEvent, useState } from "react";

interface CreatedLeague {
  id: string;
  name: string;
}

interface LeagueFormProps {
  onCreated(league: CreatedLeague): void;
}

export function LeagueForm({ onCreated }: LeagueFormProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError(null);
    setInviteCode(null);
    setBusy(true);
    try {
      const formData = new FormData(formElement);
      const response = await fetch("/api/leagues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: formData.get("name") }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(
          "The league could not be created. Check its name and try again.",
        );
        return;
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("league" in result) ||
        !("inviteCode" in result) ||
        typeof result.inviteCode !== "string"
      ) {
        throw new Error("The league API returned an invalid response.");
      }
      const league = result.league;
      if (
        typeof league !== "object" ||
        league === null ||
        !("id" in league) ||
        !("name" in league) ||
        typeof league.id !== "string" ||
        typeof league.name !== "string"
      ) {
        throw new Error("The league API returned an invalid league.");
      }
      setInviteCode(result.inviteCode);
      onCreated({ id: league.id, name: league.name });
      formElement.reset();
    } catch (caught) {
      console.error("League creation failed", caught);
      setError("Unable to create the league right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Create a league</h2>
      <label className="form-field">
        League name
        <input autoComplete="off" maxLength={80} name="name" required />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy} type="submit">
        {busy ? "Creating..." : "Create private league"}
      </button>
      {inviteCode && (
        <p role="status">
          Share this invite code with your league: <strong>{inviteCode}</strong>
          <br />
          You can copy it again anytime from your leagues list.
        </p>
      )}
    </form>
  );
}
