#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

read_setting() {
  local key=$1
  local value
  value=$(awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' \
    "$DEPLOYMENT_DIR/.env.unraid")
  [[ -n "$value" ]] || fail "Missing $key in $DEPLOYMENT_DIR/.env.unraid"
  printf '%s' "$value"
}

[[ -n "${SUPABASE_DOCKER_DIR:-}" ]] || fail "Export SUPABASE_DOCKER_DIR before running this script."
[[ -n "${DEPLOYMENT_DIR:-}" ]] || fail "Export DEPLOYMENT_DIR before running this script."
[[ -f "$SUPABASE_DOCKER_DIR/.env" ]] || fail "Supabase docker/.env was not found."
[[ -f "$SUPABASE_DOCKER_DIR/docker-compose.yml" ]] || fail "The pinned Supabase Compose file was not found."
[[ -f "$DEPLOYMENT_DIR/.env.unraid" ]] || fail "deployment/.env.unraid was not found."

APP_SOURCE_PATH=$(read_setting APP_SOURCE_PATH)
SUPABASE_RELEASE=$(read_setting SUPABASE_RELEASE)
APP_IMAGE=$(read_setting APP_IMAGE)
SUPABASE_POSTGRES_DATA_PATH=$(read_setting SUPABASE_POSTGRES_DATA_PATH)
SUPABASE_STORAGE_PATH=$(read_setting SUPABASE_STORAGE_PATH)
BACKUP_DIR=$(read_setting BACKUP_DIR)
POSTGRES_INTERNAL_PORT=$(
  awk -F= '
    $1 == "POSTGRES_INTERNAL_PORT" {
      sub(/\r$/, "", $2)
      print $2
      exit
    }
  ' "$DEPLOYMENT_DIR/.env.unraid"
)
POSTGRES_INTERNAL_PORT=${POSTGRES_INTERNAL_PORT:-5432}
APP_COMPOSE_FILE="$APP_SOURCE_PATH/deploy/unraid/compose.unraid.yaml"

for path in "$APP_SOURCE_PATH" "$SUPABASE_DOCKER_DIR" "$DEPLOYMENT_DIR" \
  "$SUPABASE_POSTGRES_DATA_PATH" "$SUPABASE_STORAGE_PATH" "$BACKUP_DIR"; do
  [[ "$path" == /* ]] || fail "All configured paths must be absolute."
done
[[ -f "$APP_COMPOSE_FILE" ]] || fail "Unraid Compose override was not found at $APP_COMPOSE_FILE."
[[ -d "$SUPABASE_POSTGRES_DATA_PATH" ]] || fail "PostgreSQL data path does not exist."
[[ -d "$SUPABASE_STORAGE_PATH" ]] || fail "Supabase Storage path does not exist."
[[ "$POSTGRES_INTERNAL_PORT" =~ ^[0-9]+$ ]] ||
  fail "POSTGRES_INTERNAL_PORT must be a numeric container port."

case "$BACKUP_DIR/" in
  "$SUPABASE_POSTGRES_DATA_PATH/"* | "$SUPABASE_STORAGE_PATH/"*)
    fail "BACKUP_DIR must be outside the live PostgreSQL and Storage paths."
    ;;
esac
case "$SUPABASE_POSTGRES_DATA_PATH/" in
  "$BACKUP_DIR/"*) fail "BACKUP_DIR must not contain the live PostgreSQL path." ;;
esac
case "$SUPABASE_STORAGE_PATH/" in
  "$BACKUP_DIR/"*) fail "BACKUP_DIR must not contain the live Storage path." ;;
esac

for command in docker gpg tar gzip awk; do
  command -v "$command" >/dev/null 2>&1 || fail "Required command is unavailable: $command"
done
[[ -r /dev/tty ]] || fail "Run this backup from an interactive terminal to enter the encryption passphrase."

compose() {
  docker compose \
    --project-directory "$SUPABASE_DOCKER_DIR" \
    --env-file "$SUPABASE_DOCKER_DIR/.env" \
    --env-file "$DEPLOYMENT_DIR/.env.unraid" \
    -f "$SUPABASE_DOCKER_DIR/docker-compose.yml" \
    -f "$APP_COMPOSE_FILE" "$@"
}

mapfile -t running_services < <(compose ps --status running --services)
for required in app db storage; do
  if [[ ! " ${running_services[*]} " =~ " $required " ]]; then
    fail "The app, database, and Storage services must be running before backup."
  fi
done
compose exec -T db pg_isready --port="$POSTGRES_INTERNAL_PORT" \
  --username=postgres --dbname=postgres >/dev/null ||
  fail "PostgreSQL is not accepting connections."
docker image inspect "$APP_IMAGE" >/dev/null 2>&1 ||
  fail "The configured app image is not present locally: $APP_IMAGE"
[[ "$SUPABASE_RELEASE" =~ ^[A-Za-z0-9._-]+$ ]] ||
  fail "SUPABASE_RELEASE contains unsupported characters."
[[ "$APP_IMAGE" =~ ^[A-Za-z0-9._:/-]+$ ]] ||
  fail "APP_IMAGE contains unsupported characters."

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
work=$(mktemp -d "$BACKUP_DIR/.pick10-backup.XXXXXX")
chmod 700 "$work"
restart_services=()
restart_needed=0

cleanup() {
  local status=$?
  trap - EXIT
  if ((restart_needed)); then
    if ! compose start "${restart_services[@]}" ||
      ! compose up -d --wait app; then
      printf 'ERROR: Backup data was created, but the service stack did not restart cleanly.\n' >&2
      status=1
    fi
  fi
  rm -rf -- "$work"
  exit "$status"
}
trap cleanup EXIT

for service in "${running_services[@]}"; do
  [[ "$service" == db ]] || restart_services+=("$service")
done
(( ${#restart_services[@]} > 0 )) || fail "No running Supabase services were found to quiesce."

restart_needed=1
compose stop "${restart_services[@]}"

backup_id=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$work/configuration/supabase" \
  "$work/configuration/deployment" "$work/configuration/application"

compose exec -T db pg_dump --port="$POSTGRES_INTERNAL_PORT" \
  --username=postgres --dbname=postgres --format=custom \
  > "$work/database.dump"
compose exec -T --user 0 db tar -czf - -C /etc/postgresql-custom . \
  > "$work/db-config.tar.gz"
tar --numeric-owner -czf "$work/storage.tar.gz" \
  -C "$SUPABASE_STORAGE_PATH" .

tar --exclude='volumes/db/data' --exclude='volumes/storage' \
  -czf "$work/configuration/supabase-files.tar.gz" \
  -C "$SUPABASE_DOCKER_DIR" .env docker-compose.yml volumes
tar -xzf "$work/configuration/supabase-files.tar.gz" \
  -C "$work/configuration/supabase"
rm -f -- "$work/configuration/supabase-files.tar.gz"
cp "$DEPLOYMENT_DIR/.env.unraid" "$work/configuration/deployment/.env.unraid"
cp "$APP_COMPOSE_FILE" "$work/configuration/deployment/compose.unraid.yaml"
cp "$APP_SOURCE_PATH/supabase/config.toml" \
  "$work/configuration/application/supabase-config.toml"
tar -czf "$work/configuration.tar.gz" -C "$work/configuration" .
docker image save "$APP_IMAGE" | gzip -c > "$work/app-image.tar.gz"
{
  printf 'backup_id=%s\n' "$backup_id"
  printf 'created_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'supabase_release=%s\n' "$SUPABASE_RELEASE"
  printf 'app_image=%s\n' "$APP_IMAGE"
} > "$work/manifest.txt"
tar -czf "$work/pick10-backup.tar.gz" -C "$work" \
  manifest.txt database.dump db-config.tar.gz storage.tar.gz \
  configuration.tar.gz app-image.tar.gz

read -r -s -p "Backup encryption passphrase (at least 16 characters): " passphrase </dev/tty
printf '\n' >/dev/tty
(( ${#passphrase} >= 16 )) || fail "Use an encryption passphrase of at least 16 characters."
read -r -s -p "Confirm backup encryption passphrase: " confirmation </dev/tty
printf '\n' >/dev/tty
[[ "$passphrase" == "$confirmation" ]] || fail "Passphrases do not match."
unset confirmation
backup_path="$BACKUP_DIR/pick10-$backup_id.tar.gz.gpg"
gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
  --symmetric --cipher-algo AES256 --output "$backup_path.tmp" \
  "$work/pick10-backup.tar.gz" 3<<<"$passphrase"
unset passphrase
mv -- "$backup_path.tmp" "$backup_path"

printf 'Created encrypted backup: %s\n' "$backup_path"
compose start "${restart_services[@]}"
compose up -d --wait app
restart_needed=0
