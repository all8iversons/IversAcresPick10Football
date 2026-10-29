#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

read_setting() {
  local key=$1
  local file=$2
  local value
  value=$(awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$file")
  [[ -n "$value" ]] || fail "Missing $key in $file"
  printf '%s' "$value"
}

[[ $# -eq 1 ]] || fail "Usage: restore.sh /path/to/pick10-<timestamp>.tar.gz.gpg"
archive=$1
[[ -f "$archive" ]] || fail "Backup archive was not found: $archive"
[[ -n "${SUPABASE_DOCKER_DIR:-}" ]] || fail "Export SUPABASE_DOCKER_DIR before running this script."
[[ -n "${DEPLOYMENT_DIR:-}" ]] || fail "Export DEPLOYMENT_DIR before running this script."
[[ -f "$SUPABASE_DOCKER_DIR/.env" ]] || fail "Supabase docker/.env was not found."
[[ -f "$SUPABASE_DOCKER_DIR/docker-compose.yml" ]] || fail "The pinned Supabase Compose file was not found."
[[ -f "$DEPLOYMENT_DIR/.env.unraid" ]] || fail "deployment/.env.unraid was not found."

APP_SOURCE_PATH=$(read_setting APP_SOURCE_PATH "$DEPLOYMENT_DIR/.env.unraid")
SUPABASE_RELEASE=$(read_setting SUPABASE_RELEASE "$DEPLOYMENT_DIR/.env.unraid")
APP_IMAGE=$(read_setting APP_IMAGE "$DEPLOYMENT_DIR/.env.unraid")
SUPABASE_POSTGRES_DATA_PATH=$(read_setting SUPABASE_POSTGRES_DATA_PATH "$DEPLOYMENT_DIR/.env.unraid")
SUPABASE_STORAGE_PATH=$(read_setting SUPABASE_STORAGE_PATH "$DEPLOYMENT_DIR/.env.unraid")
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

for path in "$APP_SOURCE_PATH" "$SUPABASE_DOCKER_DIR" "$DEPLOYMENT_DIR" \
  "$SUPABASE_POSTGRES_DATA_PATH" "$SUPABASE_STORAGE_PATH"; do
  [[ "$path" == /* ]] || fail "All configured paths must be absolute."
done
[[ -f "$APP_SOURCE_PATH/deploy/unraid/compose.unraid.yaml" ]] ||
  fail "Unraid Compose override was not found in the app checkout."
[[ "$POSTGRES_INTERNAL_PORT" =~ ^[0-9]+$ ]] ||
  fail "POSTGRES_INTERNAL_PORT must be a numeric container port."
[[ -d "$APP_SOURCE_PATH" ]] || fail "Application checkout was not found."
[[ -d "$SUPABASE_POSTGRES_DATA_PATH" ]] || mkdir -p "$SUPABASE_POSTGRES_DATA_PATH"
[[ -d "$SUPABASE_STORAGE_PATH" ]] || mkdir -p "$SUPABASE_STORAGE_PATH"

for command in docker gpg tar awk find gzip; do
  command -v "$command" >/dev/null 2>&1 || fail "Required command is unavailable: $command"
done
[[ -r /dev/tty ]] || fail "Run restore from an interactive terminal."

compose() {
  docker compose \
    --project-directory "$SUPABASE_DOCKER_DIR" \
    --env-file "$SUPABASE_DOCKER_DIR/.env" \
    --env-file "$DEPLOYMENT_DIR/.env.unraid" \
    -f "$SUPABASE_DOCKER_DIR/docker-compose.yml" \
    -f "$APP_SOURCE_PATH/deploy/unraid/compose.unraid.yaml" "$@"
}

if [[ -n "$(compose ps --status running -q)" ]]; then
  fail "Stop the deployment before restoring; restore.sh will not stop or replace a running stack."
fi

for data_path in "$SUPABASE_POSTGRES_DATA_PATH" "$SUPABASE_STORAGE_PATH"; do
  if [[ -n "$(find "$data_path" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    fail "Restore requires empty PostgreSQL and Storage paths: $data_path"
  fi
done

read -r -s -p "Backup decryption passphrase: " passphrase </dev/tty
printf '\n' >/dev/tty
work=$(mktemp -d "${TMPDIR:-/tmp}/pick10-restore.XXXXXX")
chmod 700 "$work"
restore_needed=0

cleanup() {
  local status=$?
  trap - EXIT
  if ((restore_needed)); then
    if ! compose stop db; then
      printf 'ERROR: Could not stop PostgreSQL after restore.\n' >&2
      status=1
    fi
  fi
  unset passphrase
  rm -rf -- "$work"
  exit "$status"
}
trap cleanup EXIT

gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
  --output "$work/pick10-backup.tar.gz" --decrypt "$archive" 3<<<"$passphrase"
unset passphrase
tar -tzf "$work/pick10-backup.tar.gz" > "$work/archive-members.txt"
while IFS= read -r member; do
  case "$member" in
    /* | ../* | */../* | */.. | ..)
      fail "Backup archive contains an unsafe path."
      ;;
  esac
done < "$work/archive-members.txt"
tar -xzf "$work/pick10-backup.tar.gz" -C "$work"
[[ -f "$work/manifest.txt" && -f "$work/database.dump" &&
  -f "$work/db-config.tar.gz" && -f "$work/storage.tar.gz" &&
  -f "$work/configuration.tar.gz" && -f "$work/app-image.tar.gz" ]] ||
  fail "Backup archive is incomplete."
tar -tzf "$work/db-config.tar.gz" > "$work/db-config-members.txt"
while IFS= read -r member; do
  case "$member" in
    /* | ../* | */../* | */.. | ..)
      fail "PostgreSQL key-volume archive contains an unsafe path."
      ;;
  esac
done < "$work/db-config-members.txt"

backup_release=$(read_setting supabase_release "$work/manifest.txt")
backup_image=$(read_setting app_image "$work/manifest.txt")
backup_id=$(read_setting backup_id "$work/manifest.txt")
[[ "$backup_release" == "$SUPABASE_RELEASE" ]] ||
  fail "Backup Supabase release $backup_release does not match configured release $SUPABASE_RELEASE."
[[ "$backup_image" == "$APP_IMAGE" ]] ||
  fail "Backup app image $backup_image does not match configured image $APP_IMAGE."

restore_config="$DEPLOYMENT_DIR/restored-$backup_id"
[[ ! -e "$restore_config" ]] || fail "Restore configuration staging path already exists: $restore_config"
mkdir -m 700 -p "$restore_config"
tar -xzf "$work/configuration.tar.gz" -C "$restore_config"
[[ -f "$restore_config/supabase/.env" &&
  -f "$restore_config/deployment/.env.unraid" ]] ||
  fail "Backup configuration archive is incomplete."

printf 'Restored configuration and secrets were staged at:\n%s\n' "$restore_config"
printf 'Review that configuration and apply its non-secret public URL settings to %s/.env.unraid.\n' "$DEPLOYMENT_DIR"
printf 'Host path settings must continue to point to the empty data paths checked above.\n'
printf 'The matching Supabase secret file will replace the target docker/.env after confirmation.\n'
printf 'Apply the archived public URL settings to .env.unraid now, without changing its host paths.\n'
printf 'Type RESTORE to install the archived Supabase secrets and restore data: '
read -r confirmation </dev/tty
[[ "$confirmation" == RESTORE ]] || fail "Restore cancelled."
[[ "$(read_setting SUPABASE_POSTGRES_DATA_PATH "$DEPLOYMENT_DIR/.env.unraid")" == "$SUPABASE_POSTGRES_DATA_PATH" ]] ||
  fail "PostgreSQL host path changed during restore."
[[ "$(read_setting SUPABASE_STORAGE_PATH "$DEPLOYMENT_DIR/.env.unraid")" == "$SUPABASE_STORAGE_PATH" ]] ||
  fail "Storage host path changed during restore."
[[ "$(read_setting SUPABASE_RELEASE "$DEPLOYMENT_DIR/.env.unraid")" == "$SUPABASE_RELEASE" ]] ||
  fail "Supabase release changed during restore."
[[ "$(read_setting APP_IMAGE "$DEPLOYMENT_DIR/.env.unraid")" == "$APP_IMAGE" ]] ||
  fail "App image changed during restore."

cp "$restore_config/supabase/.env" "$SUPABASE_DOCKER_DIR/.env.restore"
chmod 600 "$SUPABASE_DOCKER_DIR/.env.restore"
mv -f -- "$SUPABASE_DOCKER_DIR/.env.restore" "$SUPABASE_DOCKER_DIR/.env"
tar -xzf "$work/app-image.tar.gz" -C "$work"
gzip -dc "$work/app-image.tar.gz" > "$work/app-image.tar"
docker image load -i "$work/app-image.tar"

compose run --rm --no-deps --user 0 -v "$work:/pick10-restore:ro" \
  --entrypoint sh db -c \
  'find /etc/postgresql-custom -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + &&
    tar -xzf /pick10-restore/db-config.tar.gz -C /etc/postgresql-custom'

restore_needed=1
compose up -d --wait db
compose exec -T db pg_restore --port="$POSTGRES_INTERNAL_PORT" \
  --username=postgres --dbname=postgres \
  --clean --if-exists --no-owner --exit-on-error < "$work/database.dump"
tar --numeric-owner -xzf "$work/storage.tar.gz" -C "$SUPABASE_STORAGE_PATH"
compose stop db
restore_needed=0

printf 'Database and Storage data restored. The stack remains stopped.\n'
printf 'Review staged configuration at %s, then start with docker compose up -d --wait.\n' "$restore_config"
