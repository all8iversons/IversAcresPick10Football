<!--
Sync Impact Report
Version change: unversioned scaffold -> 1.0.0
Modified principles:
- Scaffold Principle 1 -> I. Server-Mediated NFL Data
- Scaffold Principle 2 -> II. Contest Integrity and UTC Lockout
- Scaffold Principle 3 -> III. League-Scoped Multi-Tenancy
- Scaffold Principle 4 -> IV. Typed and Accessible React
- Scaffold Principle 5 -> V. Verifiable Quality and Copilot Guardrails
Added sections:
- Platform and Data Constraints
- Contest Operations and Quality Gates
Removed sections: None
Follow-up TODOs:
- Determine the original ratification date; no prior version or repository history
  was available.
-->
# NFL 10-Pick Competition App Constitution

## Core Principles

### I. Server-Mediated NFL Data
The client MUST use dedicated services or custom hooks to synchronize API data and
MUST keep UI state separate from the server cache. NFL schedule and game-status
data MUST be obtained through the `NFLScheduleService` adapter, cached, and never
fetched directly from an end-user browser render. The primary source is the ESPN
Scoreboard/Schedule endpoint. The adapter MUST keep the data source replaceable
without requiring changes to contest business logic. This boundary centralizes
caching and makes provider changes safe.

### II. Contest Integrity and UTC Lockout
Each weekly entry MUST contain exactly 10 distinct team picks for the active
regular-season week, and MUST NOT select both teams in the same game. Submission
locks at the Thursday Night Football kickoff; if that week has no Thursday game,
the lock time MUST be the earliest kickoff of that week. At or after the UTC
deadline, the client MUST disable pick toggling and submission, and the server
MUST reject pick creation or modification. A win scores 1.0 point, a loss 0.0
points, and a tie 0.5 points for a pick of either team. These rules MUST be
enforced consistently in the interface and authoritative server logic.

### III. League-Scoped Multi-Tenancy
Picks, weekly summaries, scoring, and rankings MUST be associated with a
`LeagueId`; users MUST only access league data for leagues in which they are
members. Users MUST be able to create and join private leagues using invite codes
and participate in multiple leagues. A weekly pick set MUST be reusable across
joined leagues or customizable per league; each league-specific entry MUST retain
explicit league scope. A participant MUST have no more than one entry per league
for a given week. Weekly and season leaderboards MUST be league-specific and use
standard competition ranking for ties (for example, 1, 1, 3). League scoping
prevents accidental data leakage and keeps standings meaningful to each contest.

### IV. Typed and Accessible React
The client MUST use React with TypeScript, functional components, hooks, and
Strict Mode. TypeScript MUST remain strict, `any` MUST NOT be used, and the
domain types `GameMatchup`, `UserPick`, `WeeklyEntry`, `League`, and
`LeaderboardStanding` MUST be explicit. Components MUST keep presentation
separate from state containers and providers; matchup, pick, and leaderboard
views MUST be modular. Pick controls MUST be controlled and accessible, with
clear validation feedback and a visible selected-pick count such as `X / 10
selected`. Schedule and deadline data MUST be stored and transmitted in UTC as
ISO 8601 values; conversion to local time is presentation-only.

### V. Verifiable Quality and Copilot Guardrails
Changes to lockout, pick validation, scoring, or schedule ingestion MUST be
covered by automated tests. The test suite MUST verify lockout behavior at one
second after kickoff for both disabled client controls and rejected submissions;
reject entries with fewer or more than 10 picks; and verify 1.0, 0.0, and 0.5
scoring for wins, losses, and ties. ESPN responses MUST be mocked with static JSON
fixtures. Contributors and coding assistants MUST NOT omit lockout checks, leave
lockout TODOs, hardcode team abbreviations, weekly matchups, or dates in React
components, or calculate deadlines using device-local offsets without UTC
normalization.

## Platform and Data Constraints
The application MUST use React and TypeScript on the client and MUST centralize
API synchronization in dedicated services or custom hooks. The ESPN endpoint
`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` is the
primary free NFL schedule source. Schedule and game-status payloads MUST be
cached. The `NFLScheduleService` adapter MUST isolate provider-specific details
from domain logic so another external source can be substituted without
rewriting contest rules.

## Contest Operations and Quality Gates
An entry MUST be validated for exactly 10 distinct picks and no conflicting
teams from the same matchup before it is accepted. Deadline comparisons MUST use
UTC and treat `Date.now() >= deadlineUtc` as locked. The server is authoritative:
client-side disabled states improve feedback but do not replace server rejection.
Leaderboard calculations MUST aggregate weekly points for the selected week and
cumulative points across completed weeks, scoped to the league. Tests MUST use
static fixtures for external scoreboard data rather than live API calls.

## Governance
This constitution governs feature specifications, implementation, review, and
testing for the application. Amendments MUST be proposed with their rationale
and affected principles, reviewed and approved by project maintainers, and
updated in this document. Changes that alter an existing obligation or remove a
principle require a MAJOR version increment; adding a principle or materially
expanding guidance requires a MINOR increment; clarifications and non-semantic
edits require a PATCH increment. The version MUST follow `MAJOR.MINOR.PATCH`.

Every feature review MUST check applicable principles, including league data
isolation, server-side lockout enforcement, UTC handling, and test coverage.
Reviewers MUST require the relevant tests to pass before accepting changes and
MUST request explicit justification for deviations from this constitution.
When an amendment changes implementation expectations, the proposal MUST identify
the affected guidance and tests so follow-up work can be tracked.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): Original adoption date unknown | **Last Amended**: 2026-10-27
