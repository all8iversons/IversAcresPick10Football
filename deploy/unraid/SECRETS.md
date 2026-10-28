# Secret handling

Supabase self-hosted credentials grant powerful access to authentication,
database, and application data. Protect them as operator credentials.

## Initial secret setup

- Keep the official Supabase `docker/.env` and populated `deployment/.env.unraid`
  outside the source checkout. Do not commit them, attach them to issues, or
  paste their contents into tickets or ordinary logs.
- Generate Supabase keys using the helper included in the exact pinned
  upstream release. Replace every documented default password and signing
  secret before starting the stack.
- Restrict access to the environment files and backup directory. On a
  shell-managed installation, use file and directory permissions such as
  `chmod 600 docker/.env deployment/.env.unraid` and `chmod 700` on their
  parent directories, while preserving the permissions required by Compose
  Manager Plus.
- Store the backup encryption passphrase separately from the encrypted
  archives. Do not set it in a command-line argument, script, or saved
  environment file.

## Browser and server boundaries

- The public anon/publishable key and `SUPABASE_PUBLIC_URL` may be returned by
  `/api/config`. Supabase row-level security remains the authorization
  boundary for browser clients.
- League invite codes are stored in the database so current members can copy
  them later. Treat them as shareable join credentials: anyone with a code can
  join that league, and authenticated league members can view the code.
- `SUPABASE_SERVICE_ROLE_KEY`, PostgreSQL passwords, JWT signing material,
  dashboard credentials, and other private credentials must remain in
  protected server/deployment configuration.
- The app container receives the service-role key only for server-side
  operations. Never add it to a `NEXT_PUBLIC_*` variable, the browser bundle,
  a health response, or a user-visible error.
- Inspect startup and application logs for secret values only in a controlled
  test environment. Report configuration failures without printing values.

## Recovery and rotation

The encrypted backup contains the version-matched deployment configuration
and secrets. Protect it at rest and test the passphrase and restore procedure
before relying on it. Do not store the encryption passphrase in the same
directory or backup medium.

If a credential is exposed, follow the
[Supabase self-hosting key and secret rotation guidance](https://supabase.com/docs/guides/self-hosting#securing-your-self-hosted-supabase)
for the pinned release. Coordinate key changes across the gateway, Auth,
Storage, and app environment; then recreate services, verify sign-in and
league access, and create a new protected backup. Rotating JWT signing
material can invalidate existing sessions, so plan participant reauthentication.
