# Feature Specification: NFL Weekly Picks

**Feature Branch**: `001-nfl-weekly-picks`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Create a website where users compete by picking 10 NFL teams to win each week, using the current schedule and submitting picks before the Thursday game."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Join a Private League (Priority: P1)

A participant creates an account, creates a private league, or joins an existing
league using its invite code. They can see the NFL schedule and competition
information for leagues they belong to, without seeing another league's private
entries or standings.

**Why this priority**: Participants need a shared, private competition before
they can compete with one another.

**Independent Test**: Create two private leagues with different participants,
join each with valid accounts, and verify that members can access only their
own league's picks and standings.

**Acceptance Scenarios**:

1. **Given** a person without an account, **When** they create an account and
   sign in, **Then** they can access the league area as an authenticated
   participant.
2. **Given** an authenticated participant who is not in a league, **When** they
   create a league, **Then** they become a member and can invite others with a
   private invite code.
3. **Given** a valid invite code, **When** a participant joins its league,
   **Then** the league appears in their leagues and they can access its
   competition.
4. **Given** a participant who is not a member of a private league, **When**
   they try to view its picks or standings, **Then** access is denied and the
   private information is not disclosed.

---

### User Story 2 - Submit Weekly Picks (Priority: P1)

A league participant reviews the active regular-season week's matchups, selects
the teams they expect to win, and submits exactly 10 valid picks before the
weekly deadline. They can see how many teams they have selected and whether the
entry has been submitted.

**Why this priority**: Making a valid, timely entry is the central action in the
competition.

**Independent Test**: In a league with an upcoming week, select 10 teams from 10
different games and submit before the deadline. Verify the saved entry and
confirm invalid or late attempts are rejected.

**Acceptance Scenarios**:

1. **Given** an open week and a league participant, **When** they select teams,
   **Then** the schedule shows current NFL matchups, a selection count, and
   prevents choosing both teams from the same game.
2. **Given** exactly 10 distinct valid picks before the deadline, **When** the
   participant submits, **Then** one entry is saved for that participant,
   league, and week.
3. **Given** fewer or more than 10 picks, or conflicting picks from one game,
   **When** the participant submits, **Then** the entry is rejected with clear
   feedback and no invalid entry is saved.
4. **Given** a submitted entry and a deadline that has not passed, **When** the
   participant changes and resubmits their picks, **Then** the updated entry
   replaces their prior entry for that league and week.
5. **Given** the weekly deadline has arrived, **When** a participant tries to
   change or submit picks, **Then** pick controls are disabled and the attempt
   is rejected.
6. **Given** a week with a Thursday Night Football game, **When** its kickoff
   time is reached, **Then** the weekly deadline is reached.
7. **Given** a week with no Thursday game, **When** the earliest game of that
   week kicks off, **Then** the weekly deadline is reached.
8. **Given** a participant using keyboard navigation or assistive technology,
   **When** they review and make selections, **Then** the matchup, pick state,
   selection count, errors, deadline, and submission state are accessible and
   understandable.

---

### User Story 3 - Follow Results and Standings (Priority: P2)

A participant views completed game results, their weekly points, and the weekly
and season standings for each league they have joined.

**Why this priority**: Results and standings show participants how their picks
affect the competition and sustain engagement across the season.

**Independent Test**: Provide final results for wins, losses, and ties for
submitted picks, then verify weekly points and league standings, including tied
ranks and season totals.

**Acceptance Scenarios**:

1. **Given** a final game result, **When** a participant views their entry,
   **Then** a winning pick scores 1.0 point, a losing pick scores 0.0 points,
   and a pick of either team in a tied game scores 0.5 points.
2. **Given** participants have results for the active week, **When** a member
   views that league's weekly standings, **Then** participants are ordered by
   weekly points and equal scores share standard competition ranks (for example,
   1, 1, 3).
3. **Given** completed weeks in the regular season, **When** a member views that
   league's season standings, **Then** each participant's total is the sum of
   their points across completed weeks and ties share standard competition
   ranks.
4. **Given** a participant is not a member of a league, **When** they request
   that league's standings, **Then** its standings are not shown to them.

### Edge Cases

- A week has no Thursday game; the earliest scheduled kickoff is used as the
  deadline.
- The schedule contains multiple Thursday games; the Thursday Night Football
  kickoff is the deadline.
- A participant submits fewer or more than 10 teams, selects both teams from a
  matchup, or attempts to create a second entry for the same league and week.
- The schedule is changed, a game is postponed or cancelled, or a game status is
  unavailable; the current schedule and status are presented clearly, and
  incomplete or stale schedule data is not presented as current without notice.
- The schedule source is temporarily unavailable; participants receive a clear
  availability message rather than being shown invented or silently substituted
  matchups.
