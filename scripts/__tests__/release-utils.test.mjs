import { describe, expect, it } from 'vitest';
import {
  CHECKSUMS_FILE,
  checkVersionMatch,
  formatChecksumLine,
  isPrerelease,
  versionFromTag,
} from '../release-utils.mjs';

describe('versionFromTag', () => {
  it('acepta etiquetas con y sin sufijo', () => {
    expect(versionFromTag('v0.3.4-alpha')).toBe('0.3.4-alpha');
    expect(versionFromTag('v1.0.0')).toBe('1.0.0');
    expect(versionFromTag('v2.14.7-rc.1')).toBe('2.14.7-rc.1');
    expect(versionFromTag('  v0.3.4  ')).toBe('0.3.4');
  });

  it('rechaza lo que no es una etiqueta de versión', () => {
    for (const tag of ['0.3.4-alpha', 'v0.3', 'release-1', '', null, undefined, 'v1.0.0.0']) {
      expect(versionFromTag(tag)).toBeNull();
    }
  });
});

describe('checkVersionMatch', () => {
  it('acepta etiqueta y package.json iguales', () => {
    expect(checkVersionMatch('v0.3.4-alpha', '0.3.4-alpha')).toEqual({ ok: true, version: '0.3.4-alpha' });
  });

  it('falla si no coinciden (el binario mentiría sobre su versión)', () => {
    const result = checkVersionMatch('v0.3.5-alpha', '0.3.4-alpha');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('0.3.5-alpha');
    expect(result.error).toContain('0.3.4-alpha');
  });

  it('falla con una etiqueta mal formada', () => {
    const result = checkVersionMatch('release', '0.3.4-alpha');
    expect(result.ok).toBe(false);
  });
});

describe('isPrerelease', () => {
  it('marca como pre-release lo que lleva sufijo', () => {
    expect(isPrerelease('0.3.4-alpha')).toBe(true);
    expect(isPrerelease('1.0.0-rc.1')).toBe(true);
    expect(isPrerelease('1.0.0')).toBe(false);
  });
});

describe('formatChecksumLine', () => {
  const hash = 'a'.repeat(64);

  it('usa el formato de sha256sum', () => {
    expect(formatChecksumLine(hash, 'NavegadorX-Setup-0.3.4-alpha.exe')).toBe(
      `${hash}  NavegadorX-Setup-0.3.4-alpha.exe`,
    );
  });

  it('normaliza el hash a minúsculas', () => {
    expect(formatChecksumLine('A'.repeat(64), 'x.exe').startsWith('a'.repeat(64))).toBe(true);
  });

  it('rechaza hashes y nombres inválidos', () => {
    expect(() => formatChecksumLine('123', 'x.exe')).toThrow();
    expect(() => formatChecksumLine(hash, '')).toThrow();
    expect(() => formatChecksumLine(hash, 'a\nb')).toThrow();
  });

  it('el nombre del fichero de sumas es estable', () => {
    expect(CHECKSUMS_FILE).toBe('SHA256SUMS.txt');
  });
});
