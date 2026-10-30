/**
 * Validates the declarative (data-only) feature update contract.
 * This module never downloads, imports or executes artifacts.
 */
export type FeatureArtifactKind = 'rules' | 'config' | 'locale';
export interface FeatureUpdateArtifact {
  id: string; version: string; kind: FeatureArtifactKind; description: string;
  minCoreVersion: string; maxCoreVersion?: string; channel: 'stable' | 'beta';
  url: string; sha512: string; size: number; permissions: string[]; publishedAt: string;
}
export interface FeatureUpdateManifest {
  schemaVersion: 1; product: 'navegador-x'; generatedAt: string; artifacts: FeatureUpdateArtifact[];
}
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
const SHA512_HEX = /^[a-f0-9]{128}$/i;
export function isSemver(value: unknown): value is string {
  return typeof value === 'string' && SEMVER.test(value);
}
function parseSemver(value: string) {
  const match = SEMVER.exec(value);
  if (!match) throw new Error(`Versión semver inválida: ${value}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ? match[4].split('.') : [] };
}
/** Returns -1, 0 or 1 following SemVer precedence (build metadata is ignored). */
export function compareSemver(left: string, right: string): number {
  const a = parseSemver(left), b = parseSemver(right);
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (!a.prerelease.length && !b.prerelease.length) return 0;
  if (!a.prerelease.length) return 1;
  if (!b.prerelease.length) return -1;
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i += 1) {
    const av = a.prerelease[i], bv = b.prerelease[i];
    if (av === undefined) return -1;
    if (bv === undefined) return 1;
    if (av === bv) continue;
    const an = /^\d+$/.test(av), bn = /^\d+$/.test(bv);
    if (an && bn) return Number(av) < Number(bv) ? -1 : 1;
    if (an !== bn) return an ? -1 : 1;
    return av < bv ? -1 : 1;
  }
  return 0;
}
export function validateFeatureManifest(input: unknown): FeatureUpdateManifest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('El manifiesto debe ser un objeto JSON.');
  const value = input as Record<string, unknown>;
  if (value.schemaVersion !== 1 || value.product !== 'navegador-x') throw new Error('Producto o schemaVersion no compatible.');
  if (typeof value.generatedAt !== 'string' || !Number.isFinite(Date.parse(value.generatedAt))) throw new Error('generatedAt debe ser una fecha ISO válida.');
  if (!Array.isArray(value.artifacts)) throw new Error('artifacts debe ser un array.');
  const seen = new Set<string>();
  const artifacts = value.artifacts.map((raw, index): FeatureUpdateArtifact => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Artifact #${index} inválido.`);
    const item = raw as Record<string, unknown>;
    for (const field of ['id','version','description','minCoreVersion','channel','url','sha512','publishedAt']) {
      if (typeof item[field] !== 'string' || !(item[field] as string).trim()) throw new Error(`Artifact #${index}: ${field} es obligatorio.`);
    }
    const id = item.id as string;
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id)) throw new Error(`ID de artifact inválido: ${id}`);
    if (seen.has(id)) throw new Error(`Artifact duplicado: ${id}`);
    seen.add(id);
    if (!isSemver(item.version) || !isSemver(item.minCoreVersion)) throw new Error(`Artifact ${id}: versión semver inválida.`);
    if (item.maxCoreVersion !== undefined && !isSemver(item.maxCoreVersion)) throw new Error(`Artifact ${id}: maxCoreVersion inválida.`);
    if (item.maxCoreVersion && compareSemver(item.minCoreVersion as string, item.maxCoreVersion as string) > 0) throw new Error(`Artifact ${id}: rango de core invertido.`);
    if (!['rules','config','locale'].includes(String(item.kind))) throw new Error(`Artifact ${id}: kind no permitido.`);
    if (!['stable','beta'].includes(String(item.channel))) throw new Error(`Artifact ${id}: channel no permitido.`);
    let artifactUrl: URL;
    try { artifactUrl = new URL(item.url as string); } catch { throw new Error(`Artifact ${id}: URL inválida.`); }
    if (artifactUrl.protocol !== 'https:' || artifactUrl.username || artifactUrl.password) throw new Error(`Artifact ${id}: sólo se permiten URLs HTTPS sin credenciales.`);
    if (!SHA512_HEX.test(item.sha512 as string)) throw new Error(`Artifact ${id}: SHA-512 debe ser hexadecimal de 128 caracteres.`);
    if (!Number.isSafeInteger(item.size) || (item.size as number) <= 0 || (item.size as number) > 20 * 1024 * 1024) throw new Error(`Artifact ${id}: tamaño fuera del límite (1 byte–20 MiB).`);
    if (!Array.isArray(item.permissions) || item.permissions.length > 0) throw new Error(`Artifact ${id}: los paquetes data-only no pueden solicitar permisos de ejecución.`);
    if (typeof item.publishedAt !== 'string' || !Number.isFinite(Date.parse(item.publishedAt))) throw new Error(`Artifact ${id}: publishedAt debe ser una fecha ISO válida.`);
    return item as unknown as FeatureUpdateArtifact;
  });
  return { schemaVersion: 1, product: 'navegador-x', generatedAt: value.generatedAt as string, artifacts };
}
export function isCoreVersionCompatible(artifact: FeatureUpdateArtifact, coreVersion: string): boolean {
  if (!isSemver(coreVersion)) return false;
  if (compareSemver(coreVersion, artifact.minCoreVersion) < 0) return false;
  return !artifact.maxCoreVersion || compareSemver(coreVersion, artifact.maxCoreVersion) <= 0;
}
