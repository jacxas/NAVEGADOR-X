/**
 * Utilidades del proceso de publicación.
 *
 * Sin dependencias y sin efectos al importar: se prueban directamente con Vitest
 * y las usa `scripts/check-version.mjs` en el workflow de release.
 */

/**
 * Extrae la versión de una etiqueta `v0.3.4-alpha`.
 * @param {string} tag
 * @returns {string | null} versión sin la `v`, o `null` si la etiqueta no vale.
 */
export function versionFromTag(tag) {
  if (typeof tag !== 'string') return null;
  const match = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag.trim());
  return match ? match[1] : null;
}

/**
 * Comprueba que la etiqueta y `package.json` digan lo mismo.
 * @param {string} tag
 * @param {string} packageVersion
 * @returns {{ ok: true, version: string } | { ok: false, error: string }}
 */
export function checkVersionMatch(tag, packageVersion) {
  const version = versionFromTag(tag);
  if (!version) {
    return { ok: false, error: `La etiqueta «${tag}» no tiene el formato vX.Y.Z[-sufijo].` };
  }
  if (version !== packageVersion) {
    return {
      ok: false,
      error: `La etiqueta dice ${version} y package.json dice ${packageVersion}. Actualiza la versión antes de etiquetar.`,
    };
  }
  return { ok: true, version };
}

/**
 * Una versión con sufijo (`0.3.4-alpha`, `1.0.0-rc.1`) se publica como
 * pre-release; una definitiva (`1.0.0`) no.
 * @param {string} version
 */
export function isPrerelease(version) {
  return typeof version === 'string' && version.includes('-');
}

/**
 * Nombre del fichero de sumas de verificación.
 */
export const CHECKSUMS_FILE = 'SHA256SUMS.txt';

/**
 * Formatea una línea de `SHA256SUMS` igual que `sha256sum`: hash, dos espacios, nombre.
 * @param {string} hash
 * @param {string} fileName
 */
export function formatChecksumLine(hash, fileName) {
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/i.test(hash)) {
    throw new Error(`Hash SHA-256 no válido: ${hash}`);
  }
  if (typeof fileName !== 'string' || !fileName.trim() || /[\r\n]/.test(fileName)) {
    throw new Error(`Nombre de fichero no válido: ${fileName}`);
  }
  return `${hash.toLowerCase()}  ${fileName.trim()}`;
}
