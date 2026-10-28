"use client";

import { FormEvent, useState } from "react";

interface JoinedLeague {
  id: string;
  name: string;
}

interface JoinLeagueFormProps {
  onJoined(league: JoinedLeague): void;
}

export function JoinLeagueForm({ onJoined }: JoinLeagueFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError(null);
    setBusy(true);
    try {
      const formData = new FormData(formElement);
      const response = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteCode: formData.get("inviteCode") }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError("The invite code is invalid or could not be used.");
        return;
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("league" in result) ||
        typeof result.league !== "object" ||
        result.league === null ||
        !("id" in result.league) ||
        !("name" in result.league) ||
        typeof result.league.id !== "string" ||
        typeof result.league.name !== "string"
      ) {
        throw new Error("The join API returned an invalid response.");
      }
      onJoined({ id: result.league.id, name: result.league.name });
      formElement.reset();
    } catch (caught) {
      console.error("Joining a league failed", caught);
      setError("Unable to join the league right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Join a league</h2>
      <label className="form-field">
        Invite code
        <input autoComplete="off" name="inviteCode" required />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy} type="submit">
        {busy ? "Joining..." : "Join private league"}
      </button>
    </form>
  );
}
