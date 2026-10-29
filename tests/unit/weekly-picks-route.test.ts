import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/leagues/[leagueId]/weeks/[season]/[weekNumber]/route";
import { HttpError } from "@/lib/http/errors";

const mocks = vi.hoisted(() => ({
  requireLeagueMember: vi.fn(),
  getRegularSeasonWeek: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth/require-league-member", () => ({
  requireLeagueMember: mocks.requireLeagueMember,
}));

vi.mock("@/lib/db/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/services/nfl/espn/ESPNNFLScheduleService", () => ({
  ESPNNFLScheduleService: class {
    getRegularSeasonWeek = mocks.getRegularSeasonWeek;
  },
  ScheduleUnavailableError: class extends Error {},
}));

const schedule = {
  week: {
    id: "week-2026-4",
    season: 2026,
    seasonType: 2 as const,
    weekNumber: 4,
    deadlineUtc: "2099-09-24T00:00:00.000Z",
    scheduleFetchedAt: "2026-09-01T00:00:00.000Z",
    scheduleStatus: "available" as const,
  },
  games: [],
};

function createClients() {
  const supabase = {
    from(table: string) {
      if (table === "weekly_entries") {
        return {
          select: () => ({
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        };
      }
      if (table === "league_memberships") {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                { participant_id: "member-a" },
                { participant_id: "member-b" },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: "member-a", display_name: "Alex" },
                { id: "member-b", display_name: "Blake" },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`Unexpected session query for ${table}`);
    },
  };
  const admin = {
    from(table: string) {
      if (table !== "weekly_entries") {
        throw new Error(`Unexpected admin query for ${table}`);
      }
      return {
        select: (columns: string) => {
          expect(columns).toBe("participant_id");
          return {
            eq() {
              return this;
            },
            then: (resolve: (result: unknown) => unknown) =>
              Promise.resolve({
                data: [{ participant_id: "member-b" }],
                error: null,
              }).then(resolve),
          };
        },
      };
    },
  };
  return { supabase, admin };
}

describe("weekly picks API", () => {
  beforeEach(() => {
    mocks.requireLeagueMember.mockReset();
    mocks.getRegularSeasonWeek.mockReset().mockResolvedValue(schedule);
    mocks.createSupabaseAdminClient.mockReset();
  });

  it("returns submission status without exposing other picks before the deadline", async () => {
    const { supabase, admin } = createClients();
    mocks.requireLeagueMember.mockResolvedValue({
      supabase,
      user: { id: "member-a" },
    });
    mocks.createSupabaseAdminClient.mockReturnValue(admin);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({
        leagueId: "league-a",
        season: "2026",
        weekNumber: "4",
      }),
    });

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      otherEntries: [],
      submissionStatuses: [
        {
          participantId: "member-a",
          participantName: "Alex",
          isCurrentUser: true,
          hasSubmitted: false,
        },
        {
          participantId: "member-b",
          participantName: "Blake",
          isCurrentUser: false,
          hasSubmitted: true,
        },
      ],
    });
    expect(body).not.toHaveProperty("submissionStatuses.1.picks");
  });

  it("does not use elevated queries for users who are not league members", async () => {
    mocks.requireLeagueMember.mockRejectedValue(
      new HttpError(404, "LEAGUE_NOT_FOUND", "League not found."),
    );

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({
        leagueId: "league-a",
        season: "2026",
        weekNumber: "4",
      }),
    });

    expect(response.status).toBe(404);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
