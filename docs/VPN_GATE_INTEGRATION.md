# VPN Gate integration — phase 1

## Implemented

- `server/vpn-gate.ts` reads the official public VPN Gate CSV feed at
  `https://www.vpngate.net/api/iphone/`.
- The parser validates the CSV schema, IPv4 addresses, country codes and the
  presence of an OpenVPN profile before including a relay.
- The server caches a successful catalogue in memory for 60 seconds and uses a
  12-second upstream timeout and an 8 MiB response limit.
- `GET /api/v1/vpn/servers` returns normalized catalogue metadata. It does not
  return the base64 OpenVPN profile to the renderer.
- The VPN dashboard now renders only live catalogue data. If VPN Gate is
  unavailable, it displays an explicit error instead of fabricated nodes.
- The former connect/disconnect endpoints return HTTP 501 until a native
  OpenVPN process adapter exists. They never claim that a tunnel was started.

## API response

```json
{
  "servers": [
    {
      "id": "vpngate:1.2.3.4",
      "hostName": "relay.example",
      "ip": "1.2.3.4",
      "country": "United States",
      "countryCode": "US",
      "pingMs": 42,
      "speedBytesPerSecond": 1200000,
      "activeSessions": 12,
      "uptimeMs": 86400000,
      "loggingPolicy": "no-log-claim",
      "protocol": "OpenVPN"
    }
  ],
  "fetchedAt": 1790000000000,
  "cached": false
}
```

## Trust and privacy

VPN Gate is a volunteer-operated relay network, not a uniform commercial VPN
service. A relay's reported logging policy is an operator-provided statement,
not an independently verified guarantee. The UI therefore labels it as a
declaration and does not promise anonymity or leak protection.

The catalogue feed is fixed in source code; no user-controlled URL is fetched.
The profile payload is intentionally not exposed to the browser UI. Before
native connection support is added, profile parsing must reject unsafe OpenVPN
directives (including script/plugin hooks), constrain remote endpoints, and
write validated profiles only to an application-owned directory.

## Not implemented in this phase

- Downloading or activating a profile.
- Installing or invoking OpenVPN.
- System-wide route/DNS changes, kill switch, reconnect logic or leak tests.
- Reporting a connected state or public-IP change.

These capabilities require a separately reviewed native adapter and Windows
integration tests. The browser proxy feature is not a VPN tunnel.
