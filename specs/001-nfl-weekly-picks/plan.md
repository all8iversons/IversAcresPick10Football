# Implementation Plan: NFL Weekly Picks

**Branch**: `main` (feature branch not created) | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-nfl-weekly-picks/spec.md`

## Summary

Deliver a private, multi-league NFL weekly-picks website. Participants join
leagues, review a cached current NFL schedule, submit exactly 10 valid team
picks before a server-enforced weekly lock, and follow league-scoped scoring
and standings. Build the first release as a single strict-TypeScript Next.js
application with server route handlers, Supabase Auth and PostgreSQL. Keep ESPN
behind a server-only `NFLScheduleService` adapter; enforce membership, pick
validation, and deadline rules on the server and transactionally in the
database.

## Technical Context

**Language/Version**: TypeScript, strict mode; Node.js LTS (pin the supported
version in project tooling during implementation)

**Primary Dependencies**: React with Next.js App Router; Supabase Auth and
PostgreSQL; Zod for request validation; Vitest for unit/integration tests;
Playwright for browser end-to-end tests

**Storage**: Supabase-managed PostgreSQL for accounts, memberships, normalized
schedule, entries, picks, and results; database-backed caching of schedule
payloads

**Testing**: Vitest unit and integration tests; static ESPN JSON fixtures;
database authorization and transaction tests against a local Supabase/Postgres
environment; Playwright end-to-end tests

**Target Platform**: Responsive desktop and mobile browsers; server-rendered
web application and server routes deployable to Vercel

**Project Type**: Full-stack web application (single TypeScript project)

**Performance Goals**: In the primary user flow, schedule and league screens
should load within 2 seconds at the 95th percentile under expected MVP traffic;
pick submission should return a clear outcome within 2 seconds at the 95th
percentile, excluding external provider outages

**Constraints**: External schedule requests run server-side only; schedule and
game status are cached; ESPN is a public, undocumented provider without a
service-level guarantee; all times are stored and compared in UTC; a database
transaction is authoritative for deadline checks and atomic pick replacement;
private league data requires membership authorization and row-level security;
no dependency manifests or application code exist yet

**Scale/Scope**: Initial release targets small private leagues and a single NFL
regular season, with multi-league membership, schedule, weekly entries,
scoring, and standings; no live wagering or postseason play

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Plan |
|---|---|---|
| I. Server-Mediated NFL Data | No provider calls from browser renders; use cached schedule data and a swappable adapter. | Pass: server-only `NFLScheduleService` normalizes provider payloads before persistence or response. |
| II. Contest Integrity and UTC Lockout | Exactly 10 distinct teams, no two sides of one game, TNF/earliest-game deadline, client disablement, authoritative rejection, and 1/0/0.5 scoring. | Pass: shared domain validation plus transactional database-time lock checks and focused tests. |
| III. League-Scoped Multi-Tenancy | All entries and standings are league-scoped; private league access is membership-checked. | Pass: authenticated server checks, relational constraints, and row-level security. |
| IV. Typed and Accessible React | Strict TypeScript, explicit domain types, modular views, controlled accessible picks, UTC storage. | Pass: strict mode, shared domain types, accessible controlled form, and UTC timestamps. |
| V. Verifiable Quality and Copilot Guardrails | Lockout, pick counts, scoring, and provider payloads tested; no hardcoded matchup data in UI. | Pass: static provider fixtures and unit, database, API, and browser tests. |

**Gate result**: PASS. No constitution violations or exceptions are required.

## Project Structure

### Documentation (this feature)

```text
specs/001-nfl-weekly-picks/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-api.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (auth)/
│   ├── leagues/
│   └── api/
├── components/
├── domain/
├── hooks/
├── lib/
│   ├── auth/
│   ├── db/
│   └── validation/
└── services/
    └── nfl/
        ├── NFLScheduleService.ts
        └── espn/
supabase/
├── migrations/
└── tests/
tests/
├── fixtures/
├── integration/
├── e2e/
└── unit/
```

**Structure Decision**: Use one Next.js application for React pages and
server-side route handlers, rather than a separate frontend and backend. Keep
contest rules in framework-independent domain modules; isolate provider,
authentication, database, and UI concerns behind their respective service
boundaries. Store migrations and PostgreSQL policy tests with the Supabase
database configuration. The repository currently has no source or test tree;
this structure is the proposed first application scaffold.

## Complexity Tracking

No constitution violations or additional projects are proposed; no complexity
exceptions require justification.
