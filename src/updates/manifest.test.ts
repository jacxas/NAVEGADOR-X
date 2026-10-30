import { describe, expect, it } from 'vitest';
import { compareSemver, isCoreVersionCompatible, validateFeatureManifest, type FeatureUpdateArtifact } from './manifest';
const artifact: FeatureUpdateArtifact = {
  id:'adblock.rules', version:'1.2.0', kind:'rules', description:'Reglas declarativas',
  minCoreVersion:'0.3.0', maxCoreVersion:'0.9.0', channel:'stable',
  url:'https://github.com/example/releases/download/v1/rules.json', sha512:'a'.repeat(128),
  size:2048, permissions:[], publishedAt:'2026-10-30T00:00:00.000Z'
};
const manifest = (item: FeatureUpdateArtifact = artifact) => ({
  schemaVersion:1, product:'navegador-x', generatedAt:'2026-10-30T00:00:00.000Z', artifacts:[item]
});
describe('feature update manifest', () => {
  it('accepts a valid data-only artifact', () => expect(validateFeatureManifest(manifest()).artifacts[0]).toMatchObject({id:artifact.id,kind:'rules'}));
  it('compares SemVer including prerelease precedence', () => {
    expect(compareSemver('1.0.0-alpha.2','1.0.0-alpha.10')).toBeLessThan(0);
    expect(compareSemver('1.0.0-rc.1','1.0.0')).toBeLessThan(0);
    expect(compareSemver('1.2.0+build.2','1.2.0+build.3')).toBe(0);
  });
  it('rejects unsafe URLs, malformed hashes and executable permissions', () => {
    expect(() => validateFeatureManifest(manifest({...artifact,url:'http://example.com/rules.json'}))).toThrow(/HTTPS/);
    expect(() => validateFeatureManifest(manifest({...artifact,sha512:'deadbeef'}))).toThrow(/SHA-512/);
    expect(() => validateFeatureManifest(manifest({...artifact,permissions:['filesystem.write']}))).toThrow(/data-only/);
  });
  it('rejects duplicate IDs and inverted compatibility ranges', () => {
    expect(() => validateFeatureManifest({...manifest(),artifacts:[artifact,artifact]})).toThrow(/duplicado/);
    expect(() => validateFeatureManifest(manifest({...artifact,minCoreVersion:'2.0.0',maxCoreVersion:'1.0.0'}))).toThrow(/invertido/);
  });
  it('checks core compatibility', () => {
    expect(isCoreVersionCompatible(artifact,'0.3.6-alpha')).toBe(true);
    expect(isCoreVersionCompatible(artifact,'0.2.9')).toBe(false);
    expect(isCoreVersionCompatible(artifact,'1.0.0')).toBe(false);
  });
});
