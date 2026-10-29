import { describe, expect, it } from 'vitest';
import {
  addressScheme,
  describeAddressScheme,
  resolveInternalPage,
  resolveUserInput,
} from '../navigation';

describe('resolveUserInput', () => {
  it('respeta una dirección que ya trae esquema', () => {
    expect(resolveUserInput('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(resolveUserInput('navegador://vpn')).toBe('navegador://vpn');
  });

  it('abre dominios, IPs y localhost como dirección', () => {
    expect(resolveUserInput('example.com')).toBe('https://example.com');
    expect(resolveUserInput('localhost:3000')).toBe('https://localhost:3000');
    expect(resolveUserInput('192.168.1.10:8080/x')).toBe('https://192.168.1.10:8080/x');
  });

  it('convierte el texto libre en una búsqueda de Google', () => {
    expect(resolveUserInput('mejores restaurantes')).toBe(
      'https://www.google.com/search?q=mejores%20restaurantes',
    );
  });

  it('recorta espacios y devuelve cadena vacía si no hay nada', () => {
    expect(resolveUserInput('   ')).toBe('');
    expect(resolveUserInput('  example.com  ')).toBe('https://example.com');
  });
});

describe('resolveInternalPage', () => {
  it('entiende los alias en español', () => {
    expect(resolveInternalPage('navegador://mineria')).toBe('miner');
    expect(resolveInternalPage('navegador://bloqueador')).toBe('blocker');
    expect(resolveInternalPage('navegador://ia')).toBe('ai');
  });

  it('acepta los identificadores en inglés y el esquema alternativo', () => {
    expect(resolveInternalPage('navegador://marketplace')).toBe('marketplace');
    expect(resolveInternalPage('navigatorx://favoritos')).toBe('favorites');
  });

  it('devuelve null para páginas desconocidas o direcciones externas', () => {
    expect(resolveInternalPage('navegador://loquesea')).toBeNull();
    expect(resolveInternalPage('https://example.com')).toBeNull();
  });
});

describe('addressScheme', () => {
  it('clasifica direcciones internas, seguras y sin cifrar', () => {
    expect(addressScheme('navegador://vpn')).toBe('internal');
    expect(addressScheme('runtime://kernel')).toBe('internal');
    expect(addressScheme('https://example.com')).toBe('secure');
    expect(addressScheme('http://example.com')).toBe('insecure');
    expect(addressScheme('')).toBe('local');
  });

  it('describe el esquema en español', () => {
    expect(describeAddressScheme('secure')).toContain('HTTPS');
    expect(describeAddressScheme('insecure')).toContain('HTTP');
    expect(describeAddressScheme('internal')).toContain('interna');
  });
});
