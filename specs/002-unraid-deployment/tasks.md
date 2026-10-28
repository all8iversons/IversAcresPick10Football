---
description: "Implementation tasks for deploying the NFL Pick 10 app and Supabase on Unraid"
---

# Tasks: Unraid Deployment

**Input**: Design documents from `specs/002-unraid-deployment/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/unraid-deployment.md`, and `quickstart.md`

**Tests**: No separate test-writing tasks are included because the feature specification does not explicitly request automated tests. The final validation task runs the existing application checks and the deployment checks in `quickstart.md`.

## Phase 1: Setup

**Purpose**: Add the production container build prerequisites for the existing Next.js application.

- [X] T001 [P] Add a multi-stage production Node.js 22 image build with Next.js standalone output and a non-root runtime user in `Dockerfile`; enable standalone output in `next.config.ts`.
- [X] T002 [P] Exclude local dependencies, build output, environment files, and repository-only files from the image build context in `.dockerignore`.

## Phase 2: Foundational

**Purpose**: Resolve the database compatibility and runtime configuration constraints that block the application and deployment work.

- [X] T003 [P] Confirm pinned Supabase self-hosted release `v1.26.08` (PostgreSQL 17.6.1.136) is compatible with `supabase/migrations/`, align `supabase/config.toml` to PostgreSQL 17, and record the selected release in `deploy/unraid/README.md`.
- [X] T004 [P] Add a typed server-only runtime configuration reader and unit coverage in `src/lib/config/supabase-runtime.ts` and `tests/unit/supabase-runtime-config.test.ts`; validate the public URL/key, internal Supabase URL, and private server credentials without returning secret values in errors.

**Checkpoint**: Runtime configuration and database compatibility are defined before implementing application endpoints or the Unraid stack.

## Phase 3: User Story 1 - Install the app and Supabase on Unraid (Priority: P1) 🎯 MVP

**Goal**: Install the Next.js app and required self-hosted Supabase services as a manageable Unraid Compose deployment.

**Independent Test**: On a supported Unraid host, follow the installation guide, start the app and required Supabase services, then reach the sign-in page from a second LAN device and create an account. Missing or invalid settings must leave the app not ready.

### Implementation for User Story 1

- [X] T005 [P] [US1] Implement `GET /api/config` in `src/app/api/config/route.ts` to return only the validated public Supabase URL and anon/publishable key.
- [X] T006 [P] [US1] Implement dependency-independent liveness and sanitized readiness routes in `src/app/api/health/live/route.ts` and `src/app/api/health/ready/route.ts`; readiness must require valid runtime settings, usable internal Supabase connectivity, and the required application schema.
- [X] T007 [US1] Refactor `src/lib/auth/supabase-browser.ts` and its consumers in `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`, and `src/components/leagues/LeagueDashboard.tsx` to obtain browser Supabase settings from `/api/config` at runtime and handle unavailable configuration explicitly.
- [X] T008 [P] [US1] Update `src/lib/auth/supabase-server.ts` and `src/lib/db/supabase-admin.ts` to use the internal Supabase URL and server-only credentials from `src/lib/config/supabase-runtime.ts`.
- [X] T009 [US1] Add `deploy/unraid/compose.unraid.yaml` as the application override layered onto the pinned official Supabase Compose release, defining the app service, health-based gateway dependency, private network, configurable app/gateway ports, a migration profile, and removal of published database/administration ports; add non-secret operator placeholders in `deploy/unraid/.env.unraid.example`.
- [X] T010 [US1] Write the installation, initial configuration, migration, startup, and troubleshooting guide in `deploy/unraid/README.md`, and link to it from the repository `README.md`.

**Checkpoint**: The app and Supabase can be installed together, the app is reachable on the LAN, and it reports ready only after required settings, dependencies, and schema are usable.

## Phase 4: User Story 2 - Keep the service and contest data available (Priority: P2)

**Goal**: Preserve accounts, leagues, memberships, picks, and Storage data through service restarts, container recreation, updates, and recovery.

**Independent Test**: Create a test account, league, membership, and entry; restart the stack and recreate the app container using the same persistent mappings; then complete the documented backup and isolated restore and verify those records.

### Implementation for User Story 2

