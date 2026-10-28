# Data Model: NFL Weekly Picks

This model describes persistent domain data and its invariants. All persisted
instants use UTC timestamps; display conversion is performed at the presentation
boundary.

## Participant

Represents an authenticated person participating in leagues.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier; sourced from the verified authentication identity. |
| `email` | String | Managed by the authentication provider; unique according to provider rules. |
| `createdAt` | UTC timestamp | Required. |

Relationships: a participant can have many league memberships and weekly
entries.

## League

Represents a private competition.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier. |
| `name` | String | Required; trimmed and non-empty. |
| `inviteCodeHash` | String | Required; unique; raw invite code is not persisted. |
| `createdBy` | Participant ID | Required; creator becomes owner/member. |
| `createdAt` | UTC timestamp | Required. |

Relationships: a league has many memberships, weekly entries, and standings
derived from its entries. A request to view league-scoped data requires a
membership.

## League Membership

Associates a participant with a private league.

| Field | Type | Rules |
|---|---|---|
| `leagueId` | League ID | Required; part of composite primary key. |
| `participantId` | Participant ID | Required; part of composite primary key. |
| `role` | Enum | `owner` or `member`; creator is `owner`. |
| `joinedAt` | UTC timestamp | Required. |

Uniqueness: one membership per `(leagueId, participantId)`.

## NFL Week

Represents one regular-season week and the deadline derived from its games.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier. |
| `season` | Integer | Required NFL season year. |
| `seasonType` | Enum/integer | Regular season only for this feature. |
| `weekNumber` | Integer | Required; regular-season week number. |
| `deadlineUtc` | UTC timestamp | Required; TNF kickoff or earliest weekly kickoff fallback. |
| `scheduleFetchedAt` | UTC timestamp | Required; used to communicate schedule freshness. |
| `scheduleStatus` | Enum | `available`, `stale`, or `unavailable`. |

Uniqueness: one week per `(season, seasonType, weekNumber)`.

## Game Matchup

Represents a provider-normalized NFL game.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Internal primary identifier. |
| `sourceEventId` | String | Required and unique within provider; not exposed as a pickable team identity. |
| `weekId` | NFL Week ID | Required. |
| `homeTeamId` | String | Required provider-normalized team identifier. |
| `homeTeamName` | String | Required display name. |
| `awayTeamId` | String | Required provider-normalized team identifier; different from home team. |
| `awayTeamName` | String | Required display name. |
| `kickoffUtc` | UTC timestamp | Required ISO 8601 instant. |
| `venueTimeZone` | IANA time-zone identifier | Required to classify local Thursday schedules; missing values must be resolved by server-side schedule mapping before deadline calculation. |
| `isThursdayNightGame` | Boolean | Derived by schedule adapter from reliable provider designation or documented Thursday-slate fallback. |
| `status` | Enum | `scheduled`, `in_progress`, `final`, `postponed`, `cancelled`, or `unknown`. |
| `homeScore` | Decimal/integer nullable | Present for live/final results when provider supplies a valid score. |
| `awayScore` | Decimal/integer nullable | Present for live/final results when provider supplies a valid score. |
| `finalResult` | Enum | `home_win`, `away_win`, `tie`, or `undetermined`; only set from a final game with valid scores. |
| `updatedAt` | UTC timestamp | Required. |

Relationships: belongs to one NFL week; is referenced by at most one pick in a
weekly entry. A final tie requires `status = final` and equal valid scores; two
false `winner` flags alone are insufficient evidence of a tie.

## Weekly Entry

Represents one participant's submitted picks for one league and week.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier. |
| `leagueId` | League ID | Required. |
| `participantId` | Participant ID | Required; must be a league member. |
| `weekId` | NFL Week ID | Required; active regular-season week. |
| `submittedAt` | UTC timestamp | Set on successful creation or replacement. |
| `updatedAt` | UTC timestamp | Updated on valid replacement. |

Uniqueness: one entry per `(leagueId, participantId, weekId)`.

State transitions:

1. No entry -> submitted: allowed only before the deadline and with exactly 10
   valid picks.
2. Submitted -> replaced: allowed only before the deadline and with exactly 10
   valid picks; replace all picks atomically.
3. At or after deadline: entry and picks are immutable.

The database transaction must compare the deadline against database current
time when saving. The server must derive participant identity from the verified
session rather than request input.

## Team Pick

Represents one selected team in an entry.

| Field | Type | Rules |
|---|---|---|
| `entryId` | Weekly Entry ID | Required. |
| `gameId` | Game Matchup ID | Required; part of composite uniqueness. |
| `selectedTeamId` | String | Must equal that game's home or away team. |
| `pointsAwarded` | Decimal nullable | Null until final; 1.0 for win, 0.0 for loss, 0.5 for final tie. |

Uniqueness: one pick per `(entryId, gameId)` and no duplicate selected team.
Exactly 10 picks are required for an accepted entry. Picks must reference games
from the entry's week, and a selected team must belong to its referenced game.

## Leaderboard Standing

Derived view of a participant's performance within one league; may be calculated
on read or materialized with a freshness policy.

| Field | Type | Rules |
|---|---|---|
| `leagueId` | League ID | Required; member-only visibility. |
| `participantId` | Participant ID | Required. |
| `period` | Enum | `week` or `season`. |
| `weekId` | NFL Week ID nullable | Required for weekly; null for season. |
| `points` | Decimal | Weekly sum or season sum across completed weeks. |
| `rank` | Integer | Standard competition rank; equal points share rank and next rank skips tied positions. |

Standings are league-specific. Before a week deadline, participants may see
their own picks; other members' picks remain hidden. After the deadline, entries
may be visible to league members.
