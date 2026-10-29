# Quickstart: Unraid Deployment

This guide is the end-to-end validation plan for the Unraid deployment feature. Run the application checks on a development workstation and the Compose, service lifecycle, and recovery checks on the target Unraid host. Exact paths, variable names, and scripts are defined by the [deployment contract](./contracts/unraid-deployment.md).

## Prerequisites

- Supported x86-64 Unraid server with Docker enabled and local administrator access.
- At least 4 GB RAM, 2 CPU cores, and 40 GB SSD-backed storage for the full Supabase stack; 8 GB+ RAM, 4 cores+, and 80 GB+ SSD-backed storage are recommended.
- Compose Manager Plus community plugin or Docker Compose CLI installed on Unraid.
- Persistent appdata/share paths configured on an SSD-backed pool for PostgreSQL, Supabase Storage, and deployment configuration.
- LAN DNS/IP and available host ports for the app and Supabase API gateway.
- A way to protect and store generated Supabase secrets and backups.
- Node.js 20+ and npm for repository-level validation; Docker Compose for image and stack validation.

Supabase self-hosting is operator-managed: the operator owns service upgrades, security settings, database maintenance, backups, and recovery. Supabase local-development containers are not a production substitute.

## 1. Validate the application source

From the repository root:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all lint/type checks, unit tests (including deadline, pick count, and scoring), and the production build pass.

## 2. Build and validate the app image

After the Unraid deployment package is implemented:

```powershell
docker build --tag ivers-acres-pick10:local .
docker image inspect ivers-acres-pick10:local
```

Expected: a Linux production image starts as a non-root app process, contains the Next.js production output, and does not contain `.env` files, repository secrets, node_modules from the host, or development-only services.

## 3. Provision the Unraid Compose project

1. Install/update Compose Manager Plus using its current upstream instructions.
2. Create the deployment directory and persistent data directories under the selected SSD-backed appdata/pool path.
3. Provision the official Supabase self-hosted Docker configuration at a pinned release. Keep the application-specific Unraid Compose override separate from files managed by the upstream update process.
4. Configure the app's LAN host port, Supabase gateway LAN host port, public app URL, public Supabase URL, private internal Supabase URL, and persistent host paths.
5. Generate the Supabase database/JWT/dashboard credentials using the upstream setup procedure. Store them in protected Unraid Compose configuration; do not copy them into the repository.
6. Set Supabase Auth site URL, external API URL, and callback redirect allow-list to the same public origins used by the app.
7. Confirm the Compose file and interpolation before starting services:

```powershell
docker compose config --quiet
```

Expected: validation succeeds with no missing-variable warnings, and rendered configuration is reviewed without copying secret values into logs or tickets.

## 4. Start and verify the service graph

Start the Compose project in Compose Manager Plus or with the supported Compose CLI:

```powershell
docker compose up -d --wait
docker compose ps
```

Expected:

- PostgreSQL becomes healthy before its dependent Supabase services.
- The API gateway and required Supabase services become healthy.
- The app reaches ready only after required settings, internal Supabase connectivity, and application migrations are valid.
- The app and API gateway are reachable from another LAN device using the configured URLs.
- PostgreSQL, Studio, and internal Supabase ports have no host port mapping by default.
- `/api/health/live` returns `200`; `/api/health/ready` returns `200` after all dependencies are healthy.
- `/api/config` returns only the public gateway URL and public anon/publishable key.
- No service-role key, JWT signing material, database password, or dashboard credential appears in browser responses or ordinary logs.

## 5. Verify an authenticated contest workflow

1. Open the app from a second LAN device and create a test account.
2. Sign in, create a private league, and join/open that league.
3. Load a week with an available NFL schedule and submit exactly 10 valid picks before the deadline.
4. Verify a 9-pick, 11-pick, duplicate-game, wrong-team, and at/after-deadline submission is rejected as specified by existing tests/contracts.
5. Verify a non-member cannot read the league and the existing scoring/standings behavior remains unchanged.

Expected: sign-in callback and browser API access work through the public URL; server-side operations use the internal Compose URL; Supabase RLS and server-side deadline checks remain authoritative.

Use the local Supabase test suite for database policies and transaction behavior where available:

```powershell
npx supabase test db
```

Run the credentialed Playwright flow with `E2E_EMAIL` and `E2E_PASSWORD` set to a local test participant. Do not use a production participant account in automated tests.

## 6. Verify persistence, restart, and upgrade

1. Create a test participant, league, membership, and weekly entry.
2. Restart all services and then restart the Unraid host.
3. Verify that sign-in and the saved contest records still work.
4. Install an app image update while retaining the existing Supabase release and persistent mappings.
5. Follow the documented Supabase update procedure for a pinned upstream release change, including required pre-upgrade backup and migration steps.

Expected: container recreation does not remove PostgreSQL, Auth, Storage, or contest records; app readiness returns only after dependencies are healthy.

## 7. Verify backup and restore

1. Create a PostgreSQL logical backup, PostgreSQL/pgsodium key-volume archive, and matching Storage file archive while services are in the documented consistent state.
2. Save the matching release identifiers and protected configuration/secrets.
3. Restore all artifacts to an isolated clean deployment using the documented restore procedure.
4. Verify account authentication, league membership, weekly entry, and any associated Storage records.

Expected: all test records return without manual reconstruction, and backup state becomes `restore_tested` only after verification passes. Do not treat Compose configuration backup as a substitute for PostgreSQL and Storage backups.

## 8. Verify outage and safe network behavior

- Stop the API gateway or database in a test deployment: readiness must become `503`/not ready without exposing secrets; restore the service and verify readiness recovers.
- Deny schedule-provider network access: the existing schedule-unavailable state is shown and stored contest data is preserved.
- From a LAN peer, verify only the configured app and gateway ports are reachable. Verify PostgreSQL, Studio, and internal service ports are not published.
- If an HTTPS reverse proxy is configured, verify Auth callback/redirect behavior through the chosen app and Supabase public origins; verify that no direct WAN port-forward is required.

## Troubleshooting checkpoints

- **App does not become ready**: inspect sanitized app health status and Compose service health; confirm `SUPABASE_INTERNAL_URL` resolves from the private Compose network and required secrets/configuration are set.
- **Browser auth or API requests fail**: confirm `SUPABASE_PUBLIC_URL` is reachable from participant devices and Supabase Auth `SITE_URL`, `API_EXTERNAL_URL`, and redirect allow-list match the configured public origins.
- **Containers restart but data is missing**: stop the stack; verify host mappings point to the existing PostgreSQL and Storage paths before starting further updates.
- **Migration CLI cannot connect**: check the PostgreSQL health-check output
  and set `POSTGRES_INTERNAL_PORT` to the port accepted inside the `db`
  container; do not infer it from the host port. The migration connection uses
  `sslmode=disable` only on the private Compose network because the self-hosted
  database does not accept TLS.
- **Baseline migration collides with existing policies/tables**: stop and
  inspect `supabase_migrations.schema_migrations` and the existing app schema.
  An empty migration ledger does not prove the schema is empty. Never rerun
  blindly or mark versions applied without validating every migration; for
  disposable test data, use the test-only app-schema reset documented in the
  Unraid deployment guide.
- **Supabase update is blocked or reports a breaking migration**: do not force the update; follow the upstream release steps and confirm a tested pre-update backup exists.
- **Container startup is slow**: wait for service health checks rather than adding arbitrary sleeps or repeatedly recreating the database container.
