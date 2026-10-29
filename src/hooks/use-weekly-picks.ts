"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameMatchup, NflWeek, UserPick } from "@/domain/types";
import { z } from "zod";

const gameMatchupSchema = z.object({
  id: z.string(),
  sourceEventId: z.string(),
  weekId: z.string(),
  homeTeam: z.object({ id: z.string(), name: z.string() }),
  awayTeam: z.object({ id: z.string(), name: z.string() }),
  kickoffUtc: z.string(),
  venueTimeZone: z.string(),
  isThursdayNightGame: z.boolean(),
  status: z.enum([
    "scheduled",
    "in_progress",
    "final",
    "postponed",
    "cancelled",
    "unknown",
  ]),
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  finalResult: z.enum(["home_win", "away_win", "tie", "undetermined"]),
});

const weekResponseSchema = z.object({
  week: z.object({
    id: z.string(),
    season: z.number(),
    seasonType: z.literal(2),
    weekNumber: z.number(),
    deadlineUtc: z.string(),
    scheduleFetchedAt: z.string(),
    scheduleStatus: z.enum(["available", "stale", "unavailable"]),
    isLocked: z.boolean(),
  }),
  games: z.array(gameMatchupSchema),
  myEntry: z
    .object({
      id: z.string(),
      submittedAt: z.string(),
      updatedAt: z.string(),
      picks: z.array(
        z.object({
          gameId: z.string(),
          selectedTeamId: z.string(),
          pointsAwarded: z.number().nullable(),
        }),
      ),
    })
    .nullable(),
  otherEntries: z.array(
    z.object({
      participantId: z.string(),
      participantName: z.string(),
      picks: z.array(
        z.object({
          gameId: z.string(),
          selectedTeamId: z.string(),
        }),
      ),
    }),
  ),
  submissionStatuses: z.array(
    z.object({
      participantId: z.string(),
      participantName: z.string(),
      isCurrentUser: z.boolean(),
      hasSubmitted: z.boolean(),
    }),
  ),
});

type OtherEntry = z.infer<typeof weekResponseSchema>["otherEntries"][number];
type SubmissionStatus =
  z.infer<typeof weekResponseSchema>["submissionStatuses"][number];

interface WeekResponse {
  week: NflWeek & { isLocked: boolean };
  games: GameMatchup[];
  otherEntries: OtherEntry[];
  submissionStatuses: SubmissionStatus[];
  myEntry: {
    id: string;
    submittedAt: string;
    picks: UserPick[];
  } | null;
}

interface UseWeeklyPicksResult {
  week: WeekResponse["week"] | null;
  games: GameMatchup[];
  picks: UserPick[];
  otherEntries: OtherEntry[];
  submissionStatuses: SubmissionStatus[];
  otherEntriesLoaded: boolean;
  loading: boolean;
  saving: boolean;
  submitted: boolean;
  error: string | null;
  now: number | null;
  selectedByGame: ReadonlyMap<string, string>;
  refreshingStatuses: boolean;
  selectTeam(gameId: string, teamId: string): void;
  refreshStatuses(): Promise<void>;
  submit(): Promise<void>;
}

