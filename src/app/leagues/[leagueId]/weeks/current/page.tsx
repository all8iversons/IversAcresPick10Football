import Link from "next/link";
import { redirect } from "next/navigation";
import { requireLeagueMember } from "@/lib/auth/require-league-member";
import { ESPNNFLScheduleService } from "@/services/nfl/espn/ESPNNFLScheduleService";
import { ScheduleUnavailableMessage } from "@/components/picks/ScheduleUnavailableMessage";

type CurrentWeekPageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function CurrentWeekPage({
  params,
}: CurrentWeekPageProps) {
  const { leagueId } = await params;
  await requireLeagueMember(leagueId);

  let schedule;
  try {
    schedule = await new ESPNNFLScheduleService().getCurrentRegularSeasonWeek();
  } catch (error) {
    console.error("Could not resolve current NFL week", error);
    return (
      <main className="content stack">
        <Link href="/leagues">Back to leagues</Link>
        <ScheduleUnavailableMessage />
      </main>
    );
  }

  redirect(
    `/leagues/${leagueId}/weeks/${schedule.week.season}/${schedule.week.weekNumber}`,
  );
}
