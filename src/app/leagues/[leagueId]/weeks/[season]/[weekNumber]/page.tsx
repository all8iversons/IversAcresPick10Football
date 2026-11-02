import { notFound, redirect } from "next/navigation";
import { WeeklyPicksClient } from "@/components/picks/WeeklyPicksClient";
import { requireLeagueMember } from "@/lib/auth/require-league-member";
import { ESPNNFLScheduleService } from "@/services/nfl/espn/ESPNNFLScheduleService";

type WeeklyPicksPageProps = {
  params: Promise<{ leagueId: string; season: string; weekNumber: string }>;
};

export default async function WeeklyPicksPage({
  params,
}: WeeklyPicksPageProps) {
  const { leagueId, season: seasonText, weekNumber: weekText } = await params;
  await requireLeagueMember(leagueId);
  const season = Number(seasonText);
  const weekNumber = Number(weekText);
  if (
    !Number.isInteger(season) ||
    !Number.isInteger(weekNumber) ||
    season < 2000 ||
    weekNumber < 1 ||
    weekNumber > 18
  ) {
    notFound();
  }
  if (seasonText !== String(season) || weekText !== String(weekNumber)) {
    redirect(`/leagues/${leagueId}/weeks/${season}/${weekNumber}`);
  }

  let currentWeek: { season: number; weekNumber: number } | null = null;
  try {
    const schedule =
      await new ESPNNFLScheduleService().getCurrentRegularSeasonWeek();
    currentWeek = {
      season: schedule.week.season,
      weekNumber: schedule.week.weekNumber,
    };
  } catch (error) {
    console.error("Could not resolve current week for week navigation", error);
  }

  return (
    <WeeklyPicksClient
      leagueId={leagueId}
      season={season}
      weekNumber={weekNumber}
      currentWeek={currentWeek}
    />
  );
}
