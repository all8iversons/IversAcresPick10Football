# Quickstart: NFL Weekly Picks

This guide describes the local validation path for the implementation planned
in [plan.md](./plan.md). The repository currently has no application scaffold,
package manifest, database configuration, or tests; the commands below become
runnable as those implementation tasks are completed.

## Prerequisites

- Node.js LTS and npm
- Supabase CLI and Docker for local PostgreSQL/Auth
- A supported browser for end-to-end testing
- Optional ESPN connectivity for manual schedule refresh checks; automated
  tests use static fixtures and do not require ESPN access

## Local setup

1. Install the application dependencies after the app scaffold is created:

   ```powershell
   npm install
   ```

2. Start local Supabase services:

   ```powershell
   npx supabase start
   ```

3. Copy the local Supabase API URL and anon key from CLI output into
   `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Set `SUPABASE_SERVICE_ROLE_KEY` from the
   local Supabase service-role key; never expose it to the browser.

4. Apply migrations and fixtures:

   ```powershell
   npx supabase db reset
   ```

5. Start the website:

   ```powershell
   npm run dev
   ```

## Validation scenarios

1. **Schedule**: Load a week and confirm UTC kickoff instants display in local
   time. Stop external connectivity and verify cached data is marked stale or
   unavailable without inventing matchups. Automated schedule tests load static
   ESPN fixtures.
2. **Valid entry**: Sign in, create a private league, add a second participant,
   select one side from each of 10 games, and submit. Confirm the saved entry
   contains exactly 10 picks.
3. **Invalid entries**: Try 9 and 11 picks, duplicate games, a team that is not
   in the referenced matchup, and a game from another week. Confirm each request
   fails and no partial entry is persisted.
4. **Deadline boundary**: With a fixed/injected clock, verify submission one
   second before kickoff succeeds, and attempts exactly at kickoff and one
   second after kickoff fail. Confirm the client disables selection at the
   deadline and the server independently rejects direct requests.
5. **Deadline selection**: Test one Thursday game, multiple Thursday-local
   games, a week with no Thursday game, and kickoffs that fall on Friday UTC.
   Verify classification uses local schedule metadata and stores a UTC
   deadline.
6. **Scoring**: Finalize fixture games as home win, away win, and tie; confirm
   correct picks score 1.0, incorrect picks 0.0, and either team picked in a
   tie scores 0.5. Confirm non-final games remain unscored.
7. **Privacy**: Create two leagues with disjoint membership. Verify non-members
   cannot read private entries or standings; own picks remain visible before
   lockout while other members' picks stay hidden until lockout.
8. **Submission status and history**: Before lockout, verify league members can
   see who submitted and refresh the status without seeing other members'
   picks. Navigate to a prior week and verify submitted league picks are shown
   only after that week's deadline and only to league members.
9. **Rankings**: Verify weekly and season totals include only the selected
   league, equal totals use standard competition ranks, and season totals sum
   completed weeks.
10. **Accessibility**: Complete pick review and submission with keyboard-only
   navigation and an assistive-technology smoke test; check labels, focus,
   errors, selection count, lockout, and submission announcements.

## Automated commands

Once scripts are added to `package.json`, the expected validation commands are:

```powershell
npm run lint
npm run typecheck
npm test
npx playwright test
npm run build
```

Use focused Vitest tests for domain rules, API validation, scoring, and
`NFLScheduleService`; use local Supabase/Postgres integration tests for RLS,
uniqueness, and atomic transactions; use Playwright for browser workflows. See
[data-model.md](./data-model.md) and [contracts/http-api.md](./contracts/http-api.md)
for domain invariants and endpoint behavior.
