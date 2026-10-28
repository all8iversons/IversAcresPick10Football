# Tasks: NFL Weekly Picks

**Input**: Design documents from `specs/001-nfl-weekly-picks/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/http-api.md`, `quickstart.md`

**Tests**: Automated tests are required by the project constitution for NFL
fixtures, pick validation, lockout, and scoring. Database privacy and transaction
behavior also require local database tests.

**Organization**: Tasks are grouped by user story. US1 establishes authenticated
private leagues; US2 implements schedule and weekly pick submission; US3 adds
scoring and standings.

## Phase 1: Setup

**Purpose**: Initialize the application and shared development tooling.

- [X] T001 Create the Next.js App Router application with React and strict TypeScript configuration in `package.json`, `tsconfig.json`, `next.config.ts`, and `src/app/layout.tsx`.
- [X] T002 [P] Configure formatting, linting, and strict type-check scripts in `eslint.config.mjs`, `.prettierrc.json`, and `package.json`.
- [X] T003 [P] Configure local Supabase services, migration paths, and safe environment examples in `supabase/config.toml` and `.env.example`.
- [X] T004 [P] Configure Vitest and Playwright projects, scripts, and test discovery in `vitest.config.ts`, `playwright.config.ts`, and `package.json`.
- [X] T005 [P] Add pull-request CI jobs for lint, typecheck, unit/integration tests, and production build in `.github/workflows/ci.yml`.

## Phase 2: Foundational

**Purpose**: Shared server, authentication, and domain foundations required by
all user stories.

- [X] T006 Implement typed Supabase browser and server clients with cookie-based sessions and server-only privileged credentials in `src/lib/auth/supabase-browser.ts`, `src/lib/auth/supabase-server.ts`, and `src/lib/db/supabase-admin.ts`.
- [X] T007 Implement authenticated-participant lookup and reusable league membership authorization helpers in `src/lib/auth/current-participant.ts` and `src/lib/auth/require-league-member.ts`.
- [X] T008 Define shared domain types for `GameMatchup`, `UserPick`, `WeeklyEntry`, `League`, and `LeaderboardStanding` in `src/domain/types.ts`.
- [X] T009 Implement common JSON response, request parsing, and error mapping for `401`, `403`/non-disclosing `404`, `409`, `422`, and `503` in `src/lib/http/responses.ts` and `src/lib/http/errors.ts`.
- [X] T010 Create the base migration and local database test setup with RLS enabled by default for application tables in `supabase/migrations/00000000000000_base.sql` and `supabase/tests/helpers.sql`.

## Phase 3: User Story 1 - Join a Private League (Priority: P1)

**Goal**: Participants can authenticate, create private leagues, join with
invite codes, and access only league data for leagues where they are members.

**Independent Test**: Create two accounts and two private leagues with disjoint
membership; verify league creation and invite joining, and verify that each
account is denied access to the other league's private data.

### Tests for User Story 1

- [ ] T011 [P] [US1] Add integration tests for account signup/sign-in session handling and league membership authorization in `tests/integration/auth-and-league-access.test.ts`.
- [ ] T012 [P] [US1] Add local PostgreSQL RLS tests proving members can read their leagues and non-members cannot read leagues, memberships, entries, or standings in `supabase/tests/league-privacy.test.sql`.

### Implementation for User Story 1

- [X] T013 [US1] Create participant, league, and membership tables with these exact rules: Participant `id`: "Primary identifier; sourced from the verified authentication identity"; `email`: "Managed by the authentication provider; unique according to provider rules"; `createdAt`: "Required"; League `id`: "Primary identifier"; `name`: "Required; trimmed and non-empty"; `inviteCodeHash`: "Required; unique; raw invite code is not persisted"; `createdBy`: "Required; creator becomes owner/member"; `createdAt`: "Required"; Membership `leagueId` and `participantId`: "Required; part of composite primary key"; `role`: "`owner` or `member`; creator is `owner`"; `joinedAt`: "Required"; enforce one membership per `(leagueId, participantId)` in `supabase/migrations/00000000000001_leagues.sql`.
- [ ] T014 [US1] Implement invite-code generation, secure hashing, constant-time lookup, single-time creator return, and code acceptance without disclosing whether invalid codes map to a league in `src/services/leagues/invite-codes.ts`.
- [X] T015 [US1] Implement authenticated create, list, and join league handlers using the contract shapes and membership checks in `src/app/api/leagues/route.ts` and `src/app/api/leagues/join/route.ts`.
- [X] T016 [US1] Add league membership RLS policies for leagues and memberships, with creator ownership and least-privilege table grants in `supabase/migrations/00000000000002_league_rls.sql`.
- [X] T017 [P] [US1] Implement accessible signup, sign-in, and auth callback pages with verified server sessions in `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-up/page.tsx`, and `src/app/auth/callback/route.ts`.
- [X] T018 [US1] Implement league list, create, and invite-code join forms with clear validation and success/error states in `src/app/leagues/page.tsx`, `src/components/leagues/LeagueForm.tsx`, and `src/components/leagues/JoinLeagueForm.tsx`.
- [ ] T019 [US1] Run the US1 database privacy and API integration tests and correct any access-control failures in `supabase/tests/league-privacy.test.sql` and `tests/integration/auth-and-league-access.test.ts`.

