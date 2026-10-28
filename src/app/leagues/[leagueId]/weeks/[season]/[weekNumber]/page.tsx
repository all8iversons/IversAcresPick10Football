import { notFound, redirect } from "next/navigation";
import { WeeklyPicksClient } from "@/components/picks/WeeklyPicksClient";
import { requireLeagueMember } from "@/lib/auth/require-league-member";

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
  return (
    <WeeklyPicksClient
      leagueId={leagueId}
      season={season}
      weekNumber={weekNumber}
    />
  );
}
