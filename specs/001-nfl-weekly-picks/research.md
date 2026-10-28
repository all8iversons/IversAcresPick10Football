# Research: NFL Weekly Picks

## Architecture and Runtime

**Decision**: Start with one Next.js App Router application using React and
strict TypeScript. Run authenticated server route handlers alongside the client
and deploy the application to a serverless-capable platform such as Vercel.
Use Supabase Auth for identity and managed PostgreSQL for relational data.

**Rationale**: The repository is empty, the product needs both an interactive
React client and authoritative server-side writes, and a single application
avoids operating two services for the MVP. PostgreSQL transactions and row-level
security support the required league isolation and atomic pick submission.

**Alternatives considered**: A separate React frontend and Node API would add a
second deployment and cross-service configuration. A different managed
PostgreSQL provider remains viable if authentication and database hosting are
selected separately; the domain and SQL transaction requirements remain the
same.

**References**:
[Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route),
[Vercel Functions](https://vercel.com/docs/functions),
[Supabase SSR Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Schedule Provider and Normalization

**Decision**: Implement the constitution-mandated, server-only
`NFLScheduleService` with an ESPN adapter requesting explicit season year,
regular-season type, week, and a high event limit. Validate returned season and
week before normalizing games. Persist normalized schedule and status data and
serve cached records to users; respect upstream cache headers and use bounded
short-lived refresh caching for current schedules. Static JSON fixtures cover
provider behavior in automated tests.

**Rationale**: ESPN's public scoreboard response includes the requested season
and week, event IDs, UTC kickoff timestamps, competitor identities and scores,
and completion state. Explicit season type avoids ambiguity because week numbers
repeat between preseason, regular season, and postseason. The response is useful
but not a documented stable API and has no verified service-level guarantee, so
normalization, cache, error states, and a replaceable adapter limit provider
coupling.

**Alternatives considered**: Calling ESPN in browser renders violates the
constitution and exposes provider availability to every page view. Replacing
ESPN now is not warranted; the adapter allows a provider change after a future
review of access terms, coverage, reliability, and pricing.

**References**:
[ESPN scoreboard endpoint](https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard),
[ESPN NFL scoreboard](https://www.espn.com/nfl/scoreboard)

## Deadline Classification

**Decision**: Normalize each game's kickoff to UTC and determine its weekday in
the venue's local time zone when available. Among games scheduled on Thursday
local time, use an explicitly recognized Thursday Night Football designation
when provider schedule metadata reliably supplies one. Because the inspected
ESPN response did not contain a dependable TNF flag, the initial adapter uses
the latest-kickoff Thursday-local game as the deterministic TNF fallback
within that week's Thursday slate. If there are no Thursday-local games, use
the earliest kickoff in the week. Persist the computed deadline in UTC and
recompute it whenever the schedule changes. The classification and fallback
are unit-tested with fixtures for a single Thursday game, multiple Thursday
games, and no Thursday game.

**Rationale**: ESPN event dates are UTC and can fall on Friday UTC for a
Thursday-night US game; using UTC weekday would incorrectly miss Thursday
games. The endpoint does not expose a documented TNF marker, and broadcast
names alone do not provide a reliable event classification. An adapter-level
classification avoids hardcoding dates or rules in components and keeps the
contest deadline logic independently testable.

**Alternatives considered**: Infer Thursday from the UTC weekday (incorrect
around US evening kickoffs); assume a particular broadcast name means TNF
(incomplete and provider-specific); require manual event designation (adds an
admin workflow not present in the spec). If future schedule metadata provides
a stable TNF designation, prefer it over the fallback heuristic.

**Open limitation**: ESPN's inspected schedule response did not expose a venue
time zone. The adapter must use a reliable stadium/team time-zone mapping or
an authoritative local schedule classification; it must not guess from UTC.
This mapping belongs in the server schedule integration, not in UI components.

## Authentication and League Data Isolation

**Decision**: Use Supabase Auth with cookie-based server-side sessions. Each
request derives the participant identity from the verified session, checks
league membership, and performs data access with least privilege. Enable
PostgreSQL RLS and grants as defense in depth; keep privileged service-role
credentials server-only and avoid them for ordinary member requests.

**Rationale**: The app stores private entries and standings across multiple
leagues. Client-supplied user and league identifiers are untrusted; authorization
must be checked for every operation and enforced again at the database boundary.
Picks remain hidden from other members until the deadline passes, after which
league members may view entries and standings. This is the MVP fairness default;
participants can always view their own entry.

**Alternatives considered**: Client-side-only filtering is not an authorization
boundary. A custom authentication system adds unnecessary scope. Allowing all
members to view picks before lockout could influence choices, so it is not the
default.

**References**:
[Supabase SSR Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Pick Validation and Atomic Persistence

**Decision**: Validate request shapes with runtime schemas and domain rules on
the server: exactly 10 picks, 10 distinct games, one valid participating team
per game, and all games in the requested week. Persist the entry and its picks
atomically. In the same transaction, derive/verify the current deadline using
database time and reject the write when current time is at or after lockout.
Use uniqueness and foreign-key constraints for per-entry uniqueness and valid
references; perform exact-count and cross-row validation in the transaction,
not a row-level `CHECK`.

**Rationale**: Client-side checks are feedback only. A transaction prevents a
partial entry or a race between deadline check and write. PostgreSQL constraints
protect stored row invariants while application/domain checks handle rules over
multiple rows.

**Alternatives considered**: Sequential non-transactional inserts can leave
partial picks; checking the deadline only in the browser or before a separate
write permits late submissions and race conditions.

**References**:
[Zod basics](https://zod.dev/basics),
[PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html),
[PostgreSQL date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html)

## Quality and Test Strategy

**Decision**: Use Vitest for domain and API tests, local Supabase/PostgreSQL for
migration, RLS, and transaction tests, and Playwright for browser flows. CI
should run formatting/linting, strict type checking, tests, and a production
build. Every ESPN response is mocked with checked-in static JSON fixtures.

**Rationale**: The feature has important boundary behavior that should be
tested at its actual enforcement layer: pure rules in domain tests, private
access and transaction behavior against a database, and accessible workflow
behavior in a browser.

**Alternatives considered**: Mock-only authorization tests cannot prove RLS
policies; live ESPN tests are nondeterministic and can fail for reasons outside
the product.

**References**:
[Vitest](https://vitest.dev/guide/),
[Playwright](https://playwright.dev/docs/intro),
[GitHub Actions Node.js workflows](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
