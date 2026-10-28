# Backup, restore, and update

Backups include the PostgreSQL database, Supabase's `db-config` volume (including
PostgreSQL/pgsodium key material), Supabase file Storage, the matching Supabase
and application configuration, release metadata, and the app image. The complete
archive is encrypted with GPG AES-256. Store it outside the live database/Storage
paths and protect the passphrase separately.

The procedures require Bash, Docker Compose, GNU-compatible `tar`/`gzip`,
`awk`, and GPG on the Unraid host. Back up before any app or Supabase update.

## Create a backup

Confirm that the deployment is healthy, and that `BACKUP_DIR` in
`.env.unraid` is outside both persistent data directories. From an interactive
Unraid shell:

```bash
export SUPABASE_DOCKER_DIR=/mnt/user/appdata/ivers-acres-pick10/supabase/docker
export DEPLOYMENT_DIR=/mnt/user/appdata/ivers-acres-pick10/deployment
export APP_SOURCE_PATH=/mnt/user/appdata/ivers-acres-pick10/source
bash /mnt/user/appdata/ivers-acres-pick10/source/deploy/unraid/scripts/backup.sh
```

The script requires running app, PostgreSQL, and Storage services. It pauses
all running services except PostgreSQL to prevent app and file writes while it
creates the database dump and Storage archive. It then packages the versioned
configuration and app image, encrypts the archive, and restarts the stack.
Enter and confirm an encryption passphrase of at least 16 characters. The
passphrase is not stored with the archive.

The script exits with an error if a required service, path, command, or backup
step fails. A backup is not considered verified until an isolated restore test
has succeeded.

## Restore to a clean deployment

Restore only to an isolated clean target. Stop all services and create empty
PostgreSQL and Storage directories at the paths configured in `.env.unraid`.
Do not point the restore at a live database or non-empty Storage directory.
Use the same pinned Supabase release and app image tag shown by the backup;
the script validates both before changing data.

```bash
export SUPABASE_DOCKER_DIR=/mnt/user/appdata/ivers-acres-pick10/supabase/docker
export DEPLOYMENT_DIR=/mnt/user/appdata/ivers-acres-pick10/deployment
export APP_SOURCE_PATH=/mnt/user/appdata/ivers-acres-pick10/source
bash /mnt/user/appdata/ivers-acres-pick10/source/deploy/unraid/scripts/restore.sh \
  /mnt/user/backups/ivers-acres-pick10/pick10-<timestamp>.tar.gz.gpg
```

The script decrypts and validates the archive, stages the configuration under
`deployment/restored-<backup-id>`, and requires the operator to type `RESTORE`.
At that prompt, review the staged `deployment/.env.unraid` in another shell or
editor and apply the participant-facing URL and redirect settings to the
active `.env.unraid`. Keep its host data paths pointed at the empty target
directories. After confirmation, the script installs the matching Supabase secret file,
loads the saved app image, replaces the target `db-config` volume with its
archived key material before starting PostgreSQL, restores PostgreSQL and
Storage, and leaves the stack stopped.

Review the staged release configuration, verify `SUPABASE_PUBLIC_URL`,
`API_EXTERNAL_URL`, `SITE_URL`, and `ADDITIONAL_REDIRECT_URLS`, then start the
stack:

```bash
docker compose \
  --project-directory "$SUPABASE_DOCKER_DIR" \
  --env-file "$SUPABASE_DOCKER_DIR/.env" \
  --env-file "$DEPLOYMENT_DIR/.env.unraid" \
  -f "$SUPABASE_DOCKER_DIR/docker-compose.yml" \
  -f "$APP_SOURCE_PATH/deploy/unraid/compose.unraid.yaml" up -d --wait
```

Run the app migration command only if the restored release's migration state
requires it. Verify sign-in, a representative league and weekly entry,
Storage access, and `/api/health/ready` before routing participants to the
restored instance. Mark the backup `restore_tested` only after those checks
pass.

## Update the app or Supabase

### App image

1. Create a verified pre-update backup.
2. Check out the intended application release in `APP_SOURCE_PATH` and assign
   a new immutable `APP_IMAGE` tag in `.env.unraid`.
3. Validate the Compose configuration with `docker compose config --quiet`.
4. Build and start the new image, apply pending migrations through the
   `migrate` profile, then wait for the app readiness check.
5. Verify sign-in, league access, schedule display, pick lockout, and
   standings. Retain the old image and backup until validation is complete.

### Supabase release

1. Create and verify a pre-update backup.
2. Read the official
   [self-hosted update guide](https://supabase.com/docs/guides/self-hosting/updating)
   and release notes. Check for required PostgreSQL major upgrades and
   migrations.
3. Fetch the exact upstream release under review. Keep the Unraid override,
   app source, and populated environment files outside the upstream checkout.
4. Update `SUPABASE_RELEASE` and validate the merged Compose configuration.
   Never mount an older PostgreSQL data directory into a newer major-version
   image. Follow Supabase's documented major-upgrade procedure where required.
5. Start services in dependency order, apply required application migrations,
   and verify the authenticated contest workflow before declaring the update
   complete.
6. If validation fails, stop the stack and restore the matching pre-update
   database, Storage, secrets/configuration, and app image to an isolated clean
   target. Do not recover a PostgreSQL major-version update by merely swapping
   an image tag.