- A participant attempts to submit or modify picks at the exact deadline or
  after it.
- A finished NFL game ends in a tie, or a game has not yet reached a final
  result; the former scores half a point for either selected side, while the
  latter is not scored as final.
- A user attempts to access a private league, entry, or leaderboard without
  membership.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow participants to create accounts and sign in
  to access their competitions.
- **FR-002**: The system MUST allow a participant to create a private league,
  invite others with a private invite code, and join multiple leagues using
  valid invite codes.
- **FR-003**: The system MUST restrict league picks, weekly summaries, and
  standings to members of that league.
- **FR-004**: The system MUST display the active regular-season week's NFL
  matchups and game statuses from the current schedule source, and MUST clearly
  indicate when schedule information is unavailable or stale.
- **FR-005**: The system MUST allow each participant to submit exactly 10
  distinct team picks for each league and active regular-season week.
- **FR-006**: The system MUST prevent a participant from selecting both teams
  from the same game in one weekly entry.
- **FR-007**: The system MUST display the current pick count and validation
  feedback while the participant selects teams.
- **FR-008**: The system MUST allow participants to reuse a weekly pick set
  across joined leagues or customize the picks for each league, while saving
  each league's entry separately.
- **FR-009**: The system MUST allow no more than one entry per participant,
  league, and week, and MUST allow a valid entry to be changed before lockout.
- **FR-010**: The weekly deadline MUST be the Thursday Night Football game's
  kickoff time, or the earliest kickoff of the week when no Thursday game is
  scheduled.
- **FR-011**: The system MUST disable pick changes and reject entry creation or
  modification at or after the deadline, including attempts made directly
  against the authoritative service.
- **FR-012**: The system MUST represent game times and deadlines in UTC and
  display times in the participant's local time.
- **FR-013**: The system MUST award 1.0 point for a correct pick, 0.0 points for
  an incorrect pick, and 0.5 points when either selected team plays in a final
  tied game.
- **FR-014**: The system MUST provide league-specific weekly standings based on
  points earned in that week and season standings based on the sum of points
  across completed weeks.
- **FR-015**: The system MUST use standard competition ranking for equal scores,
  so equal ranks are followed by the next rank after the tied positions (for
  example, 1, 1, 3).
- **FR-016**: The system MUST not treat a game without a final result as
  completed for scoring.
- **FR-017**: The system MUST make matchup details, pick controls, selection
  count, validation feedback, deadline, and submission state operable by
  keyboard and understandable to assistive technologies.

### Key Entities

- **Participant**: An account that can belong to multiple private leagues,
  submit entries, and view league results.
- **League**: A private competition with members, an invite code, league-scoped
  entries, and standings.
- **NFL Week**: A regular-season period containing scheduled NFL games and a
  deadline derived from its kickoff schedule.
- **Game Matchup**: A scheduled game between two NFL teams, including kickoff
  time, status, and final result when available.
- **Weekly Entry**: One participant's league-specific selection of exactly 10
  distinct teams for a regular-season week, with submission state and scored
  results.
- **Team Pick**: The participant's selection of one team to win a particular
  matchup.
- **Leaderboard Standing**: A participant's weekly or season points and rank
  within a league.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of usability-test participants can find the active
  week's matchups and submit a valid 10-team entry within 3 minutes.
- **SC-002**: 100% of tested attempts to create or modify an entry at or after
  the deadline are rejected, and the participant is shown that picks are locked.
- **SC-003**: 100% of tested entries with fewer or more than 10 picks, duplicate
  teams, or both teams from one game are rejected before saving.
- **SC-004**: 100% of tested winning, losing, and tied-game picks receive
  1.0, 0.0, and 0.5 points respectively.
- **SC-005**: 100% of tested weekly and season standings reflect league-scoped
  totals and standard competition ranks for ties.
- **SC-006**: At least 90% of usability-test participants rate the clarity of
  the pick count, deadline, and submission status 4 or 5 on a 5-point scale.

## Assumptions

- The competition covers the NFL regular season; postseason picks are outside
  this feature.
- Participants create accounts before joining a league. An existing account
  service may be reused if one exists.
- League invite codes grant membership to a private league and are intended to
  be shared with invited participants.
- Weekly entries are league-specific; participants can reuse the same set of
  selections across leagues or choose different selections per league.
- The deadline follows the project constitution: Thursday Night Football
  kickoff, falling back to the earliest kickoff in weeks without a Thursday
  game. The deadline is inclusive for lockout: submissions are closed at the
  kickoff instant.
- Game results are used for scoring only after they are final. A tied final
  result awards half a point for a pick of either team.
- Schedule and status information comes from the current external NFL schedule
  source; live data may be temporarily unavailable.
- Participants may access the website from desktop and mobile browsers.
