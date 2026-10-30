import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearVPNGateCache,
  getVPNGateServers,
  parseVPNGateCsv,
  VPN_GATE_CSV_URL,
} from './vpn-gate';

const fixture = [
  '*VPN Gate Public VPN Relay Servers List',
  'HostName,IP,Score,Ping,Speed,CountryLong,CountryShort,NumVpnSessions,Uptime,LogType,OpenVPN_ConfigData_Base64',
  'relay.example,1.2.3.4,100,42,1200000,United States,US,12,86400000,0,Y29uZmln',
  'relay-two,999.2.3.4,90,50,1000000,Invalid,US,2,1000,1,Y29uZmln',
  'relay-three,5.6.7.8,80,not-a-number,900000,Japan,JP,4,5000,1,Y29uZmln',
].join('\n');

afterEach(() => {
  clearVPNGateCache();
  vi.restoreAllMocks();
});

describe('VPN Gate catalogue parser', () => {
  it('normalizes valid public OpenVPN relay rows and skips invalid IPs', () => {
    const servers = parseVPNGateCsv(fixture);
    expect(servers).toHaveLength(2);
    expect(servers[0]).toMatchObject({
      id: 'vpngate:1.2.3.4',
      country: 'United States',
      countryCode: 'US',
      pingMs: 42,
      speedBytesPerSecond: 1_200_000,
      activeSessions: 12,
      loggingPolicy: 'no-log-claim',
      protocol: 'OpenVPN',
    });
    expect(servers[1].pingMs).toBeNull();
  });

  it('rejects malformed or incompatible CSV responses', () => {
    expect(() => parseVPNGateCsv('not a VPN Gate response')).toThrow(/header/i);
    expect(() => parseVPNGateCsv('HostName,IP\nrelay,1.2.3.4')).toThrow(/schema/i);
  });

  it('fetches the official feed and caches successful results briefly', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(VPN_GATE_CSV_URL);
      return new Response(fixture, { status: 200, headers: { 'content-type': 'text/csv' } });
    }) as unknown as typeof fetch;

    const first = await getVPNGateServers({ fetchImpl, now: 10_000 });
    const second = await getVPNGateServers({ fetchImpl, now: 10_500 });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.servers).toEqual(first.servers);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not cache an unsuccessful upstream response', async () => {
    const fetchImpl = vi.fn(async () => new Response('unavailable', { status: 503 })) as unknown as typeof fetch;
    await expect(getVPNGateServers({ fetchImpl, now: 20_000 })).rejects.toThrow(/503/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
