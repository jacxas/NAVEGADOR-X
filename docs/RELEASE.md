# Publicar un release

Procedimiento para la Edición de Escritorio. Todo lo que hay aquí se ha ejecutado al
menos una vez en este repositorio.

## 0. Antes de nada

```bash
npm ci
npm run lint     # tsc --noEmit
npm test         # 50 pruebas
npm run build && npm run build:electron
```

El workflow `release.yml` repite typecheck y pruebas en un job `verify`; si fallan, no se
compila. Es una red de seguridad, no una excusa para no probar en local.

## 1. Versión

La versión de `package.json` **tiene que coincidir** con la etiqueta. El workflow lo
comprueba (`scripts/check-version.mjs`) y falla si no coinciden.

```bash
npm version 0.3.4-alpha --no-git-tag-version   # ajusta package.json y package-lock.json
```

Añade también la entrada en `CHANGELOG.md` con la misma versión.

## 2. Merge a `main`

El release se construye desde la etiqueta, y la etiqueta se pone sobre `main`:

```bash
gh pr create --base main --head <rama> --title "…" --body "…"
gh pr merge <n> --merge
git checkout main && git pull
```

## 3. Etiqueta

```bash
git tag -a v0.3.4-alpha -m "Navegador X 0.3.4-alpha"
git push origin v0.3.4-alpha
```

Eso dispara `release.yml`: verifica, compila en `C:\nx` (ruta corta), firma si hay
certificado, genera `SHA256SUMS.txt` y publica el release. Las versiones con sufijo
(`-alpha`, `-beta`, `-rc.1`) se publican como **pre-release**; las definitivas, no.

## 4. Verificar el resultado

```bash
gh release view v0.3.4-alpha --repo jacxas/NAVEGADOR-X
gh release download v0.3.4-alpha --pattern '*Setup*.exe' --dir /tmp/rel
sha256sum /tmp/rel/*.exe        # comparar con SHA256SUMS.txt del release
```

Comprobaciones mínimas:

1. El digest del `.exe` descargado coincide con el de `SHA256SUMS.txt`.
2. El instalador dice la versión de la etiqueta (Propiedades → Detalles).
3. Instalado, la app abre una web real y `navegador://dashboard` responde.

## 5. Problema conocido de NSIS en local (Windows)

`electron-builder` genera los `.nsi` con rutas absolutas y Windows corta en **260
caracteres**. Si el proyecto vive en una ruta profunda (`C:\Users\…\Documents\GitHub\…`),
el empaquetado falla con un `include` de 263 caracteres.

Soluciones, en orden de preferencia:

1. Compilar desde una ruta corta (lo que hace el workflow):

   ```powershell
   robocopy . C:\nx /E /XD .git node_modules
   cd C:\nx
   npm ci && npm run package:win
   ```

2. Sacar la salida a una ruta corta y dejar el proyecto donde está:

   ```powershell
   npm run package:win -- --config.directories.output=C:\out
   ```

3. Activar rutas largas en Windows (`LongPathsEnabled`) — ayuda, pero `robocopy` es más
   fiable porque también acorta los temporales.

## 6. Firma

Ver `docs/FIRMA-DE-CODIGO.md`. Sin `CSC_LINK` el release se publica sin firmar y lo dice
en las notas; con él, el workflow falla si la firma no queda `Valid`.
