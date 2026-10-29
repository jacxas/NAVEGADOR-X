# Release `v0.3.4-alpha` — acta

Fecha: 2026-10-29 · Estado: **publicado y verificado en lo que se puede verificar desde este entorno**

## 1. Qué se hizo

| Paso | Resultado |
|---|---|
| PR #3 (`Bloques C–E`) | **mergeado** el 2026-10-29 02:41 UTC, commit de merge `717bce1` |
| `main` | `717bce1`, con `package.json` en `0.3.4-alpha` |
| Etiqueta | `v0.3.4-alpha` anotada sobre `717bce1`, empujada |
| Workflow `Release` | `verify` ✓ → `build` ✓ (Windows) → release publicado |
| CI en `main` | verde |
| Release | **pre-release**, con notas generadas |

## 2. Artefactos publicados

| Fichero | Tamaño | SHA-256 (declarado por GitHub) |
|---|---|---|
| `NavegadorX-Setup-0.3.4-alpha.exe` | 103 037 776 B | `1e7fdc4ece4fa3e13167f381fc91845a03ebb5f7ba088415acfe9489fe914b14` |
| `NavegadorX-Portable-0.3.4-alpha.exe` | 102 798 972 B | `ac07c4538f1cc13987dec749d205941f3a1151e1f5d8e048b8823cfd8bcf93c5` |
| `NavegadorX-Setup-0.3.4-alpha.exe.blockmap` | 107 225 B | `9aa0b400016f47b2b45735ab0d18cb092b73f4fc4e38d6e6b5187971d9960ba8` |
| `SHA256SUMS.txt` | 203 B | `ff8f93ed7cbc86414b11ef33441372cacfa17695dcc2eb693bfa7d2574f3c01f` |

El release está marcado como **pre-release** automáticamente porque la versión lleva
sufijo `-alpha`: es el comportamiento nuevo, no un ajuste manual.

## 3. Lo que el workflow comprobó por el camino

Los pasos del job de Windows salieron todos en verde:

1. **Copy sources to a short path** — `robocopy` a `C:\nx`: el empaquetado **no** falló
   por el `include` de NSIS de 263 caracteres, que era el bloqueo conocido.
2. **Check signature** — sin `CSC_LINK`, avisó `Build SIN FIRMAR` y siguió (comportamiento
   previsto). El release lo dice en sus notas.
3. **Generate SHA256SUMS** — los dos `.exe` resumidos en `SHA256SUMS.txt`.
4. **Decide release channel** — `prerelease=true` por el sufijo.
5. **Publish release** — Setup, Portable, blockmap y `SHA256SUMS.txt`.

El job `verify` (nuevo) pasó antes: comprobación etiqueta ↔ `package.json`, `tsc --noEmit`
y las 50 pruebas.

## 4. Límite de esta verificación

En este entorno **no puedo descargar los binarios**: las descargas de assets de GitHub van
por `release-assets.githubusercontent.com`, que no está en la lista de hosts accesibles
desde aquí (`EOF` en la descarga). Por eso **no** he podido recalcular el SHA-256 del
`.exe` contra `SHA256SUMS.txt` como en la auditoría anterior.

Lo que sí queda comprobado:

- los cuatro assets existen, con tamaño y digest calculados por GitHub;
- el workflow terminó con éxito, así que `Get-FileHash` se ejecutó sobre los dos `.exe` y
  `SHA256SUMS.txt` se generó a partir de ellos;
- las notas del release incluyen instrucciones de verificación y el aviso de firma.

**Comprobación que te toca a ti** (30 segundos, en tu equipo):

```powershell
gh release download v0.3.4-alpha --pattern '*Setup*.exe' --pattern 'SHA256SUMS.txt'
Get-FileHash .\NavegadorX-Setup-0.3.4-alpha.exe -Algorithm SHA256
# debe coincidir con la línea del instalador en SHA256SUMS.txt
# y con 1e7fdc4ece…b14 (el que declara GitHub)
```

Si los tres valores coinciden, el binario que descargas es exactamente el que se compiló
desde `v0.3.4-alpha`.

## 5. Contenido de la versión

- **Interfaz (Bloque C)**: barra de ventana duplicada, panel de administración cortado,
  foco visible, pestañas con teclado, diálogos modales, `prefers-reduced-motion`, y
  `localhost:3000` que ahora sí se abre.
- **Servidor (Bloque D)**: escucha en `127.0.0.1` por defecto, validación de entrada,
  saneado anti-`__proto__`, límite de peticiones, errores sin filtrar detalles.
- **Release (Bloque E)**: verificación previa, ruta corta, `SHA256SUMS.txt`, pre-release
  automático y firma opcional preparada.
- 50 pruebas automatizadas (antes, ninguna).

## 6. Sigue abierto

- **Firma de código**: sin certificado. Ver `docs/FIRMA-DE-CODIGO.md`; con `CSC_LINK` y
  `CSC_KEY_PASSWORD` el mismo workflow firma y verifica sin tocar código.
- **Reglas de Firestore**: presentes en el repositorio, **sin desplegar** en Firebase.
- **Inspección manual del instalador en Windows**: instalar, comprobar versión en
  Propiedades, abrir una web real y el panel de administración (que era donde se cortaba).
- **Dependabot**: 2 PRs de dependencias abiertos y avisos en la rama por defecto; el
  `npm audit` local está en 6 (0 críticas).
