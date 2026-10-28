# Feature Specification: Unraid Deployment

**Feature Branch**: `[unraid]`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "this spec will be to have the project work in unraid, and will be put into the unraid branch. Supabase is being hosted on Unraid."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install the app and Supabase on Unraid (Priority: P1)

As an Unraid server owner, I want to install and configure both the NFL picks app and its Supabase services on my server so household and league members can use the complete application without relying on an external Supabase account.

**Why this priority**: The app depends on Supabase for authentication and contest data, so a usable Unraid deployment must provide both services.

**Independent Test**: Starting from an Unraid server, install the app and its Supabase services, open the configured address from another device on the local network, create an account, and sign in.

**Acceptance Scenarios**:

1. **Given** an Unraid server with a supported release, **When** the owner follows the installation guide, **Then** the app and required Supabase services start and the app is reachable at its configured local address.
2. **Given** the app and Supabase are running, **When** a participant creates an account, signs in, and opens a league, **Then** authentication and the existing NFL picks workflows work without changes to contest rules.
3. **Given** required settings are absent or invalid, **When** the owner starts the services, **Then** the failure is clearly reported and the app does not present itself as ready for use.

### User Story 2 - Keep the service and contest data available (Priority: P2)

As an Unraid server owner, I want the app and Supabase data services to recover cleanly after a server restart or app update so league members can continue using their existing accounts and entries.

**Why this priority**: A deployment is only useful for a season-long competition if routine maintenance does not disrupt access or lose contest data.

**Independent Test**: Create a league and an entry, restart the app and Supabase services, then update and recreate the app containers using the same persistent data locations; verify that the account, league, and entry remain available.

**Acceptance Scenarios**:

1. **Given** the app has existing accounts, leagues, and picks, **When** the app, Supabase services, or Unraid host restarts, **Then** those records remain available after the services become ready again.
2. **Given** a newer app or Supabase service version is installed using the documented update procedure, **When** the updated services start, **Then** members can sign in and access their existing leagues and entries.
3. **Given** Supabase or another required service is temporarily unavailable, **When** a user opens the app, **Then** the user receives a clear unavailable or retry state and existing contest data is not silently replaced or discarded.

### User Story 3 - Configure access safely (Priority: P3)

As an Unraid server owner, I want to configure app and Supabase network access, persistent storage, and private credentials safely so league members can reach the app without exposing secrets or unintentionally opening services to the public internet.

**Why this priority**: Correct configuration protects league data and avoids accidental exposure while allowing the owner to choose how users connect.

**Independent Test**: Configure the app and Supabase for local-network access, verify that required services are reachable only as intended, and check that private credentials are not displayed in the app or ordinary startup logs.

**Acceptance Scenarios**:

1. **Given** configured app and Supabase network settings, **When** the owner starts the services, **Then** the app can reach Supabase and participants can reach the app on the selected local address and port.
2. **Given** an owner chooses to use a reverse proxy, **When** the owner follows the documented proxy prerequisites, **Then** the app remains usable through the chosen hostname without requiring direct public port exposure of the app or Supabase administration services.
3. **Given** the services are running, **When** a user without an authorized session views the app or its error messages, **Then** private service credentials are not disclosed.

### Edge Cases

