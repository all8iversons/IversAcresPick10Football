import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCurrentParticipantMock } = vi.hoisted(() => ({
  requireCurrentParticipantMock: vi.fn(),
}));

vi.mock("@/lib/auth/current-participant", () => ({
  requireCurrentParticipant: requireCurrentParticipantMock,
}));

import { GET } from "@/app/api/leagues/route";

describe("GET /api/leagues", () => {
  beforeEach(() => {
    const membershipQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ league_id: "league-id", role: "owner" }],
        error: null,
      }),
    };
    const leagueQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          {
            id: "league-id",
            name: "Test League",
            invite_code: "shareable-invite-code",
            created_at: "2026-10-28T00:00:00.000Z",
          },
        ],
        error: null,
      }),
    };
    const supabase = {
      from: vi.fn((table: string) =>
        table === "league_memberships" ? membershipQuery : leagueQuery,
      ),
    };
    requireCurrentParticipantMock.mockResolvedValue({
      supabase,
      user: { id: "participant-id" },
    });
  });

  it("returns the invite code for each league the participant belongs to", async () => {
    const response = await GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      leagues: [
        {
          id: "league-id",
          name: "Test League",
          inviteCode: "shareable-invite-code",
          role: "owner",
          createdAt: "2026-10-28T00:00:00.000Z",
        },
      ],
    });
  });
});
