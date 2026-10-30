/**
 * VPN Gate public server catalogue.
 *
 * This module only discovers and normalizes public OpenVPN endpoints. It does
 * not establish a VPN tunnel and never reports a connection as active.
 */
import { validateOpenVPNProfile, type ValidatedOpenVPNProfile } from './openvpn-profile';

export const VPN_GATE_CSV_URL = 'https://www.vpngate.net/api/iphone/';
export const VPN_GATE_CACHE_TTL_MS = 60_000;
const MAX_CSV_BYTES = 8 * 1024 * 1024;

export interface VPNGateServer {
  id: string;
  hostName: string;
  ip: string;
  country: string;
  countryCode: string;
  pingMs: number | null;
  speedBytesPerSecond: number | null;
  activeSessions: number | null;
  uptimeMs: number | null;
  loggingPolicy: 'no-log-claim' | 'some-logs' | 'unknown';
  protocol: 'OpenVPN';
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(value);
      value = '';
    } else {
      value += char;
    }
  }
  fields.push(value);
  return fields;
}

function finiteNumber(value: string | undefined): number | null {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validIPv4(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255 && String(n) === part.replace(/^0+(?=\d)/, '');
  });
}

export function parseVPNGateCsv(csv: string): VPNGateServer[] {
  if (typeof csv !== 'string' || csv.length > MAX_CSV_BYTES) {
    throw new Error('VPN Gate catalogue is empty or exceeds the size limit.');
  }
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith('HostName,'));
  if (headerIndex < 0) throw new Error('VPN Gate CSV header was not found.');

  const headers = parseCsvLine(lines[headerIndex]);
  const index = (name: string) => headers.indexOf(name);
  const required = ['HostName', 'IP', 'CountryLong', 'CountryShort', 'OpenVPN_ConfigData_Base64'];
  if (required.some((name) => index(name) < 0)) {
    throw new Error('VPN Gate CSV schema is missing required columns.');
  }

  const result: VPNGateServer[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim() || line.startsWith('*')) continue;
    const cells = parseCsvLine(line);
    const get = (name: string) => cells[index(name)] ?? '';
    const ip = get('IP').trim();
    const encodedProfile = get('OpenVPN_ConfigData_Base64').trim();
    if (!validIPv4(ip) || !encodedProfile || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedProfile)) continue;

    const countryCode = get('CountryShort').trim().toUpperCase();
    const hostName = get('HostName').trim();
    if (!hostName || !/^[A-Z]{2}$/.test(countryCode)) continue;

    const logType = get('LogType').trim();
    result.push({
      id: `vpngate:${ip}`,
      hostName,
      ip,
      country: get('CountryLong').trim() || countryCode,
      countryCode,
      pingMs: finiteNumber(get('Ping')),
      speedBytesPerSecond: finiteNumber(get('Speed')),
      activeSessions: finiteNumber(get('NumVpnSessions')),
      uptimeMs: finiteNumber(get('Uptime')),
      loggingPolicy: logType === '0' ? 'no-log-claim' : logType === '1' || logType === '2' ? 'some-logs' : 'unknown',
      protocol: 'OpenVPN',
    });
  }
  return result;
}

let cachedServers: VPNGateServer[] = [];
let cachedAt = 0;

export async function getVPNGateServers(options: {
  fetchImpl?: typeof fetch;
  forceRefresh?: boolean;
  now?: number;
} = {}): Promise<{ servers: VPNGateServer[]; fetchedAt: number; cached: boolean }> {
  const now = options.now ?? Date.now();
  if (!options.forceRefresh && cachedServers.length && now - cachedAt < VPN_GATE_CACHE_TTL_MS) {
    return { servers: cachedServers, fetchedAt: cachedAt, cached: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await (options.fetchImpl ?? fetch)(VPN_GATE_CSV_URL, {
      headers: { Accept: 'text/csv, text/plain;q=0.9' },
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`VPN Gate catalogue returned HTTP ${response.status}.`);
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_CSV_BYTES) throw new Error('VPN Gate catalogue exceeds the size limit.');
    const csv = await response.text();
    const servers = parseVPNGateCsv(csv);
    if (!servers.length) throw new Error('VPN Gate returned no valid OpenVPN servers.');
    cachedServers = servers;
    cachedAt = now;
    return { servers, fetchedAt: cachedAt, cached: false };
  } finally {
    clearTimeout(timeout);
  }
}

/** Test helper: clears process-local catalogue cache. */
export function clearVPNGateCache(): void {
  cachedServers = [];
  cachedAt = 0;
}


/**
 * Fetches and validates one relay profile for trusted main-process use.
 * Never expose this result to the renderer: it contains inline private key
 * material supplied by the volunteer relay operator.
 */
export async function getVPNGateOpenVPNProfile(
  ip: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<ValidatedOpenVPNProfile> {
  if (!validIPv4(ip)) throw new Error('VPN Gate relay IP is invalid.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await (options.fetchImpl ?? fetch)(VPN_GATE_CSV_URL, {
      headers: { Accept: 'text/csv, text/plain;q=0.9' },
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`VPN Gate catalogue returned HTTP ${response.status}.`);
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_CSV_BYTES) throw new Error('VPN Gate catalogue exceeds the size limit.');
    const csv = await response.text();
    if (csv.length > MAX_CSV_BYTES) throw new Error('VPN Gate catalogue exceeds the size limit.');

    const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/);
    const headerIndex = lines.findIndex((line) => line.startsWith('HostName,'));
    if (headerIndex < 0) throw new Error('VPN Gate CSV header was not found.');
    const headers = parseCsvLine(lines[headerIndex]);
    const ipIndex = headers.indexOf('IP');
    const profileIndex = headers.indexOf('OpenVPN_ConfigData_Base64');
    if (ipIndex < 0 || profileIndex < 0) throw new Error('VPN Gate CSV schema is missing profile columns.');

    for (const line of lines.slice(headerIndex + 1)) {
      if (!line.trim() || line.startsWith('*')) continue;
      const cells = parseCsvLine(line);
      if ((cells[ipIndex] || '').trim() !== ip) continue;
      const encoded = (cells[profileIndex] || '').trim();
      if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('VPN Gate profile encoding is invalid.');
      const decoded = Buffer.from(encoded, 'base64');
      if (decoded.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
        throw new Error('VPN Gate profile is not canonical base64.');
      }
      return validateOpenVPNProfile(decoded.toString('utf8'));
    }
    throw new Error('The selected VPN Gate relay no longer exists in the live catalogue.');
  } finally {
    clearTimeout(timeout);
  }
}
