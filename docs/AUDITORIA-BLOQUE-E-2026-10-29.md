# Bloque E — Release y firma de código

Fecha: 2026-10-29 · Versión en el árbol: `0.3.4-alpha` (sin etiquetar)
Base: `arena/6125c9b5-navegador-x` tras el Bloque D (`ec2d48d`)

Objetivo: que publicar un release sea un proceso repetible y verificado, y dejar la firma
de código preparada para el día que haya certificado.

---

## 1. Qué hace ahora `release.yml`

```
push tag v*  →  verify (Ubuntu)  →  build (Windows)  →  publish
```

**Job `verify`** (antes no existía):

| Paso | Qué evita |
|---|---|
| `check-version.mjs` | Publicar un binario `0.3.3` bajo la etiqueta `v0.3.4` |
| `npm run lint` | Compilar con errores de tipos |
| `npm test` | Publicar con pruebas en rojo |

Si algo falla, no se compila nada. El job de Windows depende de este.

**Job `build`**:

1. Copia las fuentes a `C:\nx` (ruta corta) con `robocopy`, excluyendo `.git` y
   `node_modules`. **Esto resuelve el fallo del `include` de NSIS de 263 caracteres**: el
   problema era la profundidad de la ruta, no el código.
2. `npm ci`, `npm run build:desktop`, `electron-builder --win --publish never`.
3. **Check signature**: `Get-AuthenticodeSignature` sobre el instalador.
   - Con `CSC_LINK` configurado y estado distinto de `Valid` → el workflow **falla**.
   - Sin certificado → aviso `Build SIN FIRMAR` y sigue.
4. **SHA256SUMS**: hash de cada `.exe` en formato `sha256sum` (dos espacios).
5. **Decide release channel**: `-alpha`/`-beta`/`-rc` → pre-release; versión limpia →
   release estable. Ya no está fijado en `prerelease: true`.
6. **Publish**: Setup, Portable, blockmaps y `SHA256SUMS.txt`, con instrucciones de
   verificación en las notas y el estado de firma real.

## 2. Qué se ha verificado aquí y qué no

| Comprobación | Dónde | Resultado |
|---|---|---|
| Sintaxis y estructura de los dos workflows | local (`js-yaml`) | válidos |
| `check-version.mjs` con etiqueta correcta | local | `exit 0`, `prerelease=true` |
| `check-version.mjs` con etiqueta equivocada | local | `exit 1` y mensaje `::error::` |
| `check-version.mjs` sin etiqueta | local | `exit 1` |
| Formato de `SHA256SUMS` y detección de hashes inválidos | Vitest | 10 pruebas |
| Typecheck + 50 pruebas | local | verdes |
| Compilación Windows real | GitHub Actions | **pendiente**: no hay Windows aquí; hay que verlo en el primer tag |
| Firma real | — | **imposible sin certificado** |

Sobre la firma: no se puede fabricar un certificado de confianza. Un autofirmado no
quita el aviso de Windows, así que no se ha hecho pasar por firma. Lo que sí está hecho es
la integración: en cuanto existan los secretos, firma y verifica sola.

## 3. Firma de código: estado y opciones

Documentado en `docs/FIRMA-DE-CODIGO.md`. Resumen:

| Opción | Coste orientativo | Nota |
|---|---|---|
| Azure Trusted Signing | ~10 USD/mes | La más práctica para CI; exige verificación de identidad |
| Certificado OV | 200–400 USD/año | Desde 2023, clave en token/HSM: en CI hace falta firma en la nube |
| Certificado EV | 400–700 USD/año | Mejor trato de SmartScreen desde el primer día |
| Sin firma (actual) | 0 | «Editor desconocido» en Windows |

Para activarlo: `CSC_LINK` (base64 o URL del `.pfx`) y `CSC_KEY_PASSWORD` como secretos
del repositorio. No hay que tocar código.

## 4. Documentación nueva

- `docs/RELEASE.md` — procedimiento completo: versión, merge, etiqueta, verificación del
  digest, y las tres formas de esquivar el límite de 260 caracteres de NSIS en local.
- `docs/FIRMA-DE-CODIGO.md` — opciones, costes, activación y cómo comprobar una firma.
- `scripts/check-version.mjs` + `scripts/release-utils.mjs` — comprobación de versión y
  utilidades (con 10 pruebas).
- `README.md` — sección «Releases y firma».

## 5. Pruebas

```
npm run lint   → 0
npm test       → 6 archivos, 50 pruebas, 50 correctas
               (21 interfaz + 19 servidor + 10 release)
```

## 6. Para publicar `v0.3.4-alpha`

El release se construye desde la etiqueta, y la etiqueta debe estar en `main`. Esta rama
está lista y verde; falta el merge. Pasos:

```bash
# 1. merge de la rama (PR abierto)
# 2. en main actualizado:
git tag -a v0.3.4-alpha -m "Navegador X 0.3.4-alpha"
git push origin v0.3.4-alpha
# 3. comprobar
gh release view v0.3.4-alpha
```

`package.json` ya está en `0.3.4-alpha`, así que la comprobación de versión pasará.

## 7. Lo que sigue abierto

- **Primer build real de Windows** con el workflow nuevo (no se puede probar aquí).
- **Certificado de firma**: decisión tuya; el código ya lo soporta.
- **Reglas de Firestore**: siguen sin desplegarse en Firebase.
- **Dependabot**: 56 avisos en la rama por defecto y 2 PRs abiertos; `npm audit` local ya
  bajó a 6 (0 críticas).
