import Link from "next/link";
import { notFound } from "next/navigation";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { requireLeagueMember } from "@/lib/auth/require-league-member";
import {
  getWeeklyStandings,
  getSeasonStandings,
} from "@/services/standings/standings-service";
import type { StandingView } from "@/services/standings/standings-service";
import { refreshAndScoreWeek } from "@/services/scoring/refresh-and-score-week";
import { assignDefaultPicks } from "@/services/picks/assign-default-picks";
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
  let selectedWeekNumber: number | null = null;
  const supabase = await createSupabaseServerClient();
  const weeksResult = await supabase
    .from("nfl_weeks")
    .select("id, week_number")
    .eq("season", season)
    .eq("season_type", 2)
    .order("week_number");
  if (weeksResult.error) {
    throw new Error(
      `Could not load season weeks: ${weeksResult.error.message}`,
    );
  }
  const seasonWeeks = weeksResult.data;

  if (period === "season") {
    await Promise.all(
      seasonWeeks.map(async (seasonWeek) => {
        await assignDefaultPicks(leagueId, seasonWeek.id);
        await refreshAndScoreWeek(
          season,
          seasonWeek.week_number,
          seasonWeek.id,
        );
      }),
    );
    standings = await getSeasonStandings(leagueId, season);
  } else {
    const requestedWeek = Number(query.weekNumber);
    const selectedWeek =
      seasonWeeks.find((week) => week.week_number === requestedWeek) ??
      seasonWeeks[seasonWeeks.length - 1];
    if (selectedWeek) {
      selectedWeekNumber = selectedWeek.week_number;
      title = `Week ${selectedWeek.week_number} standings`;
      await assignDefaultPicks(leagueId, selectedWeek.id);
      await refreshAndScoreWeek(
        season,
        selectedWeek.week_number,
        selectedWeek.id,
      );
      standings = await getWeeklyStandings(leagueId, selectedWeek.id);
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
        {period === "week" && seasonWeeks.length > 0 && (
          <nav className="week-links" aria-label="Standings weeks">
            {seasonWeeks.map((week) => (
              <Link
                aria-current={
                  week.week_number === selectedWeekNumber ? "page" : undefined
                }
                className={`button${week.week_number === selectedWeekNumber ? " week-link-selected" : ""}`}
                href={`?period=week&season=${season}&weekNumber=${week.week_number}`}
                key={week.id}
              >
                Week {week.week_number}
              </Link>
            ))}
          </nav>
        )}
        <LeaderboardTable standings={standings} />
      </section>
    </main>
  );
}
