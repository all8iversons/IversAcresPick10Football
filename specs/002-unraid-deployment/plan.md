# Implementation Plan: Unraid Deployment

**Branch**: `[unraid]` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-unraid-deployment/spec.md`

## Summary

Deploy the existing NFL picks application and the Supabase services it depends on as a Compose-managed stack on Unraid. Use Supabase's version-pinned official self-hosted Docker configuration as the upstream base and a separate local override for the application and Unraid-specific network, health, and persistent-storage configuration. Keep PostgreSQL and administrative interfaces private, persist database and object-storage data on Unraid-managed storage, and document verified backup, restore, update, and recovery procedures. Separate the browser-facing Supabase URL from the app-container internal URL so the same app image can be configured at runtime for an Unraid hostname without publishing private credentials.

## Technical Context

**Language/Version**: TypeScript, React, Next.js 16; Node.js 22 LTS runtime (project supports Node.js 20+)

**Primary Dependencies**: Existing Next.js App Router application; Docker Engine and Docker Compose; Supabase official self-hosted Docker Compose release; Unraid Compose Manager Plus community plugin for stack lifecycle management

**Storage**: Supabase PostgreSQL and file-backed Supabase Storage on persistent Unraid appdata paths; deployment configuration and generated secrets stored separately from source code; backups stored outside the live data directories

**Testing**: Existing ESLint, TypeScript, Vitest, and Playwright scripts; Docker Compose configuration validation; container startup/readiness and restart/upgrade/backup-restore smoke tests on a supported Unraid host

**Target Platform**: Supported x86-64 Unraid server with Docker enabled; local-network access by default; optional owner-managed HTTPS reverse proxy

**Project Type**: Existing web application plus an Unraid Docker Compose deployment package

**Performance Goals**: Meet Supabase self-hosted baseline resources for a small household/private-league installation; local sign-in and league navigation remain responsive after all required services report healthy

**Constraints**: Supabase's current self-hosted Docker stack requires at least 4 GB RAM, 2 CPU cores, and 40 GB SSD storage; 8 GB+ RAM, 4 cores+, and 80 GB+ SSD storage are recommended. Database and storage state must survive container replacement. The API gateway is the only Supabase service exposed to participant devices; PostgreSQL, Studio, and other administrative services remain private by default. Public browser configuration may contain only the public Supabase URL and anon/publishable key; service-role, JWT-signing, dashboard, and database credentials must remain server-side or in protected deployment configuration. Self-hosted Supabase backup, maintenance, hardening, and recovery are the operator's responsibility.

**Scale/Scope**: One Unraid host serving one app instance and a small set of private leagues; no high-availability, multi-host orchestration, external object-store migration, or full observability stack in this release

## Constitution Check

| Gate | Status | Notes |
|---|---|---|
| Server-mediated schedule and provider abstraction | PASS | Deployment preserves `NFLScheduleService`; the browser continues to call the app and configured Supabase endpoint rather than ESPN. |
| Exact-ten picks, UTC deadline, server rejection, and scoring | PASS | These business rules remain unchanged. Deployment smoke tests exercise an entry through the hosted app; existing domain tests remain required. |
| League-scoped authorization and private data | PASS | Existing Supabase RLS and authenticated authorization remain in force; administrative Supabase interfaces are not exposed by default. |
| Strict typed React and accessible pick UX | PASS | The existing application contract remains unchanged; deployment-specific runtime configuration must be typed and disclose only public values. |
| Required automated validation | PASS | Existing lockout, pick-count, scoring, and static ESPN fixture tests remain required alongside Compose, readiness, persistence, and recovery validation. |
| Secrets and UTC boundaries | PASS | Private credentials remain server-only; persisted game/deadline values remain UTC ISO 8601 and deployment does not derive deadlines from host-local time. |

No constitution violations are required.

## Architecture and Design Decisions

1. **Run one Compose project managed from Unraid.** Use Compose Manager Plus, the current continuation of the deprecated Compose Manager plugin, to install and operate the multi-container stack. Keep the official Supabase Compose source release-pinned and unmodified where practical; maintain app-specific changes in a separate Unraid override file.
2. **Use the official Supabase self-hosted Docker distribution.** Pin a supported `self-hosted/v*` release and its image versions, disable optional analytics/log-collection services unless the application needs them, and preserve the upstream update scripts and configuration. Do not copy a moving `master` configuration into production or auto-update database images without a backup and release review.
3. **Keep the app and Supabase on a private Compose network.** Expose the app and Supabase API gateway to the LAN using configurable host-port mappings. Do not publish the PostgreSQL port, Studio, metadata, realtime, or internal service ports to the LAN by default. A reverse proxy may expose the app and API gateway under owner-selected hostnames, with HTTPS and access controls configured by the owner.
4. **Separate browser and container Supabase URLs.** Add a typed runtime configuration response containing only `SUPABASE_PUBLIC_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or its current publishable-key equivalent). Client-side auth obtains these public values at runtime instead of relying on values baked into the Next.js browser bundle. Server-side SSR/admin clients use `SUPABASE_INTERNAL_URL` on the Compose network; the service-role key remains server-only. Keep Supabase's `SITE_URL`/redirect allow-list aligned with the app's public origin and the existing auth callback.
5. **Build a production Node image for the app.** Use a multi-stage Docker build and Next.js standalone output, target the Node.js runtime supported by the project, run as a non-root user, and publish versioned images. Keep the image stateless: all durable user and contest records live in Supabase; Supabase database and file-storage state use explicit persistent host mappings.
6. **Use health-based dependencies and readiness.** Retain upstream Supabase health checks, define an application health endpoint that reports readiness only when required runtime settings are valid, internal Supabase connectivity is usable, and required application migrations are applied. Configure Compose to start the app only after the gateway is healthy. Health responses must not include credentials, tokens, database URLs, or user data.
7. **Make backup and restore explicit.** Provide a versioned operator script or documented procedure that creates a PostgreSQL logical backup, a consistent Supabase file-storage backup, and a protected backup of the matching deployment configuration/secrets. Store backup output outside active data directories; protect secrets/backups at rest. Restore in a documented order into a stopped/clean deployment and verify users, leagues, memberships, and entries before routing traffic.
8. **Separate initial provisioning and upgrades.** Document initial Supabase secret generation and URL configuration without committing secrets. Apply this application's migrations to the self-hosted database through a private, authenticated database connection. Verify the pinned Supabase PostgreSQL major version against the application's local migration/test baseline and update the baseline when required. For upgrades, require a pre-upgrade backup, pin Supabase/app versions, review upstream migration notes, update upstream files without overwriting local override files, apply app migrations, then verify health and an authenticated contest workflow.

