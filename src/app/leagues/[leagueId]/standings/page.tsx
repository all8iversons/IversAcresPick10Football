import Link from "next/link";
import { notFound } from "next/navigation";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { requireLeagueMember } from "@/lib/auth/require-league-member";
import {
  getWeeklyStandings,
  getSeasonStandings,
} from "@/services/standings/standings-service";
import type { StandingView } from "@/services/standings/standings-service";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

type StandingsPageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{
    season?: string;
    weekNumber?: string;
    period?: string;
  }>;
};

export default async function StandingsPage({
  params,
  searchParams,
}: StandingsPageProps) {
  const { leagueId } = await params;
  await requireLeagueMember(leagueId);
  const query = await searchParams;
  const season = Number(query.season ?? new Date().getUTCFullYear());
  const period = query.period === "season" ? "season" : "week";
  if (!Number.isInteger(season) || season < 2000 || season > 2200) notFound();

  let title = "Season standings";
  let standings: StandingView[] = [];
  if (period === "season") {
    standings = await getSeasonStandings(leagueId, season);
  } else {
    const supabase = await createSupabaseServerClient();
    const weekQuery = supabase
      .from("nfl_weeks")
      .select("id, week_number")
      .eq("season", season)
      .eq("season_type", 2);
    const requestedWeek = Number(query.weekNumber);
    if (
      Number.isInteger(requestedWeek) &&
      requestedWeek >= 1 &&
      requestedWeek <= 18
    ) {
      weekQuery.eq("week_number", requestedWeek);
    } else {
      weekQuery.order("week_number", { ascending: false }).limit(1);
    }
    const weekResult = await weekQuery.maybeSingle();
    if (weekResult.error)
      throw new Error(
        `Could not load standings week: ${weekResult.error.message}`,
      );
    if (!weekResult.data) {
      standings = [];
    } else {
      title = `Week ${weekResult.data.week_number} standings`;
      standings = await getWeeklyStandings(leagueId, weekResult.data.id);
    }
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" href="/leagues">
          Ivers Acres Pick 10
        </Link>
        <Link href={`/leagues/${leagueId}/weeks/current`}>Current picks</Link>
      </header>
      <section className="content stack">
        <p className="eyebrow">Season {season}</p>
        <h1>{title}</h1>
        <nav className="standings-nav" aria-label="Standings periods">
          <Link href={`?period=week&season=${season}`}>Weekly</Link>
          <Link href={`?period=season&season=${season}`}>Season</Link>
        </nav>
        <LeaderboardTable standings={standings} />
      </section>
    </main>
  );
}
