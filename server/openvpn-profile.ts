/**
 * Strict VPN Gate OpenVPN profile validator.
 *
 * Accepts only a small, reviewed directive set. Unknown directives are rejected
 * rather than passed through to OpenVPN, preventing profile-controlled scripts,
 * plugins, config includes and management endpoints.
 */
export interface ValidatedOpenVPNProfile {
  text: string;
  remote: { host: string; port: number; protocol: 'udp' | 'tcp-client' };
  directives: string[];
}

const MAX_PROFILE_BYTES = 1024 * 1024;
const ALLOWED_INLINE_BLOCKS = new Set(['ca', 'cert', 'key', 'tls-auth', 'tls-crypt']);
const ALLOWED_DIRECTIVES = new Set([
  'client',
  'dev',
  'proto',
  'remote',
  'resolv-retry',
  'nobind',
  'persist-key',
  'persist-tun',
  'cipher',
  'data-ciphers',
  'auth',
  'remote-cert-tls',
  'verb',
  'auth-nocache',
  'tls-client',
  'tls-version-min',
  'key-direction',
  'explicit-exit-notify',
  'connect-retry',
  'connect-retry-max',
  'remote-random',
  'remote-random-hostname',
  'mute-replay-warnings',
  'reneg-sec',
  'redirect-gateway',
  'dhcp-option',
  'route',
  'route-ipv6',
  'tun-mtu',
  'mssfix',
  'ping',
  'ping-restart',
]);

function validIPv4(host: string): boolean {
  const parts = host.split('.');
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255 && String(n) === part.replace(/^0+(?=\d)/, '');
  });
}

