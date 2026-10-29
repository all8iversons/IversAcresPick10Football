# HTTP API Contract: NFL Weekly Picks

All routes are same-origin HTTPS application endpoints. Responses use JSON.
The authenticated participant is derived from the verified session; clients
must not supply a trusted participant ID. League-scoped routes authorize
membership before returning private data. The NFL provider is never called
directly by the browser.

## Common conventions

- Timestamps are ISO 8601 UTC strings.
- IDs are opaque UUIDs unless otherwise noted.
- Unknown fields in mutation requests are rejected.
- `401` means no authenticated session; `403` means authenticated but not
  authorized; `404` may be used for a non-member league to avoid disclosing its
  existence; `409` means an existing entry or deadline conflict; `422` means
  invalid data; `503` means schedule data is unavailable.
- Error responses have shape:

```json
{
  "error": {
    "code": "PICKS_LOCKED",
    "message": "Picks can no longer be changed for this week."
  }
}
```

## `GET /api/leagues`

Lists leagues in which the current participant is a member.

**Success `200`**

```json
{
  "leagues": [
    {
      "id": "uuid",
      "name": "Sunday League",
      "role": "owner"
    }
  ]
}
```

## `POST /api/leagues`

Creates a private league and makes the current participant its owner.

**Request**

```json
{ "name": "Sunday League" }
```

**Success `201`** returns the league and a one-time invite code. Only a hash of
the invite code is persisted; the code is only returned to its creator.

```json
{
  "league": { "id": "uuid", "name": "Sunday League", "role": "owner" },
  "inviteCode": "opaque-secret"
}
```

## `POST /api/leagues/join`

Joins a league using a private invite code.

**Request**

```json
{ "inviteCode": "opaque-secret" }
```

**Success `200`** returns the joined league. Invalid codes do not disclose
whether a league exists.

## `GET /api/leagues/{leagueId}/weeks/{season}/{weekNumber}`

Returns the requested regular-season week, normalized matchups, current
participant's entry if present, lock state, and schedule freshness. Requires
league membership.

**Success `200`**

```json
{
  "week": {
    "season": 2026,
    "seasonType": 2,
    "weekNumber": 1,
    "deadlineUtc": "2026-09-11T00:15:00Z",
    "isLocked": false,
    "scheduleFetchedAt": "2026-09-08T12:00:00Z",
    "scheduleStatus": "available"
  },
  "games": [
    {
      "id": "uuid",
      "kickoffUtc": "2026-09-11T00:15:00Z",
      "status": "scheduled",
      "homeTeam": { "id": "team-id", "name": "Home Team" },
      "awayTeam": { "id": "team-id-2", "name": "Away Team" }
    }
  ],
  "submissionStatuses": [
    {
      "participantId": "uuid",
      "participantName": "Member",
      "isCurrentUser": false,
      "hasSubmitted": true
    }
  ],
  "otherEntries": [],
  "myEntry": {
    "submittedAt": "2026-09-10T19:00:00Z",
    "picks": [{ "gameId": "uuid", "selectedTeamId": "team-id" }]
  }
}
```

`myEntry` is `null` when the participant has no entry. Games whose league
members' picks are not yet visible do not include other participants' picks.
The current participant's picks are visible to them at all times.
`submissionStatuses` includes every league member and only indicates whether an
entry exists; it never includes pick details. `otherEntries` is empty before
the deadline and contains submitted league entries after lockout. Requests for
earlier weeks use the same endpoint and visibility rules.

## `PUT /api/leagues/{leagueId}/weeks/{season}/{weekNumber}/picks`

Creates or replaces the participant's entire entry for this league and week.
Requires league membership. The server validates current schedule membership,
exact count, unique games, valid team membership in each game, and deadline.
The write atomically replaces all picks or changes nothing. At or after the
deadline, return `409 PICKS_LOCKED`.

**Request**

```json
{
  "picks": [
    { "gameId": "uuid", "selectedTeamId": "team-id" }
  ]
}
```

Exactly 10 items are required.

**Success `200`**

```json
{
  "entry": {
    "id": "uuid",
    "submittedAt": "2026-09-10T19:00:00Z",
    "picks": [{ "gameId": "uuid", "selectedTeamId": "team-id" }]
  }
}
```

Validation errors return `422 INVALID_PICKS` with field-safe details; a failed
write never leaves a partial entry.

## `GET /api/leagues/{leagueId}/standings?period=week&season=2026&weekNumber=1`

Returns standings visible to league members. `period` is `week` or `season`;
weekly requests require `season` and `weekNumber`. Before deadline, a member
cannot see another participant's picks or pick-level results. After deadline,
entry visibility is available to members; standings include only scored final
games and use standard competition ranking.

**Success `200`**

```json
{
  "period": "week",
  "standings": [
    { "participantId": "uuid", "displayName": "Member", "points": 8.5, "rank": 1 }
  ]
}
```

## Server-only schedule integration

The app's schedule route reads normalized cached records through
`NFLScheduleService`. No public endpoint accepts an arbitrary provider URL or
forwards raw browser requests to ESPN. Schedule refresh is an internal server
operation. The adapter requests explicit season, regular-season type, and week,
validates the response, and returns a clear unavailable/stale state on errors
instead of fabricated matchups.
