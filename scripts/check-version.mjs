/**
 * Comprueba que la etiqueta que dispara el release coincide con `package.json`.
 *
 * Uso:
 *   node scripts/check-version.mjs v0.3.4-alpha
 *   GITHUB_REF_NAME=v0.3.4-alpha node scripts/check-version.mjs
 *
 * Sale con código 1 si no coinciden: publicar un binario `0.3.3` bajo la etiqueta
 * `v0.3.4` es exactamente el fallo que este paso evita.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkVersionMatch, isPrerelease } from './release-utils.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tag = process.argv[2] || process.env.GITHUB_REF_NAME || '';

if (!tag) {
  console.error('Falta la etiqueta. Uso: node scripts/check-version.mjs v0.3.4-alpha');
  process.exit(1);
}

const { version } = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const result = checkVersionMatch(tag, version);

if (!result.ok) {
  console.error(`::error::${result.error}`);
  process.exit(1);
}

console.log(`Etiqueta y package.json coinciden: ${result.version}`);
console.log(`prerelease=${isPrerelease(result.version)}`);
