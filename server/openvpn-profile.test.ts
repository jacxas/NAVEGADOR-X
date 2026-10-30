import { describe, expect, it } from 'vitest';
import { validateOpenVPNProfile } from './openvpn-profile';

const safeProfile = `client
dev tun
proto tcp-client
remote 1.2.3.4 443
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
redirect-gateway def1
dhcp-option DNS 1.1.1.1
verb 3
<ca>
-----BEGIN CERTIFICATE-----
QUJDREVGRw==
-----END CERTIFICATE-----
</ca>
`;

describe('VPN Gate OpenVPN profile validator', () => {
  it('accepts a minimal profile and normalizes directives', () => {
    const profile = validateOpenVPNProfile(safeProfile);
    expect(profile.remote).toEqual({ host: '1.2.3.4', port: 443, protocol: 'tcp-client' });
    expect(profile.directives).toContain('redirect-gateway');
    expect(profile.text).toContain('dhcp-option DNS 1.1.1.1');
  });

  it('rejects script, plugin, config and management directives', () => {
    for (const directive of [
      'up /tmp/payload',
      'down /tmp/payload',
      'plugin /tmp/plugin.so',
      'script-security 2',
      'config /tmp/other.ovpn',
      'management 127.0.0.1 7505',
      'tls-verify /tmp/verify.sh',
    ]) {
      expect(() => validateOpenVPNProfile(`${safeProfile}\n${directive}\n`)).toThrow(/rejected/i);
    }
  });

  it('rejects hostnames, invalid ports and malformed remote endpoints', () => {
    expect(() => validateOpenVPNProfile(safeProfile.replace('1.2.3.4 443', 'relay.example 443'))).toThrow(/remote/i);
    expect(() => validateOpenVPNProfile(safeProfile.replace('1.2.3.4 443', '1.2.3.4 99999'))).toThrow(/port/i);
  });

  it('rejects unknown inline blocks and unclosed certificate blocks', () => {
    expect(() => validateOpenVPNProfile(safeProfile.replace('<ca>', '<script>'))).toThrow(/block rejected/i);
    expect(() => validateOpenVPNProfile(safeProfile.replace('</ca>', ''))).toThrow(/unclosed/i);
  });

  it('requires a CA certificate and core client directives', () => {
    expect(() => validateOpenVPNProfile(safeProfile.replace(/<ca>[\s\S]*?<\/ca>/, ''))).toThrow(/missing/i);
    expect(() => validateOpenVPNProfile(safeProfile.replace('client\n', ''))).toThrow(/missing/i);
  });

  it('rejects oversized profiles', () => {
    expect(() => validateOpenVPNProfile('x'.repeat(1024 * 1024 + 1))).toThrow(/limit/i);
  });
});