## Project Structure

### Documentation (this feature)

```text
specs/002-unraid-deployment/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── unraid-deployment.md
└── tasks.md
```

### Source Code (repository root)

```text
Dockerfile
.dockerignore
deploy/
└── unraid/
    ├── compose.unraid.yaml
    ├── .env.unraid.example
    ├── README.md
    └── scripts/
        ├── backup.sh
        └── restore.sh
src/
├── app/
│   └── api/
│       ├── config/
│       │   └── route.ts
│       └── health/
│           ├── live/
│           │   └── route.ts
│           └── ready/
│               └── route.ts
└── lib/
    ├── auth/
    │   ├── supabase-browser.ts
    │   └── supabase-server.ts
    └── db/
        └── supabase-admin.ts
supabase/
└── migrations/
```

**Structure Decision**: Keep the existing Next.js application and Supabase migrations in their current locations. Add a dedicated `deploy/unraid/` deployment package, production Docker image definition, public runtime-configuration and health endpoints, and operator documentation/scripts. The pinned upstream Supabase self-hosted distribution is provisioned in the Unraid Compose project directory rather than duplicated or forked into application source.

## Complexity Tracking

No constitution violations or additional application projects are introduced. The Compose Manager Plus plugin is the documented Unraid management prerequisite for operating the upstream multi-service Supabase stack and app override as one Compose project.

## References

- [Unraid deployment specification](./spec.md)
- [Supabase self-hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase self-hosting overview and operator responsibilities](https://supabase.com/docs/guides/self-hosting)
- [Supabase self-hosted Docker configuration](https://github.com/supabase/supabase/tree/master/docker)
- [Supabase self-hosted update guide](https://supabase.com/docs/guides/self-hosting/updating)
- [Unraid: Managing and customizing containers](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/)
- [Unraid Compose Manager Plus project](https://github.com/mstrhakr/compose_plugin)
- [Unraid Compose Manager Plus forum thread](https://forums.unraid.net/topic/197334-plugin-compose-manager-plus/)
- [Docker Compose startup order and health checks](https://docs.docker.com/compose/how-tos/startup-order/)
- [Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js environment variable behavior](https://nextjs.org/docs/app/guides/environment-variables)
