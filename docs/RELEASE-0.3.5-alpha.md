# Release `v0.3.5-alpha` — acta

Fecha: 2026-10-29 · Estado: **publicado; verificación completa en todo lo que se puede comprobar desde este entorno**

## 1. Qué se hizo

| Paso | Resultado |
|---|---|
| `check-version` antes de etiquetar | `0.3.5-alpha` = `package.json` ✓ |
| `npm run verify` en local | typecheck 0 errores · **51 pruebas, 51 correctas** |
| Etiqueta anotada | `v0.3.5-alpha` sobre `14ee12f` (el merge de #7 en `main`) |
| Workflow `Release` | `verify` ✓ → `build` (windows-latest, 6 m 47 s) ✓ → publicado |
| Release | **pre-release** automático por el sufijo `-alpha` |

## 2. Artefactos

| Fichero | Tamaño | SHA-256 (declarado por GitHub) |
|---|---|---|
| `NavegadorX-Setup-0.3.5-alpha.exe` | 103 346 519 B | `a55698b003086f3d82af35ce383d66d7bd0985ca9aeb2ca2d16cb42f9d9e453b` |
| `NavegadorX-Portable-0.3.5-alpha.exe` | 103 107 636 B | `597f9066adc775d3d5aba2c8a4a56ab0405eb3fa351fc2c8df8203642ee63086` |
| `NavegadorX-Setup-0.3.5-alpha.exe.blockmap` | 107 632 B | `2652c9040b1cd3842fc546f64ad781d46986e5c77ed346a60067f4e6ca07a826` |
| `SHA256SUMS.txt` | 203 B | `661ecf65b38ac7fe8d4451f1f2ca21b7e09d5a24ccac0cbc95edee4b756f7814` |

Los cuatro digests aparecieron en la API unos 30 s después de subir los assets. El nombre
de los ejecutables sale de `package.json`, así que ya confirma que se compiló la versión
etiquetada.

## 3. Lo que el workflow comprobó

1. `Check tag matches package.json` → verde (la puerta nueva del Bloque E).
2. `Typecheck` y `Unit tests` en el runner → verde.
3. `Copy sources to a short path` → empaquetado sin el fallo del `include` de 263 caracteres.
4. `Check signature` → `Build SIN FIRMAR`, y las notas del release lo dicen (no hay
   certificado; ver `docs/FIRMA-DE-CODIGO.md`).
5. `Generate SHA256SUMS` → el fichero se generó a partir de los dos `.exe`.
6. `Decide release channel` → `prerelease=true` por el sufijo.
7. `Publish release` → los cuatro assets.

## 4. Límite de la verificación (igual que en 0.3.4)

No puedo descargar los binarios desde este entorno: las descargas van por
`release-assets.githubusercontent.com`, que no está entre los hosts accesibles. Lo
intenté de nuevo con `gh release download` y devuelve `EOF`.

Por tanto **no he cruzado `SHA256SUMS.txt` con el `.exe` descargado**. Lo que sí está
comprobado: los assets existen con su digest calculado por GitHub, el paso que genera el
fichero terminó en verde, y el nombre/versión salen del `package.json` etiquetado.

**Comprobación pendiente de tu lado** (30 s):

```powershell
gh release download v0.3.5-alpha --pattern '*Setup*.exe' --pattern 'SHA256SUMS.txt'
Get-FileHash .\NavegadorX-Setup-0.3.5-alpha.exe -Algorithm SHA256
# Debe coincidir con la línea del instalador en SHA256SUMS.txt
# y con a55698b003086f3d82af35ce383d66d7bd0985ca9aeb2ca2d16cb42f9d9e453b
```

## 5. Qué lleva esta versión

- **Interfaz**: barra de ventana duplicada y panel de administración cortado, corregidos;
  foco visible, pestañas con teclado, diálogos modales con foco atrapado, «Saltar al
  contenido», `prefers-reduced-motion`.
- **Navegación**: `localhost:3000` ya se abre (antes se interpretaba como un esquema).
- **Servidor**: escucha en `127.0.0.1` por defecto, validación de entrada, saneado
  anti-`__proto__`, límite de peticiones, errores sin filtrar detalles.
- **Release**: verificación previa, ruta corta, `SHA256SUMS.txt`, pre-release automático.
- **Web**: publicada en GitHub Pages con las fuentes empaquetadas (sin Google Fonts) y la
  versión real en pantalla.
- **Pruebas**: 51 (antes, ninguna).

## 6. Sigue abierto

- **Firma de código**: sin certificado. Integración lista (`CSC_LINK`/`CSC_KEY_PASSWORD`).
- **Origen de Pages**: sigue en `legacy` (`main` / root), así que cada push publica dos
  veces y puede ganar el árbol de fuentes. Requiere Settings → Pages → Source: **GitHub
  Actions**; la API devuelve 403 con el token disponible.
- **Reglas de Firestore**: en el repositorio, sin desplegar en Firebase.
- **Dependabot**: avisos en la rama por defecto y un run `Dependabot Updates` que falló
  sobre `main`; su log no es legible desde este entorno.
