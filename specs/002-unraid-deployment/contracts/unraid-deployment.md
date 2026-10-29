# Unraid Deployment Contract

This contract describes the operator-facing interface for the app-plus-Supabase Compose project. It does not change the existing league, pick, scoring, or standings APIs.

## Supported installation shape

- One Unraid host and one Compose project managed with Compose Manager Plus or the documented Compose CLI fallback.
- One app container built from the repository's production image definition.
- One pinned release of the official Supabase self-hosted Docker configuration, with local app/Unraid overrides kept outside upstream-managed files.
- A private Compose network for app-to-Supabase service traffic.
- Persistent Unraid host mappings for PostgreSQL, Supabase file storage, and deployment configuration.
- Local-network access by default; an owner may configure an HTTPS reverse proxy for remote access.

Compose Manager Plus is a community plugin, not an official Unraid component. Its current installation and upgrade instructions are maintained at [mstrhakr/compose_plugin](https://github.com/mstrhakr/compose_plugin). Do not use the deprecated original Compose Manager plugin as the supported setup.

## Configuration contract

| Setting | Required | Visibility | Contract |
|---|---:|---|---|
| App host port | Yes | Unraid UI | Host port mapped to the app's container port; configurable to avoid conflicts. |
| Supabase API gateway host port | Yes | Unraid UI | Host port mapped to the gateway's port; reachable by participants on the LAN or through the owner-configured proxy. |
| Public app URL / Supabase Auth `SITE_URL` | Yes | Public URL | Exact app origin used for Auth redirects and `/auth/callback`; include an explicit scheme and configured hostname/port. |
| `SUPABASE_PUBLIC_URL` | Yes | Public URL | Participant-reachable Supabase API gateway URL, such as `http://unraid-host:8000` on a private LAN or the owner-configured HTTPS gateway URL. |
| `SUPABASE_INTERNAL_URL` | Yes | Private runtime value | API gateway endpoint resolved only within the Compose network, e.g. `http://api-gw:8000`; used only by app server Supabase clients. |
| Supabase public anon/publishable key | Yes | Public | May be delivered to browser clients by the runtime configuration endpoint; database RLS remains authoritative. |
| Supabase service-role key | Yes | Secret | Used only by server-side privileged operations; never returned by public configuration, embedded in client bundles, or logged. |
| PostgreSQL password and JWT signing secret/key material | Yes | Secret | Generated and protected for the pinned upstream Supabase release; must be included in protected recovery configuration. |
| Supabase dashboard credentials | Yes when Studio is enabled | Secret | Protect Studio access; Studio is not host-published by default. |
| Supabase data paths | Yes | Unraid paths | Host paths for PostgreSQL and file-backed Storage under persistent appdata/SSD-backed pool storage. |
| `POSTGRES_INTERNAL_PORT` | No | Private runtime value | Port PostgreSQL listens on inside the `db` container; defaults to `5432` and is used by migrations and backup/restore. It is not the host-published port. |
| Supabase release | Yes | Version | Pinned upstream `self-hosted/v*` release, reviewed before changing. |
| App image tag | Yes | Version | Immutable version tag or digest; never a floating production tag. |

Secrets must be provided through the protected Compose environment/configuration mechanism supported by the installed Unraid Compose manager. Never commit a populated `.env` file or paste secrets into issue reports. Public configuration must be limited to the public API URL and anon/publishable key.

## Network and exposure contract

- The app container and Supabase services communicate over a private Compose network.
- The app and Supabase API gateway may publish configurable host ports for local-network participant access.
- The database, Studio, Supavisor administrative access, Postgres Meta, and internal service ports remain unpublished by default.
- The app runtime configuration endpoint must not return database URLs, service-role keys, JWT signing material, dashboard credentials, or diagnostics containing secrets.
- A remote-access deployment terminates HTTPS at an owner-configured reverse proxy and exposes only the intended app and Supabase API gateway routes. Direct public exposure of Unraid management, Studio, or PostgreSQL is not supported.
- Supabase `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`, and allowed redirect URLs must agree with the selected app and gateway origins.

## Health contract

### Application

- `GET /api/health/live` returns HTTP `200` with `{"status":"ok"}` when the app process can accept requests. It does not depend on external services.
- `GET /api/health/ready` returns HTTP `200` with `{"status":"ready"}` only when required settings are valid, the app can reach the required Supabase API/auth service, and the required application schema is present. It returns HTTP `503` with `{"status":"not_ready"}` otherwise.
- Health responses contain no credentials, tokens, database URLs, exception text, or user data.
- Compose uses the readiness probe and healthy Supabase gateway dependency before considering the app ready.

### Supabase

- Retain health checks provided by the pinned upstream Supabase Compose release.
- The Compose dependency graph waits for database health before database-dependent Supabase services and waits for required Supabase health before the app.
- A service that starts but fails its health check is not considered ready. No fixed sleep duration substitutes for a health check.

## Persistence and backup contract

- PostgreSQL database files and Supabase Storage files are mapped to explicit persistent Unraid host paths.
- Removing/recreating containers or updating images must not remove persistent host data.
- A recoverable backup includes a PostgreSQL logical archive (including Supabase Auth and application tables), file-backed Storage, the matching pinned configuration/release identifiers, and protected secrets required to interpret/recover the data.
- Backups are stored outside the live PostgreSQL and Storage paths; confidential configuration and archives are protected at rest.
- Compose stack/config backup alone is not a database or Storage backup.
- Restore stops dependent services, restores PostgreSQL and Storage to matching state, restores the matching configuration/secrets, starts services in dependency order, applies only the documented pending application migrations, and verifies health plus representative authentication and contest records.
- A backup is reported as verified only after an isolated restore test succeeds.

## Update contract

1. Record the current app and Supabase release versions and create a verified pre-update backup.
2. Read Supabase release notes and required upgrade/migration steps.
3. Update the official Supabase configuration using its supported update process while retaining local overrides and environment values.
4. Pull the pinned images and apply any required Supabase upgrade steps.
5. Apply application migrations through the private database network.
6. Recreate/start the Compose stack and wait for health checks.
7. Verify sign-in, league access, schedule display, pick lockout behavior, and standings before declaring the update complete.
8. If an update fails, restore the matching pre-update Supabase database, Storage, configuration/secrets, and app image version; do not roll back database files by merely swapping an image.

## Runtime public configuration response

`GET /api/config` returns only values safe for all site visitors:

```json
{
  "supabaseUrl": "https://supabase.example.invalid",
  "supabaseAnonKey": "public-anon-or-publishable-key"
}
```

The app validates these values before initializing the browser Supabase client. Missing or invalid values yield a clear non-ready application state. The response must never include a service-role key or any other private credential.