function validateDirective(name: string, args: string[]): void {
  if (!ALLOWED_DIRECTIVES.has(name)) throw new Error(`OpenVPN directive rejected: ${name}`);
  if (name === 'dev' && (args.length !== 1 || args[0] !== 'tun')) throw new Error('Only dev tun is permitted.');
  if (name === 'proto' && (args.length !== 1 || !['udp', 'tcp', 'tcp-client'].includes(args[0]))) {
    throw new Error('Only UDP or TCP client transport is permitted.');
  }
  if (name === 'remote') {
    if (args.length < 2 || args.length > 3 || !validIPv4(args[0])) throw new Error('Remote must be a literal IPv4 address and port.');
    const port = Number(args[1]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Remote port is invalid.');
    if (args[2] && args[2] !== 'udp' && args[2] !== 'tcp' && args[2] !== 'tcp-client') throw new Error('Remote protocol is invalid.');
  }
  if (name === 'redirect-gateway' && args.some((arg) => !['def1', 'bypass-dhcp', 'bypass-dns'].includes(arg))) {
    throw new Error('Unsupported redirect-gateway option.');
  }
  if (name === 'dhcp-option' && (args.length !== 2 || args[0] !== 'DNS' || !validIPv4(args[1]))) {
    throw new Error('Only explicit IPv4 DNS options are permitted.');
  }
  if (name === 'route') {
    if (args.length < 2 || args.length > 4 || !validIPv4(args[0]) || !validIPv4(args[1])) {
      throw new Error('Route directive is malformed.');
    }
    if (args[2] && args[2] !== 'vpn_gateway' && args[2] !== 'net_gateway' && !validIPv4(args[2])) {
      throw new Error('Route gateway is invalid.');
    }
    if (args[3] && !/^\d{1,5}$/.test(args[3])) throw new Error('Route metric is invalid.');
  }
  if (name === 'route-ipv6') throw new Error('IPv6 route directives are not enabled in this integration phase.');
  if (name === 'verb' && (args.length !== 1 || !/^[0-6]$/.test(args[0]))) throw new Error('Verb level is invalid.');
  if (name === 'key-direction' && (args.length !== 1 || !['0', '1'].includes(args[0]))) throw new Error('Key direction is invalid.');
  if (['explicit-exit-notify', 'connect-retry-max', 'reneg-sec', 'tun-mtu', 'mssfix', 'ping', 'ping-restart'].includes(name) && (args.length !== 1 || !/^\d{1,5}$/.test(args[0]))) throw new Error(`Invalid numeric value for ${name}.`);
  if (name === 'connect-retry' && (args.length < 1 || args.length > 2 || args.some((value) => !/^\d{1,5}$/.test(value)))) throw new Error('connect-retry value is invalid.');
  if (['cipher', 'data-ciphers', 'auth', 'tls-version-min'].includes(name) &&
      (args.length !== 1 || !/^[A-Za-z0-9:_-]{1,64}$/.test(args[0]))) {
    throw new Error(`Invalid value for ${name}.`);
  }
  if (name === 'remote-cert-tls' && (args.length !== 1 || args[0] !== 'server')) {
    throw new Error('Only remote-cert-tls server is permitted.');
  }
  if (name === 'resolv-retry' && (args.length !== 1 || args[0] !== 'infinite')) {
    throw new Error('Only resolv-retry infinite is permitted.');
  }
  if (['client', 'nobind', 'persist-key', 'persist-tun', 'auth-nocache', 'tls-client', 'remote-random', 'remote-random-hostname', 'mute-replay-warnings'].includes(name) && args.length !== 0) {
    throw new Error(`Directive ${name} takes no arguments.`);
  }
}

export function validateOpenVPNProfile(source: string): ValidatedOpenVPNProfile {
  if (typeof source !== 'string' || !source.trim() || Buffer.byteLength(source, 'utf8') > MAX_PROFILE_BYTES) {
    throw new Error('OpenVPN profile is empty or exceeds the 1 MiB limit.');
  }

  const lines = source.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n');
  const output: string[] = [];
  const directives: string[] = [];
  const inlineSeen = new Set<string>();
  let activeBlock: string | null = null;
  let blockLines: string[] = [];
  let remote: ValidatedOpenVPNProfile['remote'] | null = null;
  let selectedProtocol: 'udp' | 'tcp-client' = 'udp';
  let hasClient = false;
  let hasTun = false;
  let hasProto = false;
  let hasCa = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    if (activeBlock) {
      if (line.toLowerCase() === `</${activeBlock}>`) {
        if (!blockLines.length || blockLines.some((part) => !/^[A-Za-z0-9+/=:\s-]+$/.test(part))) {
          throw new Error(`Inline ${activeBlock} block contains invalid data.`);
        }
        output.push(`<${activeBlock}>`, ...blockLines, `</${activeBlock}>`);
        if (activeBlock === 'ca') hasCa = true;
        activeBlock = null;
        blockLines = [];
        continue;
      }
      if (blockLines.length > 20_000) throw new Error('Inline certificate block is too large.');
      blockLines.push(line);
      continue;
    }

    const openBlock = line.match(/^<([a-z-]+)>$/i);
    if (openBlock) {
      const name = openBlock[1].toLowerCase();
      if (!ALLOWED_INLINE_BLOCKS.has(name) || inlineSeen.has(name)) {
        throw new Error(`Inline OpenVPN block rejected: ${name}`);
      }
      inlineSeen.add(name);
      activeBlock = name;
      blockLines = [];
      continue;
    }
    if (/^<\//.test(line)) throw new Error('Unexpected closing inline block.');

    const parts = line.split(/\s+/);
    const name = parts.shift()!.toLowerCase();
    const args = parts;
    validateDirective(name, args);
    directives.push(name);
    output.push([name, ...args].join(' '));

    if (name === 'client') hasClient = true;
    if (name === 'dev') hasTun = true;
    if (name === 'proto') {
      if (hasProto) throw new Error('Multiple proto directives are not permitted.');
      hasProto = true;
      selectedProtocol = args[0] === 'tcp' ? 'tcp-client' : args[0] as 'udp' | 'tcp-client';
      if (remote) remote = { ...remote, protocol: selectedProtocol };
    }
    if (name === 'remote') {
      if (remote) throw new Error('Multiple remote endpoints are not permitted.');
      remote = { host: args[0], port: Number(args[1]), protocol: (args[2] === 'tcp' ? 'tcp-client' : args[2] as 'udp' | 'tcp-client' | undefined) || selectedProtocol };
    }
  }

  if (activeBlock) throw new Error(`Unclosed inline ${activeBlock} block.`);
  if (!hasClient || !hasTun || !hasProto || !remote || !hasCa) {
    throw new Error('Profile is missing client, dev tun, proto, remote or ca requirements.');
  }

  return { text: output.join('\n') + '\n', remote, directives };
}
