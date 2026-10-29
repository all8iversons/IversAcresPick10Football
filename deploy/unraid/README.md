# Unraid installation

This deployment runs the NFL Pick 10 app and the official Supabase self-hosted
Docker stack on one Unraid server. It is intended for private LAN access. It
does not require a managed Supabase account.

## Requirements

- x86-64 Unraid with Docker enabled; Supabase lists 4 GB RAM, 2 CPU cores, and
  40 GB SSD as minimums, and recommends 8 GB RAM, 4 cores, and 80 GB SSD.
- Docker Compose v2.24.4 or newer. The override uses Compose's `!override`
  merge tag to remove upstream-published database and pooler ports.
- SSD-backed persistent storage for PostgreSQL and Supabase file Storage.
- Compose Manager Plus or the Docker Compose CLI. Compose Manager Plus is a
  third-party Unraid plugin; see its
  [installation guide](https://github.com/mstrhakr/compose_plugin).

## Pinned service versions

The deployment uses Supabase self-hosted release `v1.26.08`, whose official
Compose file pins `supabase/postgres:17.6.1.136` (PostgreSQL 17). The repository's
`supabase/config.toml` is aligned to PostgreSQL 17, and the migration set uses
standard PostgreSQL features supported by that major. The one-shot migration
service uses the pinned `supabase@2.122.0` npm CLI package on the same
version-pinned Node.js 22 image used by the app. The app image must also use a
fixed version tag; do not deploy a floating `latest` tag.

This is a new PostgreSQL 17 data directory. Do not mount an existing PostgreSQL
15 data directory into the PostgreSQL 17 image. Back up first and follow the
upstream release's documented major-version upgrade procedure for an existing
database.

## Install

Choose an SSD-backed Unraid appdata path. The example uses
`/mnt/user/appdata/ivers-acres-pick10`; use the same path values in the
deployment environment file.

```bash
mkdir -p /mnt/user/appdata/ivers-acres-pick10
git clone --branch unraid https://github.com/all8iversons/IversAcresPick10Football.git \
  /mnt/user/appdata/ivers-acres-pick10/source
git clone --branch v1.26.08 --depth 1 https://github.com/supabase/supabase.git \
  /mnt/user/appdata/ivers-acres-pick10/supabase
mkdir -p /mnt/user/appdata/ivers-acres-pick10/deployment
cp /mnt/user/appdata/ivers-acres-pick10/supabase/docker/.env.example \
  /mnt/user/appdata/ivers-acres-pick10/supabase/docker/.env
cp /mnt/user/appdata/ivers-acres-pick10/source/deploy/unraid/.env.unraid.example \
  /mnt/user/appdata/ivers-acres-pick10/deployment/.env.unraid
```

The app's compose override and scripts remain versioned in the source checkout;
the populated environment files and Supabase data stay outside Git. The paths
above yield
`SUPABASE_DOCKER_DIR=/mnt/user/appdata/ivers-acres-pick10/supabase/docker`.
For an existing installation with an additional nested `supabase` directory,
use the actual Compose directory (for example,
`/mnt/user/appdata/ivers-acres-pick10/supabase/supabase/docker`) consistently
in the protected environment file and every Compose command.

## Configure Supabase and the app

1. In `supabase/docker`, generate the keys and initial secrets using the
   pinned release's helper:

   ```bash
   cd /mnt/user/appdata/ivers-acres-pick10/supabase/docker
   sh ./utils/generate-keys.sh --update-env
   ```

   Keep the resulting `.env` private. Review the pinned release's self-hosting
   guide and change all default passwords and secrets before starting services.

2. Edit `deployment/.env.unraid`. Set `APP_SOURCE_PATH`,
   `SUPABASE_DOCKER_DIR`, `DEPLOYMENT_DIR`, the PostgreSQL/Storage data paths,
   and `BACKUP_DIR` to the actual Unraid paths. Set `APP_IMAGE` to an immutable
   tag. Set `SITE_URL` and `ADDITIONAL_REDIRECT_URLS` to the app's participant
   origin and callback. Set `SUPABASE_PUBLIC_URL` and `API_EXTERNAL_URL` to
   the gateway origin participants can reach. These values must not be
   `localhost` for participants connecting from another device.
3. Configure `APP_PORT` and `KONG_HTTP_PORT` to available LAN ports. Despite
   the legacy setting name, `KONG_HTTP_PORT` configures the Envoy gateway's
   published HTTP port. The app uses `http://api-gw:8000` on the private
   Compose network by default; keep that internal URL separate from the
   participant-facing gateway URL. Set `POSTGRES_INTERNAL_PORT` to the port
   PostgreSQL listens on inside the database container; this is independent
   of any PostgreSQL port published to the Unraid host. For a LAN setup using
   app port 3010 and gateway port 8001, set `APP_PORT=3010`,
   `KONG_HTTP_PORT=8001`, `SITE_URL=http://192.168.1.109:3010`,
   `ADDITIONAL_REDIRECT_URLS=http://192.168.1.109:3010/auth/callback`,
   `SUPABASE_PUBLIC_URL=http://192.168.1.109:8001`, and
   `API_EXTERNAL_URL=http://192.168.1.109:8001`. Replace the host with the
   address participants use.
4. Verify that `SUPABASE_RELEASE` matches the checked-out upstream tag and
   that both data paths point to the SSD-backed locations. The upstream
   Compose file mounts PostgreSQL at
   `$SUPABASE_DOCKER_DIR/volumes/db/data` and file Storage at
   `$SUPABASE_DOCKER_DIR/volumes/storage`; keep the configured data paths
   aligned with those exact directories. Do not publish populated `.env`
   files, keys, or passwords.
5. Keep `JWT_SECRET`, `ANON_KEY`, and `SERVICE_ROLE_KEY` together from the same
   generated Supabase environment. The Compose override passes the anon and
   service-role keys from that protected environment to the app; do not
   independently replace one key or copy different keys into the app settings.
6. If email confirmation is enabled, configure Auth to use a reachable SMTP
   server. For a private LAN-only deployment without SMTP, account creation
   can instead be configured for email autoconfirm in the protected Supabase
   `docker/.env`; this skips email verification and should not be used as a
   substitute for SMTP on an Internet-facing deployment. Recreate the Auth
   service after changing its environment.

## Validate and start

Run the following from the Supabase `docker` directory. The environment file
sequence loads upstream secret settings first and deployment overrides second:

```bash
cd /mnt/user/appdata/ivers-acres-pick10/supabase/docker
SUPABASE_DOCKER_DIR="$PWD"
APP_SOURCE_PATH=/mnt/user/appdata/ivers-acres-pick10/source
DEPLOYMENT_DIR=/mnt/user/appdata/ivers-acres-pick10/deployment
dc() {
  docker compose \
    --project-directory "$SUPABASE_DOCKER_DIR" \
    --env-file "$SUPABASE_DOCKER_DIR/.env" \
    --env-file "$DEPLOYMENT_DIR/.env.unraid" \
    -f "$SUPABASE_DOCKER_DIR/docker-compose.yml" \
    -f "$APP_SOURCE_PATH/deploy/unraid/compose.unraid.yaml" "$@"
}
dc config --quiet
```

`config --quiet` validates interpolation without printing rendered credentials.
Review the Compose file and confirm the only published application-facing
ports are the app and HTTP API gateway. PostgreSQL, Supavisor, Studio, and
internal service ports must not be published.

Apply the app migrations through the private Compose network before the app
readiness check is enabled:

```bash
dc up -d --wait db
dc --profile tools run --rm migrate
dc up -d --wait
dc ps
```

The `migrate` profile runs the pinned Supabase CLI against
`db:${POSTGRES_INTERNAL_PORT:-5432}` on the private Compose network. It uses
`supabase db push` and the repository's migration history, with TLS disabled
for this internal connection because the Supabase database container does not
accept TLS. Do not expose this database connection outside the trusted Docker
network. Do not start an app release with unapplied migrations. The profile
downloads the pinned CLI package and its Linux platform binary from npm when
invoked, so the Unraid host needs outbound access to the npm registry.
The persistent-invite-code migration creates new codes for existing leagues;
current memberships stay intact, but previously shared invite codes stop
working and should be shared again from the leagues page.
The app's readiness endpoint checks connectivity and the required `leagues`
schema before reporting ready.

The official Supabase Compose release may configure PostgreSQL to listen on a
non-default internal port. Verify the database health-check output before
setting `POSTGRES_INTERNAL_PORT`; do not infer it from a host mapping such as
`5432:5433`. The same setting is used by backup and restore scripts.

### Recovering an out-of-sync app migration history

If `supabase db push` tries to apply the baseline but fails because Pick 10
tables or policies already exist, stop. Do not repeatedly rerun the migration
or mark all migrations applied without verifying the schema: the CLI history
and live schema are out of sync. Inspect the migration ledger and Pick 10
objects first, and take a verified backup before repairing a deployment with
data that matters.

For a disposable test deployment where deleting Pick 10 data is acceptable,
stop the app, remove only the Pick 10 tables/functions, and then apply the
repository migrations through the `migrate` profile. Do not drop the database,
Supabase schemas, or `auth.users`. The app-owned objects are `profiles`,
`leagues`, `league_memberships`, `nfl_weeks`, `nfl_games`, `weekly_entries`,
and `team_picks`, with their app functions. After migrations, recreate profile
rows for existing Auth users before starting the app:

```bash
POSTGRES_INTERNAL_PORT=$(
  awk -F= '
    $1 == "POSTGRES_INTERNAL_PORT" {
      sub(/\r$/, "", $2)
      print $2
      exit
    }
  ' /mnt/user/appdata/ivers-acres-pick10/deployment/.env.unraid
)
POSTGRES_INTERNAL_PORT=${POSTGRES_INTERNAL_PORT:-5432}
docker stop pick10-supabase-app-1
docker exec -i pick10-supabase-db psql -v ON_ERROR_STOP=1 \
  -p "$POSTGRES_INTERNAL_PORT" -U postgres -d postgres <<'SQL'
BEGIN;
DROP TABLE IF EXISTS public.team_picks CASCADE;
DROP TABLE IF EXISTS public.weekly_entries CASCADE;
DROP TABLE IF EXISTS public.nfl_games CASCADE;
DROP TABLE IF EXISTS public.nfl_weeks CASCADE;
DROP TABLE IF EXISTS public.league_memberships CASCADE;
DROP TABLE IF EXISTS public.leagues CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.submit_weekly_entry(uuid, uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.join_league(text) CASCADE;
DROP FUNCTION IF EXISTS public.create_league(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_league(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.is_league_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_auth_user() CASCADE;
COMMIT;
SQL
```

Keep that port variable set in the same shell. Run the documented migration
command next and only continue if it completes. Then recreate profiles for
preserved Auth accounts:

```sql
docker exec pick10-supabase-db psql -v ON_ERROR_STOP=1 \
  -p "$POSTGRES_INTERNAL_PORT" -U postgres -d postgres -c "
    INSERT INTO public.profiles (id, email, display_name)
    SELECT id, COALESCE(email, id::text),
           COALESCE(raw_user_meta_data ->> 'display_name', '')
    FROM auth.users
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email, display_name = EXCLUDED.display_name;
  "
```

This reset deletes league, pick, schedule, and profile data. It preserves
Supabase Auth accounts; existing users can sign in again after profile rows
are recreated. Never use this recovery path for data that must be retained.

Open `http://<unraid-host>:<APP_PORT>` from another LAN device. Create a test
account, sign in, and verify league access. Check `/api/health/live`,
`/api/health/ready`, and `/api/config`; the config response contains only the
public API URL and anon/publishable key. Do not expose service-role keys,
database passwords, dashboard credentials, or JWT signing secrets.

## Rebuild the app after source changes

The production app runs from a built image and does not read TypeScript changes
from the host source directory at runtime. Pull the intended `unraid` branch,
then rebuild and recreate the app using the same Compose files and environment
files:

```bash
git -C "$APP_SOURCE_PATH" pull --ff-only origin unraid
cd "$SUPABASE_DOCKER_DIR"
docker compose \
  --project-directory "$SUPABASE_DOCKER_DIR" \
  --env-file "$SUPABASE_DOCKER_DIR/.env" \
  --env-file "$DEPLOYMENT_DIR/.env.unraid" \
  -f "$SUPABASE_DOCKER_DIR/docker-compose.yml" \
  -f "$APP_SOURCE_PATH/deploy/unraid/compose.unraid.yaml" \
  build app
docker compose \
  --project-directory "$SUPABASE_DOCKER_DIR" \
  --env-file "$SUPABASE_DOCKER_DIR/.env" \
  --env-file "$DEPLOYMENT_DIR/.env.unraid" \
  -f "$SUPABASE_DOCKER_DIR/docker-compose.yml" \
  -f "$APP_SOURCE_PATH/deploy/unraid/compose.unraid.yaml" \
  up -d --wait --force-recreate app
```

Apply the migration profile before recreating the app when the release includes
unapplied database migrations. Confirm the app container becomes healthy and
test sign-in and league access after recreation.

## Unraid service management

Install the stack in Compose Manager Plus using the upstream Compose file and
the app override above, or use the `dc` CLI function as a recovery and
validation fallback. Always preserve the separate override and protected
environment files when updating upstream Supabase files. For data lifecycle,
updates, backup, restore, networking, and secret handling, follow the guides
in this directory:

- [Backup and restore](./BACKUP-RESTORE.md)
- [Networking](./NETWORKING.md)
- [Secrets](./SECRETS.md)
- [Feature validation scenarios](../../specs/002-unraid-deployment/quickstart.md)

If a host port is occupied, choose a different `APP_PORT` or
`KONG_HTTP_PORT`, update the corresponding public URLs, and recreate the
services. If readiness fails, inspect sanitized health state and Compose
service health; do not add fixed startup delays or delete persistent data.
If sign-in succeeds but the app returns `401` for authenticated API requests,
verify browser and server clients use the same public Supabase URL and that
`JWT_SECRET`, `ANON_KEY`, and `SERVICE_ROLE_KEY` belong to the same generated
Supabase configuration. If account creation fails because Auth cannot resolve
`supabase-mail`, configure a reachable SMTP server or use email autoconfirm
only for a private LAN deployment without email verification.