**Checkpoint**: A participant can create or join private leagues, and
non-members cannot access their private data.

## Phase 4: User Story 2 - Submit Weekly Picks (Priority: P1)

**Goal**: League members review the current schedule and submit exactly 10 valid
team picks before the authoritative weekly deadline.

**Independent Test**: For a league member and an upcoming week, load fixture-backed
matchups, submit 10 picks from different games before lock, and verify invalid,
conflicting, and late submissions fail without partial writes.

### Tests for User Story 2

- [ ] T020 [P] [US2] Add representative static ESPN scoreboard JSON fixtures for normal matchups, Thursday games, Friday-UTC Thursday kickoffs, ties, stale data, and unavailable provider responses in `tests/fixtures/espn/`.
- [ ] T021 [P] [US2] Add unit tests for ESPN normalization, season/week validation, cache behavior, and unavailable/stale states using only static fixtures in `tests/unit/nfl-schedule-service.test.ts`.
- [X] T022 [P] [US2] Add deterministic deadline tests for a single Thursday game, multiple Thursday-local games, no Thursday games, Friday UTC kickoffs, exact kickoff, and one second after kickoff in `tests/unit/deadline.test.ts`.
- [X] T023 [P] [US2] Add domain tests rejecting 9 or 11 picks, duplicate games, non-participant teams, and games from another week in `tests/unit/pick-validation.test.ts`.
- [ ] T024 [P] [US2] Add integration tests for authenticated pick writes, atomic replacement, membership denial, and server rejection exactly at and one second after deadline in `tests/integration/pick-submission.test.ts`.

### Implementation for User Story 2

- [X] T025 [US2] Create regular-season week and game tables with these exact rules: NFL Week `id`: "Primary identifier"; `season`: "Required NFL season year"; `seasonType`: "Regular season only for this feature"; `weekNumber`: "Required; regular-season week number"; `deadlineUtc`: "Required; TNF kickoff or earliest weekly kickoff fallback"; `scheduleFetchedAt`: "Required; used to communicate schedule freshness"; `scheduleStatus`: "`available`, `stale`, or `unavailable`"; enforce one week per `(season, seasonType, weekNumber)`; Game `id`: "Internal primary identifier"; `sourceEventId`: "Required and unique within provider; not exposed as a pickable team identity"; `weekId`: "Required"; home and away team IDs/names: "Required", with away team ID "different from home team"; `kickoffUtc`: "Required ISO 8601 instant"; `venueTimeZone`: "Required to classify local Thursday schedules; missing values must be resolved by server-side schedule mapping before deadline calculation"; `isThursdayNightGame`: "Derived by schedule adapter from reliable provider designation or documented Thursday-slate fallback"; `status`: "`scheduled`, `in_progress`, `final`, `postponed`, `cancelled`, or `unknown`"; scores are nullable until provider supplies valid values; `finalResult`: "`home_win`, `away_win`, `tie`, or `undetermined`; only set from a final game with valid scores"; `updatedAt`: "Required" in `supabase/migrations/00000000000003_schedule.sql`.
- [X] T026 [US2] Implement the server-only `NFLScheduleService` interface and ESPN adapter requesting explicit season, regular-season type, week, and event limit; validate response season/week and normalize provider payloads in `src/services/nfl/NFLScheduleService.ts` and `src/services/nfl/espn/ESPNNFLScheduleService.ts`.
- [X] T027 [US2] Implement database-backed schedule caching, refresh timestamps, stale/unavailable reporting, and normalized upsert behavior in `src/services/nfl/schedule-cache.ts` and `src/services/nfl/schedule-refresh.ts`.
- [X] T028 [US2] Implement UTC deadline derivation using the venue-local Thursday slate, reliable TNF metadata when available, documented latest-Thursday kickoff fallback otherwise, and earliest weekly kickoff when Thursday games are absent in `src/domain/deadline.ts`.
- [X] T029 [US2] Create weekly-entry and team-pick tables with these exact rules: Entry `id`: "Primary identifier"; `leagueId`, `participantId`, and `weekId`: "Required"; `participantId`: "must be a league member"; `weekId`: "active regular-season week"; `submittedAt`: "Set on successful creation or replacement"; `updatedAt`: "Updated on valid replacement"; unique `(leagueId, participantId, weekId)`; a submitted entry is replaceable only before deadline and immutable at/after deadline; Pick `entryId`: "Required"; `gameId`: "Required; part of composite uniqueness"; `selectedTeamId`: "Must equal that game's home or away team"; `pointsAwarded`: "Null until final; 1.0 for win, 0.0 for loss, 0.5 for final tie"; unique `(entryId, gameId)` and require exactly 10 picks from the entry's week in `supabase/migrations/00000000000004_weekly_entries.sql`.
- [X] T030 [US2] Implement server-side pick validation for exactly 10 unique games, one valid participating team per game, and all games in the requested week in `src/domain/validate-picks.ts` and `src/lib/validation/pick-request.ts`.
- [X] T031 [US2] Implement a database transaction/RPC that checks the authenticated member, compares database current time with the stored UTC deadline, replaces the participant's 10 picks atomically, and rejects all writes at or after lockout in `supabase/migrations/00000000000005_submit_weekly_entry.sql`.
- [X] T032 [US2] Implement member-authorized week and pick `GET`/`PUT` route handlers using the documented response/error shapes and server-only cached schedule reads in `src/app/api/leagues/[leagueId]/weeks/[season]/[weekNumber]/route.ts` and `src/app/api/leagues/[leagueId]/weeks/[season]/[weekNumber]/picks/route.ts`.
- [X] T033 [P] [US2] Implement accessible matchup rows, controlled team-pick cards, live `X / 10 selected` feedback, submission status, and localized display of UTC times in `src/components/picks/MatchupRow.tsx`, `src/components/picks/PickCard.tsx`, and `src/components/picks/PickCount.tsx`.
- [X] T034 [US2] Implement the weekly picks page and API synchronization hook with disabled pick controls at or after the UTC deadline in `src/app/leagues/[leagueId]/weeks/[season]/[weekNumber]/page.tsx` and `src/hooks/use-weekly-picks.ts`.
- [ ] T035 [US2] Run fixture-backed schedule, deadline, validation, transaction, and route tests; verify external provider calls occur only through `NFLScheduleService` in `tests/unit/`, `tests/integration/pick-submission.test.ts`, and `tests/fixtures/espn/`.
- [ ] T036 [US2] Add a browser workflow proving one participant can submit 10 picks, revise them before lock, and sees disabled controls plus server rejection at kickoff and one second after in `tests/e2e/weekly-picks.spec.ts`.

