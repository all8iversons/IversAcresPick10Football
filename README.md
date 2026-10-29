# Ivers Acres Pick 10 Football

A private-league NFL competition website. Participants join leagues, choose
exactly 10 teams to win each regular-season week before kickoff lockout, and
follow weekly and season standings.

## Local development

### Prerequisites

- Node.js 20 or newer with npm
- Docker Desktop and the Supabase CLI

### Setup

```powershell
npm install
npx supabase start
```

Copy the local Supabase API URL, anon key, and service-role key from the CLI
output into `.env.local` using the variable names in `.env.example`. The
service-role key is server-only and must never be exposed to the browser or
committed to source control.

Apply local migrations and start the application:

```powershell
npx supabase db reset
npm run dev
```

Open `http://localhost:3000`. New participants can create an account, create a
private league, and copy its invite code anytime from the leagues list. The
current NFL schedule is fetched server-side and cached; automated tests use
static fixtures and do not call ESPN. League members can see submission
status without revealing picks before kickoff, then browse submitted picks from
previous weeks after the deadline.

## Unraid deployment

The app and self-hosted Supabase stack can be installed together on Unraid.
See the [Unraid installation guide](deploy/unraid/README.md) for the pinned
Compose setup, persistent storage, and health checks. Separate guides cover
[backup and restore](deploy/unraid/BACKUP-RESTORE.md),
[network exposure](deploy/unraid/NETWORKING.md), and
[secret handling](deploy/unraid/SECRETS.md).

## Validation

```powershell
npm run lint
npm run typecheck
npm test
npx supabase test db
npm run test:e2e
npm run build
```

Set `E2E_EMAIL` and `E2E_PASSWORD` to a local Supabase test account to run the
league pick-submission browser flow. The schedule adapter uses ESPN's public
scoreboard endpoint; its response format is not a documented stable contract.
See [the feature quickstart](specs/001-nfl-weekly-picks/quickstart.md) for
end-to-end scenarios and expected behavior.
