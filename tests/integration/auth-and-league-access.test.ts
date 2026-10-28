import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/leagues/route";
import { HttpError } from "@/lib/http/errors";

const authState = vi.hoisted(() => ({
  requireCurrentParticipant: vi.fn(),
}));

vi.mock("@/lib/auth/current-participant", () => ({
  requireCurrentParticipant: authState.requireCurrentParticipant,
}));

describe("league API authentication and isolation boundary", () => {
  beforeEach(() => {
    authState.requireCurrentParticipant.mockReset();
  });

  it("rejects league creation when no verified session exists", async () => {
    authState.requireCurrentParticipant.mockRejectedValue(
      new HttpError(401, "UNAUTHENTICATED", "Sign in to continue."),
    );
    const response = await POST(
      new Request("http://localhost/api/leagues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Private League" }),
      }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("does not expose leagues without a matching membership", async () => {
    const visibleLeagues = [
      { id: "league-a", name: "League A", created_at: "2026-01-01T00:00:00Z" },
    ];
    const memberships = [{ league_id: "league-a", role: "owner" }];
    const supabase = {
      from(table: string) {
        if (table === "league_memberships") {
          return {
            select: () => ({
              eq: async () => ({ data: memberships, error: null }),
            }),
          };
        }
        return {
          select: () => ({
            in: async (_column: string, ids: string[]) => ({
              data: visibleLeagues.filter((league) => ids.includes(league.id)),
              error: null,
            }),
          }),
        };
      },
    };
    authState.requireCurrentParticipant.mockResolvedValue({
      supabase,
      user: { id: "participant-a" },
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      leagues: [
        {
          id: "league-a",
          name: "League A",
          role: "owner",
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
    });
  });
});
