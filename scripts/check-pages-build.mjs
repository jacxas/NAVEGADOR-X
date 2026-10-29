/**
 * Comprueba que `dist/` funciona servido bajo un subpath, como en GitHub Pages
 * (https://<usuario>.github.io/NAVEGADOR-X/).
 *
 * Levanta un servidor local que imita ese montaje y pide lo que pediría el
 * navegador: el index, cada script y hoja de estilos, y las fuentes referenciadas
 * desde el CSS. Detecta el fallo clásico de Pages: un `base` absoluto en Vite que
 * deja todos los recursos en 404.
 *
 * Uso:
 *   npm run build && node scripts/check-pages-build.mjs
 *
 * Sale con código 1 si algún recurso falla o si aparece un @import externo.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const PREFIX = '/NAVEGADOR-X/';
const PORT = Number(process.env.PAGES_CHECK_PORT || 4321);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('No hay dist/index.html. Ejecuta `npm run build` primero.');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];

  // GitHub Pages redirige /NAVEGADOR-X a /NAVEGADOR-X/.
  if (url === PREFIX.slice(0, -1)) {
    res.writeHead(301, { Location: PREFIX });
    res.end();
    return;
  }

  if (!url.startsWith(PREFIX)) {
    res.writeHead(404);
    res.end('fuera del subpath');
    return;
  }

  const relative = url.slice(PREFIX.length) || 'index.html';
  const file = path.join(distDir, relative);
  // Nada de salir de dist/ con ../ en la URL.
  if (!file.startsWith(distDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('no encontrado');
    return;
  }

  res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${PORT}`;
const failures = [];

try {
  const html = await (await fetch(base + PREFIX)).text();
  const refs = [...html.matchAll(/(?:src|href)="(\.{1,2}\/[^"]+)"/g)].map((match) => match[1]);

  if (refs.length === 0) failures.push('index.html no referencia ningún asset con ruta relativa.');
  if (/["'(]\/assets\//.test(html)) failures.push('index.html usa rutas absolutas /assets/: en Pages darían 404.');

  console.log(`Referencias relativas en index.html: ${refs.length}`);
  for (const ref of refs) {
    const res = await fetch(base + PREFIX + ref.replace(/^\.\//, ''));
    const mark = res.ok ? 'ok  ' : 'FALLA';
    console.log(`  ${mark} ${res.status} ${ref}`);
    if (!res.ok) failures.push(`${ref} devuelve ${res.status}`);
  }

  const cssRef = refs.find((ref) => ref.endsWith('.css'));
  if (!cssRef) {
    failures.push('No hay hoja de estilos en index.html.');
  } else {
    const cssPath = PREFIX + cssRef.replace(/^\.\//, '');
    const cssText = await (await fetch(base + cssPath)).text();

    if (/@import\s*["']https?:/.test(cssText)) {
      failures.push('El CSS importa estilos externos: la CSP (style-src \'self\') los bloquea.');
    }

    // Las fuentes se resuelven respecto al CSS, no respecto a la raíz del sitio.
    const cssDir = cssPath.replace(/\/[^/]+$/, '');
    const fonts = [...cssText.matchAll(/url\((\.{1,2}\/[^)]+\.woff2)\)/g)].map((match) => match[1]);
    console.log(`Fuentes referenciadas desde el CSS: ${fonts.length}`);
    for (const font of fonts) {
      const fontUrl = cssDir + '/' + font.replace(/^\.\//, '');
      const res = await fetch(base + fontUrl);
      if (!res.ok) failures.push(`${fontUrl} devuelve ${res.status}`);
    }
    if (fonts.length > 0) {
      const sample = await fetch(base + cssDir + '/' + fonts[0].replace(/^\.\//, ''));
      console.log(`  ${sample.ok ? 'ok  ' : 'FALLA'} ${sample.status} ${fonts[0]} (${sample.headers.get('content-type')})`);
    }
  }
} finally {
  server.close();
}

if (failures.length > 0) {
  console.error('\nFallos:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`\nCorrecto: el build funciona servido desde ${PREFIX}`);
