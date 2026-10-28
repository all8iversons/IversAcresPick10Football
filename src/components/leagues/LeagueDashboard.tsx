"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LeagueForm } from "@/components/leagues/LeagueForm";
import { JoinLeagueForm } from "@/components/leagues/JoinLeagueForm";
import { z } from "zod";

const leagueListSchema = z.object({
  leagues: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      role: z.enum(["owner", "member"]),
    }),
  ),
});

type LeagueListItem = z.infer<typeof leagueListSchema>["leagues"][number];

class AuthenticationRequiredError extends Error {}

async function fetchLeagueList(): Promise<LeagueListItem[]> {
  const response = await fetch("/api/leagues");
  if (response.status === 401) throw new AuthenticationRequiredError();
  if (!response.ok)
    throw new Error(`League list failed with ${response.status}`);
  return leagueListSchema.parse(await response.json()).leagues;
}

export function LeagueDashboard() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<LeagueListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLeagues(await fetchLeagueList());
      setError(null);
    } catch (caught) {
      if (caught instanceof AuthenticationRequiredError) {
        router.replace("/sign-in");
        return;
      }
      console.error("Loading leagues failed", caught);
      setError("Your leagues could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    fetchLeagueList()
      .then((result) => {
        if (!active) return;
        setLeagues(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (caught instanceof AuthenticationRequiredError) {
          router.replace("/sign-in");
          return;
        }
        console.error("Loading leagues failed", caught);
        setError("Your leagues could not be loaded. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const handleChange = useCallback(() => {
    void refresh();
  }, [refresh]);

  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          Ivers Acres Pick 10
        </Link>
        <button
          className="button"
          onClick={async () => {
            const { createSupabaseBrowserClient } =
              await import("@/lib/auth/supabase-browser");
            const { error: signOutError } =
              await createSupabaseBrowserClient().auth.signOut();
            if (signOutError) {
              console.error("Sign-out failed", signOutError);
              setError("Unable to sign out. Please try again.");
              return;
            }
            router.replace("/sign-in");
          }}
          type="button"
        >
          Sign out
        </button>
      </header>
      <section className="content stack">
        <div>
          <p className="eyebrow">Private competitions</p>
          <h1>Your leagues</h1>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="stack">
          <LeagueForm onCreated={handleChange} />
          <JoinLeagueForm onJoined={handleChange} />
        </div>
        <section className="stack" aria-labelledby="league-list-heading">
          <h2 id="league-list-heading">League list</h2>
          {loading && <p role="status">Loading your leagues...</p>}
          {!loading && leagues.length === 0 && !error && (
            <p className="muted">
              Create a league or join one with an invite code.
            </p>
          )}
          {leagues.map((league) => (
            <article className="card" key={league.id}>
              <h3>{league.name}</h3>
              <p className="muted">{league.role}</p>
              <Link
                className="button"
                href={`/leagues/${league.id}/weeks/current`}
              >
                Open league
              </Link>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
