# Research: Unraid Deployment

## Decisions

### 1. Use the official self-hosted Supabase Docker Compose distribution

- **Decision**: Deploy a release-tagged version of the upstream Supabase self-hosted Docker configuration, with an application-specific Unraid Compose override kept separate from upstream files.
- **Rationale**: Supabase documents Docker Compose as its recommended self-hosting path and maintains a coordinated service stack including its API gateway, Auth, Postgres, PostgREST, Realtime, Storage, Studio, and Supavisor. The official configuration provides health checks, generated secrets, update scripts, and release notes. The Unraid deployment should consume a pinned release rather than copy `master` or maintain a fork.
- **Alternatives considered**:
  - Install every Supabase component as an independent Unraid container template: rejected because the supported upstream stack has cross-service configuration, dependency ordering, and version coordination that are easier to preserve as one Compose project.
  - Use Supabase CLI local development containers: rejected because Supabase documents the local-development stack as not hardened for external production use.
  - Use a managed/external Supabase account: rejected because the feature explicitly requires Supabase to be hosted on Unraid.
- **References**: [Supabase Docker self-hosting](https://supabase.com/docs/guides/self-hosting/docker), [official Supabase Docker configuration](https://github.com/supabase/supabase/tree/master/docker), [self-hosting overview](https://supabase.com/docs/guides/self-hosting).

### 2. Manage the multi-service project through Compose Manager Plus

- **Decision**: Document Compose Manager Plus as the Unraid host-side Compose management prerequisite and run the app plus pinned Supabase stack as a Compose project with a separate app override.
- **Rationale**: Unraid's official container guidance centers on Docker templates, port mappings, environment values, and persistent host-path mappings. Supabase supplies a coordinated Compose stack. The original Unraid Compose Manager plugin is explicitly deprecated; its current continuation, Compose Manager Plus, installs the Compose CLI and offers stack lifecycle controls in the Unraid interface.
- **Alternatives considered**:
  - The deprecated Compose Manager plugin: rejected because its maintainer says it is no longer updated or supported.
  - Manually launching the services as unrelated Unraid templates: rejected for dependency and configuration drift.
  - Require only shell-based Compose: rejected as the primary user workflow because the deployment is intended to be manageable from Unraid's interface.
- **References**: [Unraid container management](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/), [Compose Manager Plus project](https://github.com/mstrhakr/compose_plugin), [Compose Manager Plus announcement](https://forums.unraid.net/topic/197334-plugin-compose-manager-plus/), [deprecated Compose Manager notice](https://forums.unraid.net/topic/114415-plugin-docker-compose-manager/).
- **Operational caveat**: Compose Manager Plus is a third-party community plugin, not an official Unraid component. Its installation/update is a prerequisite maintained separately from this repository. Deployment documentation must provide a CLI fallback for stack validation and recovery.

### 3. Pin service releases and preserve upstream update separation

- **Decision**: Use a named Supabase `self-hosted/v*` release and explicit app image tag; keep app Compose overrides and environment files outside upstream Supabase-managed files. Require backups and upstream change review before updates.
- **Rationale**: Supabase's update workflow tracks a base release, merges upstream configuration, preserves local environment values, and flags conflicts/breaking changes. It explicitly requires separate Postgres and Storage backups; configuration backup alone is not data backup.
- **Alternatives considered**:
  - Automatically deploy latest Supabase images: rejected because multi-service upgrades and PostgreSQL major changes can require operator steps and recovery planning.
  - Modify upstream `docker-compose.yml` directly: rejected because those edits can conflict with upstream update merges.
- **References**: [Supabase self-hosted update guide](https://supabase.com/docs/guides/self-hosting/updating), [Supabase Docker deployment files](https://github.com/supabase/supabase/tree/master/docker).

### 4. Separate the browser-facing Supabase URL from the Compose-network URL

- **Decision**: Keep `SUPABASE_PUBLIC_URL` as a non-secret runtime value served with the public anon/publishable key to browser clients, and use a server-only `SUPABASE_INTERNAL_URL` for server-side Supabase clients. Provide an application runtime configuration endpoint instead of relying on `NEXT_PUBLIC_*` values for the deployment URL.
- **Rationale**: The browser must reach the Supabase API gateway using the Unraid LAN hostname or owner-configured proxy URL, while the app container should communicate over the private Compose network. Next.js documents that `NEXT_PUBLIC_*` values are inlined at build time; a container deployed with different hostnames cannot reliably change these browser values by setting runtime environment variables alone. A narrowly scoped runtime config endpoint permits one image to be configured per Unraid host without exposing server credentials.
- **Alternatives considered**:
  - Bake each owner's public Supabase URL into a custom app image: rejected because changing hostname/port would require rebuilding and republishing the image.
  - Use one URL from browser and app server for both contexts: rejected because it couples internal server traffic to LAN DNS/reverse-proxy routing and may fail from inside the container.
  - Expose the service-role key to the browser: rejected because it bypasses intended data access controls.
- **References**: [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables), [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting).

### 5. Expose only participant-facing endpoints by default

- **Decision**: Publish the app port and Supabase API gateway port to the configured LAN interfaces; leave PostgreSQL, Studio, and internal service ports un-published by default. Allow an owner-managed HTTPS reverse proxy as an optional front door.
- **Rationale**: Supabase's gateway fronts the Auth, REST, Storage, and other client APIs. Participants need this public API route; they do not need direct database or Studio access. Unraid's default bridge mode exposes only mapped ports, and Next.js recommends a reverse proxy for internet-facing self-hosted services.
- **Alternatives considered**:
  - Publish all Supabase ports to the LAN: rejected because internal and administrative services would be unnecessarily accessible.
  - Expose the app directly to the public internet: rejected as a default because TLS, rate-limiting, and access controls belong at an owner-configured reverse proxy/firewall.
- **References**: [Unraid container networking and port mapping](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/), [Next.js reverse proxy guidance](https://nextjs.org/docs/app/guides/self-hosting).

### 6. Gate application readiness on healthy Supabase connectivity

- **Decision**: Retain health checks from the upstream Supabase Compose release, add application liveness/readiness routes, and use Compose health-based dependency ordering for app startup.
- **Rationale**: Docker Compose starts dependencies before dependents but does not wait for service readiness unless dependencies are healthy. A running Postgres or gateway process may not yet be able to serve requests.
- **Alternatives considered**:
  - Use container process-running state only: rejected because it can advertise readiness while dependencies are still initializing.
  - Add arbitrary startup sleep: rejected because it is not reliable under variable disk initialization and recovery times.
- **References**: [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/), [Supabase self-hosted Docker Compose configuration](https://github.com/supabase/supabase/tree/master/docker).

### 7. Persist all state and make backup/restore an operator-tested workflow

- **Decision**: Bind-mount Supabase PostgreSQL data and file-backed Storage data into explicit Unraid appdata/pool paths. Back up PostgreSQL logically, Storage files, and the matching environment/configuration with secrets protected. Test restoration to a clean stack.
- **Rationale**: Container filesystems are disposable. Unraid recommends host-path mappings for application data. Supabase self-hosting places database maintenance, backups, and disaster recovery on the operator and its update guide says its config updater does not back up Postgres or Storage data.
- **Alternatives considered**:
  - Rely on container writable layers: rejected because container recreation or upgrade can discard data.
  - Copy only `.env` and Compose files: rejected because this omits the database and uploaded files.
  - Rely only on Compose Manager stack backup: rejected because stack/config backup is not a consistent logical database and Storage backup.
- **References**: [Unraid persistent volume guidance](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/), [Supabase self-hosting responsibilities](https://supabase.com/docs/guides/self-hosting), [Supabase update backup warning](https://supabase.com/docs/guides/self-hosting/updating).

### 8. Size and limit the initial deployment to a single Unraid host

- **Decision**: Target one x86-64 Unraid host for a household/small private league; document upstream baseline hardware requirements and leave high availability and optional analytics outside initial scope.
- **Rationale**: Supabase lists 4 GB RAM, 2 CPU cores, and 40 GB SSD as minimum self-hosting resources, and recommends 8 GB or more RAM, 4 cores or more, and 80 GB or more SSD. Analytics adds further resource requirements and is not required by this application.
- **Alternatives considered**:
  - Specify a multi-host/HA cluster: rejected because it exceeds the single-server product scope and adds services not needed for the intended private competition.
- **References**: [Supabase self-hosted Docker system requirements](https://supabase.com/docs/guides/self-hosting/docker).

## Resolved Technical Questions

- **Unraid deployment workflow**: Compose Manager Plus is the current community plugin option; do not document the older Compose Manager plugin as supported.
- **Supabase source and updates**: official Supabase self-hosted Docker release, pinned; upstream updater and release notes with pre-update backup.
- **Browser and server endpoint configuration**: runtime public endpoint and public key for browser; separate internal endpoint and service-role key for server.
- **Data persistence and backups**: explicit Unraid host mappings plus separate database, Storage, and protected config/secret backups; a restore test is required.
- **Readiness behavior**: health checks rather than fixed sleeps; app readiness depends on configuration and Supabase connectivity.
- **Unraid system baseline**: follow the upstream Supabase minimum and recommended resource figures; no unsupported scale claims are introduced.