**Checkpoint**: A member can review cached matchups and submit or revise exactly
10 valid picks before lock; the server rejects invalid or late attempts.

## Phase 5: User Story 3 - Follow Results and Standings (Priority: P2)

**Goal**: League members see final pick outcomes, weekly scores, season totals,
and standard competition ranks.

**Independent Test**: Load final win, loss, and tie fixtures and multiple league
entries; verify 1.0/0.0/0.5 scoring, league-scoped weekly and season totals, and
1, 1, 3 tie ranks.

### Tests for User Story 3

- [X] T037 [P] [US3] Add scoring unit tests for winning picks at 1.0, losing picks at 0.0, either selected team in a final tie at 0.5, and non-final games remaining unscored in `tests/unit/scoring.test.ts`.
- [ ] T038 [P] [US3] Add integration tests for league-scoped weekly/season totals, standard competition ranks, hidden pre-deadline picks, and non-member denial in `tests/integration/standings.test.ts`.

### Implementation for User Story 3

- [X] T039 [US3] Implement scoring only for final games with valid scores; classify ties only when final scores are equal and calculate 1.0/0.0/0.5 outcomes in `src/domain/scoring.ts` and `src/services/scoring/score-final-games.ts`.
- [X] T040 [US3] Implement league-scoped weekly totals and season totals across completed weeks with standard competition ranking in `src/services/standings/standings-service.ts`.
- [X] T041 [US3] Implement member-authorized standings and pick-visibility route behavior, hiding other members' picks before the weekly deadline and exposing standings in `src/app/api/leagues/[leagueId]/standings/route.ts`.
- [ ] T042 [P] [US3] Implement accessible weekly and season leaderboard table views with explicit empty/loading/error states in `src/components/leaderboard/LeaderboardTable.tsx`.
- [X] T043 [US3] Implement league weekly/season standings pages and navigation to a participant's own scored entry in `src/app/leagues/[leagueId]/standings/page.tsx` and `src/app/leagues/[leagueId]/weeks/[season]/[weekNumber]/results/page.tsx`.
- [ ] T044 [US3] Run scoring, standings, row-level privacy, and browser-result tests against win/loss/tie fixtures and disjoint league memberships in `tests/unit/scoring.test.ts`, `tests/integration/standings.test.ts`, and `tests/e2e/standings.spec.ts`.

**Checkpoint**: Final results are scored correctly and members see accurate
league-specific weekly and season standings, including tied ranks.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate complete feature quality and cross-story requirements.

