# Network exposure

The default deployment is for participant access on a trusted local network.
The app and Supabase API gateway are the only services with host-published
ports. PostgreSQL, Supavisor, Studio, and internal service ports remain on the
private Compose network.

## LAN access

- Set `APP_BIND_IP`, `APP_PORT`, `GATEWAY_BIND_IP`, and `KONG_HTTP_PORT` in
  `.env.unraid`. These are host-side app/gateway ports; for example, use
  `APP_PORT=3010` and `KONG_HTTP_PORT=8001` when those are the available LAN
  ports. `KONG_HTTP_PORT` is a legacy setting name and publishes the Envoy
  `api-gw` service's HTTP port.
- Set `SITE_URL` and `ADDITIONAL_REDIRECT_URLS` to the app origin and
  `/auth/callback`; set `SUPABASE_PUBLIC_URL` and `API_EXTERNAL_URL` to the
  gateway origin participants can reach.
- Keep `SUPABASE_INTERNAL_URL=http://api-gw:8000` for server-to-gateway
  traffic on the Compose network. Do not substitute the participant URL for
  this internal address without a deliberate network design.
- `POSTGRES_INTERNAL_PORT` is different from any host-published database
  port. Set it to the port on which PostgreSQL actually listens inside the
  `db` container; the deployment default is `5432`. Confirm an unusual
  setting using the database health check or `pg_isready` inside the
  container. The migration, backup, and restore tools use this value.
- If a port is already in use, select another host port, update every
  corresponding public origin, validate Compose interpolation, and recreate
  the affected services.
- The app uses a shared Supabase auth-cookie name on both browser and server
  clients. The cookie is marked `Secure` when `SUPABASE_PUBLIC_URL` uses HTTPS
  and not marked `Secure` for plain-HTTP LAN URLs so browsers can send it.
  Plain HTTP does not protect session traffic from other devices on the
  network; use HTTPS for untrusted networks and all remote access.
- Verify published ports with `docker ps --format '{{.Names}} {{.Ports}}'`.
  The only participant-facing mappings should be the app and gateway HTTP
  ports. The override removes upstream PostgreSQL and Supavisor mappings and
  does not publish the gateway's direct HTTPS port. Avoid publishing
  PostgreSQL directly to the LAN; if temporary database administration access
  is necessary, restrict it to a trusted management network and remove it
  afterward.

Do not configure router port forwarding to the Unraid host as a substitute
for a reverse proxy. Unraid management, PostgreSQL, Supavisor, Studio, and
other administrative endpoints must not be exposed to the public internet.

## Optional remote access

Remote access is an owner-managed configuration, not the default deployment.
Terminate HTTPS at a maintained reverse proxy, use valid certificates, and
expose only the app and Supabase API gateway routes. Configure the proxy to
preserve the intended host/protocol headers and support WebSocket upgrades for
Supabase Realtime. Keep Supabase Auth `SITE_URL`, `API_EXTERNAL_URL`,
`SUPABASE_PUBLIC_URL`, and callback redirect allow-lists aligned with the
public HTTPS origins.

Test sign-in, email callback redirects, browser API access, and Realtime over
the proxy before inviting participants. Do not publish direct WAN ports for
the app, Supabase administration, or database services.