- [X] T011 [P] [US2] Add `deploy/unraid/scripts/backup.sh` to create a PostgreSQL logical backup, PostgreSQL/pgsodium `db-config` volume archive, matching Supabase Storage archive, version metadata, and a protected encrypted configuration/secrets archive outside live data paths; fail explicitly if required inputs or backup steps fail.
- [X] T012 [US2] Add `deploy/unraid/scripts/restore.sh` to validate and restore a matching backup into a stopped deployment, restore the `db-config` volume before PostgreSQL, then restore database, Storage, and protected configuration in the documented order, and require explicit operator confirmation before replacing target state.
- [X] T013 [US2] Document backup, isolated restore verification, restart persistence, pinned app/Supabase updates, pre-update backup requirements, and recovery steps in `deploy/unraid/BACKUP-RESTORE.md`.

**Checkpoint**: Existing user and contest records survive routine lifecycle operations and can be restored from a verified backup.

## Phase 5: User Story 3 - Configure access safely (Priority: P3)

**Goal**: Help the operator expose only intended participant-facing endpoints and protect private deployment credentials.

**Independent Test**: Configure the stack for LAN access, verify only the app and API gateway ports are published, confirm private credentials are absent from browser responses and ordinary logs, and follow the documented HTTPS reverse-proxy prerequisites without exposing Supabase administration services.

### Implementation for User Story 3

- [X] T014 [P] [US3] Document LAN hostnames, configurable app and gateway ports, public versus internal URLs, reverse-proxy routing, HTTPS, and the prohibition on direct public exposure by default in `deploy/unraid/NETWORKING.md`.
- [X] T015 [P] [US3] Document protected secret configuration, public versus server-only credentials, log and browser exposure checks, and safe credential recovery/rotation practices in `deploy/unraid/SECRETS.md`.

**Checkpoint**: Operators can configure participant access without exposing private credentials or administrative endpoints by default.

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Connect the operator guides and verify the completed deployment against the feature's acceptance scenarios.

- [X] T016 Update `deploy/unraid/README.md` and the repository `README.md` to link the backup/restore, networking, and secrets guides.
- [ ] T017 Validate `Dockerfile` and `.dockerignore`, run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`, then execute the Compose, readiness, persistence, network-exposure, and backup/restore scenarios in `specs/002-unraid-deployment/quickstart.md`; resolve any failures in the relevant files.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 and T002 may run in parallel.
- **Foundational (Phase 2)**: Starts after Setup; T003 and T004 may run in parallel.
- **User Story 1 (Phase 3)**: Starts after Foundational. T005 and T006 can run in parallel; T007 follows T005; T008 can run in parallel with T005-T007 after T004; T009 follows T005-T008 and the image tasks; T010 follows T009.
- **User Story 2 (Phase 4)**: Starts after User Story 1 because backup/restore operates on the installed Compose services and their persistent mappings. T012 follows T011 because restore must consume the backup format; T013 follows both scripts.
- **User Story 3 (Phase 5)**: Starts after User Story 1. T014 and T015 are independent and can run in parallel.
- **Polish (Phase 6)**: Starts after all user stories; T016 integrates the operator guides, and T017 validates the complete deployment.

### User Story Dependencies

- **US1 (P1)**: Depends only on Setup and Foundational. It is the MVP and can be verified without backup/restore or optional reverse-proxy configuration.
- **US2 (P2)**: Depends on US1's Compose services, persistent paths, and install procedure.
- **US3 (P3)**: Depends on US1's public/internal URL and port configuration. Its networking and secrets documentation is otherwise independent of US2.
- **US2 and US3**: May be implemented in parallel after US1; their work uses separate guide and script files. The final README link integration waits for both.

### Parallel Opportunities

- T001 and T002 are independent setup changes.
- T003 and T004 operate on different files and can proceed in parallel.
- In US1, T005/T006 are separate routes; T008 is independent of the browser client refactor after the shared runtime reader is ready.
- In US2, the backup script can be developed before the restore script; the restore script must follow the backup archive contract.
- In US3, the networking and secrets guides are independent.
- US2 and US3 may proceed concurrently once US1 is complete.

## Parallel Example: User Story 1

```text
After T004:
Task: Implement the public runtime configuration and health routes in src/app/api/config/route.ts and src/app/api/health/
Task: Update server and admin Supabase clients in src/lib/auth/supabase-server.ts and src/lib/db/supabase-admin.ts

After T005:
Task: Refactor browser Supabase client and its sign-in, sign-up, and league dashboard consumers
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational phases.
2. Complete User Story 1, including runtime configuration, health/readiness, Compose configuration, and installation documentation.
3. Validate sign-in and readiness on the target Unraid host before proceeding.

### Incremental Delivery

1. Add User Story 2 backup, restore, persistence, and upgrade workflows after the base stack is usable.
2. Add User Story 3 network and credential guidance; verify the default exposure and secret-handling behavior.
3. Integrate all guides and run the complete quickstart validation before release.