- [ ] T045 [P] Verify keyboard and assistive-technology operation for authentication, league management, pick selection, lockout feedback, and standings; fix issues in `src/app/`, `src/components/`, and `src/hooks/`.
- [ ] T046 [P] Review RLS policies, invite-code secrecy, session validation, request schemas, and service-role credential boundaries; address findings in `supabase/migrations/`, `src/lib/auth/`, and `src/services/leagues/invite-codes.ts`.
- [ ] T047 [P] Verify schedule freshness and user-visible behavior under ESPN timeout, malformed response, stale cache, and unavailable cache conditions in `src/services/nfl/` and `src/components/`.
- [ ] T048 Run the complete local setup and validation guide, including lint, typecheck, unit/integration tests, Playwright, and production build, and record any setup corrections in `specs/001-nfl-weekly-picks/quickstart.md`.
- [X] T049 Update application onboarding, environment-variable documentation, and local Supabase instructions in `README.md` and `.env.example`.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 establishes the application base,
  while tooling, local database configuration, test runners, and CI can be
  prepared in parallel where files do not overlap.
- **Foundational (Phase 2)**: Depends on Setup; shared authentication, domain
  types, errors, and database test infrastructure block story work.
- **US1 (Phase 3)**: Depends on Foundation; establishes accounts and league
  membership used by weekly entry and standings access checks.
- **US2 (Phase 4)**: Depends on Foundation and US1 membership/authorization;
  schedule and picks can be completed independently of scoring UI.
- **US3 (Phase 5)**: Depends on US2 schedule, entries, and game results.
- **Polish (Phase 6)**: Depends on all stories selected for release.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundation; independent of other stories.
- **US2 (P1)**: Starts after Foundation and requires US1's authenticated
  participant and league membership.
- **US3 (P2)**: Requires persisted schedules and submitted entries from US2.

### Within Each User Story

- Tests are included because the constitution requires test coverage; test
  tasks precede their implementation tasks where practical.
- Migrations/domain rules precede services and route handlers; route handlers
  precede integrated UI workflows.
- Story checkpoints are independently verifiable using the listed tests and
  fixture data.

### Parallel Opportunities

- Setup: T002, T003, T004, and T005 can proceed alongside the application
  scaffold when changes are kept to their separate configuration files.
- Foundation: T006, T008, T009, and T010 can be implemented in separate files
  after T001; T007 depends on the auth-client shape from T006.
- US1: T011 and T012 are independent test suites; T017 can proceed in parallel
  with league schema/service work once shared auth helpers exist.
- US2: T020-T024 are independent test suites/fixtures; T026-T028 can be
  implemented in separate schedule files; T033 can proceed independently from
  server persistence after the shared domain types are ready.
- US3: T037 and T038 are independent tests; T039 and T042 can proceed in
  separate domain/UI files after relevant shared types are stable.
- Polish: T045-T047 can be reviewed in parallel by concern; T048 follows fixes.

## Parallel Examples

### User Story 1

```text
Task: T011 auth and league API integration tests
Task: T012 PostgreSQL league privacy/RLS tests
Task: T017 signup, sign-in, and callback pages (after T006)
```

### User Story 2

```text
Task: T020 static ESPN fixtures
Task: T022 deadline boundary tests
Task: T023 pick validation tests
Task: T033 accessible matchup and pick components
```

### User Story 3

```text
Task: T037 scoring unit tests
Task: T038 standings and privacy integration tests
Task: T042 leaderboard table component
```

## Implementation Strategy

### MVP First (US1 and US2)

1. Complete Setup and Foundation.
2. Complete US1 so authenticated members can create and join private leagues.
3. Complete US2 so league members can load current matchups and submit valid
   picks under authoritative deadline enforcement.
4. Validate account, membership, privacy, fixture-backed schedule, exact-ten
   entry, lockout boundaries, and browser accessibility.
5. Deploy/demo the private league and pick-submission flow before adding
   standings if incremental release is desired.

### Incremental Delivery

1. Setup + Foundation -> shared application base.
2. US1 -> authenticated private leagues and membership privacy.
3. US2 -> current schedule, lockout, and 10-team submissions.
4. US3 -> final scoring and weekly/season rankings.
5. Polish -> complete access-control, accessibility, resilience, and quickstart
   validation.

## Notes

- Every task uses the required checkbox, sequential ID, optional `[P]`, story
  label for story phases, and explicit file path(s).
- `[P]` indicates independent work in different files; story tasks without it
  have ordering or shared-file dependencies.
- ESPN response examples are static fixtures; unit and integration tests do not
  depend on live provider availability.
- The deadline classifier depends on reliable venue-local timezone data. The
  timezone mapping must be resolved in the server schedule adapter, never
  inferred from UTC weekday in UI code.