export function useWeeklyPicks(
  leagueId: string,
  season: number,
  weekNumber: number,
): UseWeeklyPicksResult {
  const router = useRouter();
  const [week, setWeek] = useState<WeekResponse["week"] | null>(null);
  const [games, setGames] = useState<GameMatchup[]>([]);
  const [picks, setPicks] = useState<UserPick[]>([]);
  const [otherEntries, setOtherEntries] = useState<OtherEntry[]>([]);
  const [submissionStatuses, setSubmissionStatuses] = useState<
    SubmissionStatus[]
  >([]);
  const [otherEntriesLoaded, setOtherEntriesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingStatuses, setRefreshingStatuses] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const revealRequestedFor = useRef<string | null>(null);

  const endpoint = `/api/leagues/${encodeURIComponent(leagueId)}/weeks/${season}/${weekNumber}`;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(endpoint)
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401) router.replace("/sign-in");
          const body: unknown = await response.json().catch(() => null);
          const message =
            typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof body.error === "object" &&
            body.error !== null &&
            "message" in body.error &&
            typeof body.error.message === "string"
              ? body.error.message
              : "The schedule could not be loaded.";
          throw new Error(message);
        }
        return weekResponseSchema.parse(await response.json());
      })
      .then((result) => {
        if (!active) return;
        setWeek(result.week);
        setGames(result.games);
        setPicks(result.myEntry?.picks ?? []);
        setOtherEntries(result.otherEntries);
        setSubmissionStatuses(result.submissionStatuses);
        setOtherEntriesLoaded(result.week.isLocked);
        setSubmitted(result.myEntry !== null);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        console.error("Loading the weekly schedule failed", caught);
        setError(
          caught instanceof Error
            ? caught.message
            : "The schedule could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [endpoint, router]);

  useEffect(() => {
    if (
      !week ||
      week.isLocked ||
      now === null ||
      now < Date.parse(week.deadlineUtc) ||
      revealRequestedFor.current === endpoint
    ) {
      return;
    }

    revealRequestedFor.current = endpoint;
    fetch(endpoint)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `League picks could not be loaded (${response.status}).`,
          );
        }
        return weekResponseSchema.parse(await response.json());
      })
      .then((result) => {
        if (revealRequestedFor.current !== endpoint) return;
        setWeek(result.week);
        setOtherEntries(result.otherEntries);
        setSubmissionStatuses(result.submissionStatuses);
        setOtherEntriesLoaded(true);
      })
      .catch((caught: unknown) => {
        if (revealRequestedFor.current !== endpoint) return;
        console.error("Loading league picks after lockout failed", caught);
        setError("Other league picks could not be loaded. Please refresh.");
      });
  }, [endpoint, now, week]);

  const selectedByGame = useMemo(
    () => new Map(picks.map((pick) => [pick.gameId, pick.selectedTeamId])),
    [picks],
  );

  const selectTeam = useCallback(
    (gameId: string, teamId: string) => {
      if (!week || now === null || now >= Date.parse(week.deadlineUtc)) return;
      setError(null);
      setSubmitted(false);
      setPicks((current) => {
        const existing = current.find((pick) => pick.gameId === gameId);
        if (existing?.selectedTeamId === teamId) {
          return current.filter((pick) => pick.gameId !== gameId);
        }
        if (!existing && current.length >= 10) return current;
        return [
          ...current.filter((pick) => pick.gameId !== gameId),
          { gameId, selectedTeamId: teamId, pointsAwarded: null },
        ];
      });
    },
    [now, week],
  );

  const refreshStatuses = useCallback(async () => {
    setRefreshingStatuses(true);
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        if (response.status === 401) router.replace("/sign-in");
        throw new Error(
          `Submission status could not be refreshed (${response.status}).`,
        );
      }
      const result = weekResponseSchema.parse(await response.json());
      setSubmissionStatuses(result.submissionStatuses);
      if (result.week.isLocked) {
        setWeek(result.week);
        setOtherEntries(result.otherEntries);
        setOtherEntriesLoaded(true);
      }
      setError(null);
    } catch (caught) {
      console.error("Refreshing league submission status failed", caught);
      setError("Submission status could not be refreshed. Please try again.");
    } finally {
      setRefreshingStatuses(false);
    }
  }, [endpoint, router]);

  const submit = useCallback(async () => {
    if (!week || now === null || now >= Date.parse(week.deadlineUtc)) {
      setError("Picks are locked for this week.");
      return;
    }
    if (picks.length !== 10) {
      setError("Choose exactly 10 teams before submitting.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${endpoint}/picks`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          picks: picks.map(({ gameId, selectedTeamId }) => ({
            gameId,
            selectedTeamId,
          })),
        }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "object" &&
          body.error !== null &&
          "message" in body.error &&
          typeof body.error.message === "string"
            ? body.error.message
            : "Your picks could not be saved.";
        throw new Error(message);
      }
      setError(null);
      setSubmitted(true);
      setSubmissionStatuses((current) =>
        current.map((status) =>
          status.isCurrentUser ? { ...status, hasSubmitted: true } : status,
        ),
      );
    } catch (caught) {
      console.error("Pick submission failed", caught);
      setError(
        caught instanceof Error
          ? caught.message
          : "Your picks could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }, [endpoint, now, picks, week]);

  return {
    week,
    games,
    picks,
    otherEntries,
    submissionStatuses,
    otherEntriesLoaded,
    loading,
    saving,
    submitted,
    error,
    now,
    selectedByGame,
    selectTeam,
    refreshStatuses,
    refreshingStatuses,
    submit,
  };
}
