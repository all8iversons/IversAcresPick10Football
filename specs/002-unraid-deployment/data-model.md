# Data Model: Unraid Deployment

This feature does not introduce new contest-domain records. It defines the state and configuration required to operate the existing application and its Supabase dependencies on one Unraid server. Existing accounts, leagues, memberships, weeks, games, entries, picks, scores, and standings retain their current schema and authorization rules.

## Entities

### Deployment Instance

Represents one installed NFL picks application plus the Supabase services it uses.

| Field | Type | Rules |
|---|---|---|
| `deploymentId` | String | Stable operator-selected project/stack identifier; unique on the host. |
| `appVersion` | String | Immutable release tag or image digest; must not use a moving `latest` tag for a release deployment. |
| `supabaseRelease` | String | Required pinned upstream `self-hosted/v*` version. |
| `publicAppUrl` | URL | Participant-facing origin used by browser redirects and sign-in callbacks. |
| `publicSupabaseUrl` | URL | Participant-facing API gateway URL reachable from participant devices. |
| `internalSupabaseUrl` | URL | Private Compose-network endpoint used only by the app server. |
| `hostPortMappings` | Map | Configurable app and API-gateway host ports; no database or administration port is published by default. |
| `readinessState` | Enum | `starting`, `ready`, or `not_ready`; `ready` only after required configuration and Supabase connectivity are confirmed. |

### Service

Represents the app container or one required Supabase self-hosted service.

| Field | Type | Rules |
|---|---|---|
| `serviceName` | String | Unique name within the Compose project. |
| `serviceRole` | Enum | `application`, `api_gateway`, `authentication`, `database`, `rest_api`, `realtime`, `storage`, `studio`, `pooler`, or `supporting`. |
| `imageReference` | String | Release-pinned image tag or digest. |
| `healthState` | Enum | `starting`, `healthy`, `unhealthy`, or `stopped`; healthy state comes from the service health check, not merely a running process. |
| `dependsOn` | String[] | Services that must be healthy before this service may be considered ready. |
| `publishedPorts` | Integer[] | Empty for internal services; only app and API gateway ports are participant-facing by default. |

### Persistent Volume

Represents durable data mapped from an Unraid-managed path into a service.

| Field | Type | Rules |
|---|---|---|
| `volumePurpose` | Enum | `postgres_data`, `storage_files`, `supabase_configuration`, `edge_functions`, or `app_configuration`. |
| `hostPath` | Path | Explicit Unraid path under the configured appdata/pool share; must not be a path inside the container writable layer. |
| `containerPath` | Path | Service path defined by the pinned Supabase Compose release or app image. |
| `accessMode` | Enum | `read_only` or `read_write`; configuration and data use the least access required. |
| `storagePool` | String | Operator-selected SSD-backed Unraid pool/share for active PostgreSQL and application state. |

### Secret Set

Represents the version-matched private configuration needed to operate or recover the deployment.

| Field | Type | Rules |
|---|---|---|
| `secretSetId` | String | Versioned association with one Supabase release and app configuration. |
| `databaseCredential` | Secret | Required for database service access; never returned in health or public configuration responses. |
| `jwtSigningMaterial` | Secret | Required by the pinned Supabase release; never browser-visible. |
| `serviceRoleCredential` | Secret | Server-only; never returned to the browser or written to ordinary logs. |
| `dashboardCredential` | Secret | Required if Studio is enabled; Studio remains private by default. |
| `publicAnonCredential` | Public value | May be returned with the public gateway URL for browser Supabase clients; grants no more access than existing Supabase RLS allows. |

### Backup Snapshot

Represents a recoverable, version-matched set of data and configuration.

| Field | Type | Rules |
|---|---|---|
| `backupId` | String | Unique timestamped identifier. |
| `createdAtUtc` | ISO 8601 UTC | Backup creation time in UTC. |
| `appVersion` | String | App image version at backup time. |
| `supabaseRelease` | String | Supabase release at backup time. |
| `databaseArchive` | File | PostgreSQL logical backup containing Auth and application data. |
| `storageArchive` | File | Supabase file-backed Storage data captured consistently with database state. |
| `configurationArchive` | Encrypted file | Compose configuration, URLs, and secret set required for recovery; protected separately from public source. |
| `verificationState` | Enum | `created`, `restore_tested`, or `failed`; a backup is not considered verified until a restore test succeeds. |

### Schema Migration State

Represents application schema migrations applied to the self-hosted database.

| Field | Type | Rules |
|---|---|---|
| `migrationVersion` | String | Ordered version from the repository migration file. |
| `appliedAtUtc` | ISO 8601 UTC | Database-recorded application time. |
| `result` | Enum | `applied` or `failed`; a release is not considered deployed until all required migrations are applied successfully. |

## Relationships

- One `Deployment Instance` contains one application `Service` and the Supabase `Service` set required by the pinned upstream release.
- `Service.dependsOn` defines the startup/readiness graph; services using PostgreSQL depend on the database health check, and the application depends on the API gateway and required Supabase service readiness.
- The database and file-storage `Persistent Volume` records are owned by their respective Supabase services and survive container recreation.
- A `Secret Set` is associated with a specific Supabase release and `Deployment Instance`; it is not stored in the repository or backup logs.
- A `Backup Snapshot` references the versions, volumes, and matching `Secret Set` required to restore the `Deployment Instance`.
- `Schema Migration State` belongs to the self-hosted PostgreSQL database and describes the existing `supabase/migrations` set.

## State Transitions

### Service readiness

`stopped` → `starting` → `healthy`

`starting` → `unhealthy` when required configuration is invalid, an upstream dependency fails, or the service health check exceeds its retry policy.

The application reports `ready` only after configuration validation, required Supabase connectivity, and required application schema checks succeed. A dependency outage changes readiness to `not_ready`; it must not delete or overwrite persistent data.

### Backup verification

`created` → `restore_tested` only after a restore to an isolated clean target validates service startup, authentication, and representative contest records.

`created` or `restore_tested` → `failed` when archive validation, decryption, restoration, or post-restore checks fail.

## Validation Rules

- Supabase and app images must be release-pinned; no production service uses a floating `latest` image.
- Public configuration contains only the Supabase public URL and public anon/publishable key. It never contains service-role, signing, dashboard, or database secrets.
- The browser URL must be reachable from participant devices; the internal URL must resolve only on the private Compose network.
- Database and Storage paths must be explicit, persistent, and outside container writable layers. Active PostgreSQL storage must use the configured SSD-backed Unraid pool.
- PostgreSQL, Studio, and internal service ports are not host-published by default.
- Database and Storage backups must correspond to the same recovery point; configuration and secret material must match the Supabase release being restored.
- Time values stored in backup metadata and migration records use UTC ISO 8601. Existing NFL deadlines remain governed by the application's UTC rules.
- Applying application migrations is an explicit, authenticated operation against the internal database connection; migrations must not be silently skipped on first startup.