- The selected host port is already in use; the owner can identify the conflict and select another port.
- Required Supabase settings are missing or malformed, a Supabase service is unreachable, or a service dependency starts late; the owner can identify the failing service without exposing credentials.
- The app container is recreated or updated while Supabase is unavailable; contest data remains intact and the app recovers when connectivity returns.
- A Supabase service container is recreated, updated, or restarted; its persistent data remains intact and dependent services recover in the documented order.
- The Unraid host runs out of storage or a database backup cannot be restored; the owner receives actionable operational guidance and the deployment does not claim data is backed up when it is not.
- ESPN is unreachable; users receive the app's existing schedule-unavailable behavior rather than fabricated matchups.
- The owner changes the app's host port or hostname; existing accounts, leagues, and picks remain associated with the configured Supabase service.
- The app is reached through a reverse proxy; the owner must configure HTTPS and access controls at that proxy, and the app must not imply that direct internet exposure is safe.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app and all Supabase services required for authentication and contest data MUST be installable and manageable on a supported Unraid server using its standard app/container management workflow, without requiring the owner to run a development environment or use an external Supabase account.
- **FR-002**: The owner MUST be able to configure the app and Supabase network endpoints, exposed ports, required public and private credentials, and persistent storage locations using Unraid's supported configuration controls.
- **FR-003**: Each service MUST clearly identify missing or invalid required configuration and MUST NOT report readiness until its dependencies and required configuration are usable.
- **FR-004**: Private service credentials MUST remain out of browser-delivered content, user-facing error details, and ordinary application logs.
- **FR-005**: The deployment MUST store Supabase-managed account and contest data in persistent locations that survive service restarts, container recreation, and documented upgrades.
- **FR-006**: The app and required Supabase services MUST expose health and readiness states to Unraid's service-management workflow so the owner can distinguish working services from failed startup.
- **FR-007**: The owner MUST receive installation, initial setup, update, backup, restore, and recovery guidance covering app and Supabase services.
- **FR-008**: The guide MUST explain reverse-proxy and HTTPS prerequisites and MUST NOT require or encourage direct public exposure of the app or Supabase administration services as the default configuration.
- **FR-009**: If a Supabase service or the NFL schedule provider is unavailable, the app MUST show a clear unavailable state, preserve stored contest data, and resume normal operation when the dependency is available again.
- **FR-010**: The Unraid deployment MUST preserve the existing sign-in, league isolation, pick-count, UTC deadline, scoring, and standings behavior.
- **FR-011**: The deployment MUST provide a documented way to back up and restore Supabase-managed authentication and contest data, and MUST identify which persistent data locations and credentials are required for recovery.
- **FR-012**: The deployment MUST define the startup and shutdown dependencies among the app and Supabase services so that the app does not report ready before its required Supabase services are ready.

### Key Entities

- **Deployment Configuration**: The network addresses, ports, credentials, and persistent data locations for the app and Supabase services.
- **App Service**: The deployed NFL picks application, including its running, failed, and ready states and deployed version.
- **Supabase Services**: The self-hosted services that provide authentication, database, and other application-required Supabase functions, including their health and dependency states.
- **Persistent Supabase Data**: Authentication and contest records that must remain available across service lifecycle operations and be recoverable from backups.
- **Contest Data**: Accounts, leagues, memberships, weekly entries, picks, and standings stored in Supabase and shared across app versions.
- **Access Route**: The local-network address or owner-configured reverse-proxy hostname used by participants to reach the app.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An Unraid owner can deploy the app and its required Supabase services and open the sign-in page from a second local-network device within 45 minutes by following the published guide.
- **SC-002**: In a deployment verification, an account, league, membership, and submitted entry remain available after three complete app-and-Supabase service restarts and one documented app-version update.
- **SC-003**: In configuration tests, every missing or invalid required setting results in a visible non-ready state with a corrective message, and no private service credential appears in browser content or ordinary logs.
- **SC-004**: In a recovery test, after a Supabase service or schedule-provider outage is resolved, participants can resume sign-in or schedule loading without manually recreating accounts, leagues, or picks.
- **SC-005**: A participant can complete sign-in, open a league, and submit a valid weekly entry through the Unraid-hosted app while all existing contest validation and deadline rules remain in force.
- **SC-006**: A backup-and-restore verification restores authentication and contest records to a clean deployment, with no missing accounts, leagues, memberships, or submitted picks.
- **SC-007**: In the default deployment, the app and Supabase services communicate on the configured private network, and Supabase administration endpoints are not exposed to the public internet.

## Assumptions

- The Unraid server runs a supported x86-64 Unraid release with its standard container management capability available.
- The app and the Supabase services it requires are hosted on the same Unraid server and may communicate over a private container network.
- The feature includes the Supabase self-hosted service configuration required by this app; optional Supabase products not needed for authentication or contest data are outside scope.
- The owner supplies the initial private configuration and manages credentials as secrets; private server credentials are never embedded in the browser application.
- Supabase account and contest data must persist on Unraid-managed storage, and the owner is responsible for maintaining and testing backups using the documented procedure.
- Initial access is for the local network. If access outside that network is desired, the owner separately configures a reverse proxy, HTTPS, and suitable access controls.
- Existing accounts and contest records may be migrated or restored into the Unraid-hosted Supabase deployment as described by a documented migration/restore procedure; the app must not silently use separate or ephemeral storage.
- Existing NFL contest rules and user workflows remain unchanged by the deployment target.
