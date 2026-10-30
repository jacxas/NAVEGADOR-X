import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearVPNGateCache,
  getVPNGateServers,
  getVPNGateOpenVPNProfile,
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
      return { ok: true, status: 200, headers: { get: () => 'text/csv' }, text: async () => fixture } as unknown as Response;
    }) as unknown as typeof fetch;

    const first = await getVPNGateServers({ fetchImpl, now: 10_000 });
    const second = await getVPNGateServers({ fetchImpl, now: 10_500 });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.servers).toEqual(first.servers);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('decodes and validates a selected relay profile without exposing unsafe directives', async () => {
    const profile = [
      'client',
      'dev tun',
      'proto udp',
      'remote 1.2.3.4 1194',
      'resolv-retry infinite',
      'nobind',
      'persist-key',
      'persist-tun',
      'remote-cert-tls server',
      'verb 3',
      '<ca>',
      '-----BEGIN CERTIFICATE-----',
      'QUJDREVGRw==',
      '-----END CERTIFICATE-----',
      '</ca>',
    ].join('\\n');
    const encoded = Buffer.from(profile, 'utf8').toString('base64');
    const csv = [
      '*VPN Gate Public VPN Relay Servers List',
      'HostName,IP,OpenVPN_ConfigData_Base64',
      `relay.example,1.2.3.4,${encoded}`,
    ].join('\\n');
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => String(csv.length) },
      text: async () => csv,
    }) as unknown as Response) as unknown as typeof fetch;

    const validated = await getVPNGateOpenVPNProfile('1.2.3.4', { fetchImpl });
    expect(validated.remote).toEqual({ host: '1.2.3.4', port: 1194, protocol: 'udp' });
    expect(validated.text).toContain('<ca>');
  });

  it('does not cache an unsuccessful upstream response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503, headers: { get: () => null }, text: async () => 'unavailable' }) as unknown as Response) as unknown as typeof fetch;
    await expect(getVPNGateServers({ fetchImpl, now: 20_000 })).rejects.toThrow(/503/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
