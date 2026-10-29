# Release v0.3.6-alpha

- **Fecha de publicación:** 2026-10-29T07:08:01Z
- **Etiqueta:** `v0.3.6-alpha` sobre `d32ef10` (merge del PR #10 en `main`)
- **Workflow:** `Release` `40832638341` — `verify` ✓ → `build` (windows-latest) ✓ → publicación ✓
- **Tipo:** pre-release

## Artefactos y digests (API de GitHub, `digest` calculado por el servidor)

| Archivo | Tamaño (B) | SHA-256 |
| --- | --- | --- |
| `NavegadorX-Setup-0.3.6-alpha.exe` | 103 349 932 | `2d7cd39d4a9d690ee198a19a9c80ff376b4b6de733fda3bdc9ac60db153650f0` |
| `NavegadorX-Portable-0.3.6-alpha.exe` | 103 111 134 | `e8a62a0a9fb5cc4aa5c468b90b150c67d3e23bac75275307e39c50eee355fdbe` |
| `NavegadorX-Setup-0.3.6-alpha.exe.blockmap` | 107 870 | `bf5e968eb69c639ab98730fdc4258e2c3e441dcfdaab8b51f2c4aad0b7751183` |
| `SHA256SUMS.txt` | 203 | `03aa923d9d501845b6948894cd6bcb7adf0ce446f9593186633ad14a3ff6c2d8` |

Consulta reproducible:

```
gh api repos/jacxas/NAVEGADOR-X/releases/tags/v0.3.6-alpha --jq '.assets[] | "\(.name) \(.size) \(.digest)"'
```

## Verificación en Windows

```powershell
Get-FileHash .\NavegadorX-Setup-0.3.6-alpha.exe -Algorithm SHA256
# debe coincidir con 2d7cd39d…650f0
```

## Qué trae

Ver `CHANGELOG.md` y `docs/AUDITORIA-BLOQUE-F-2026-10-29.md`:

1. **Dashboard recortado**: `QuickActions` en lugar de los paneles que duplicaban VPN X y
   Privacy Shield; fuera las insignias inventadas.
2. **Traducción en su sitio** en la Edición de Escritorio (sobre el `<webview>`), con progreso y
   botón «Original»; en la web, panel lateral que no tapa la página.
3. **Copiar y pegar** con plan B y mensaje cuando el navegador lo bloquea; botones en la barra
   de direcciones; texto de la interfaz seleccionable.
4. Sin clave de IA la traducción **no se inventa**: el servidor responde 503 con el motivo.

## Comprobaciones antes de etiquetar

- `npx tsc --noEmit` sin errores.
- `npm run verify` → 8 archivos, **77 pruebas**, 0 fallos (en `8134d65`, el commit etiquetado vía PR #10).
- `npx vite build` → correcto.
- `node scripts/check-version.mjs v0.3.6-alpha` → etiqueta y `package.json` coinciden, `prerelease=true`.
- CI del PR #10: ✓ (41 s).
- Web publicada tras el merge: <https://jacxas.github.io/NAVEGADOR-X/?v=036> anuncia
  **Edición Web v0.3.6-alpha** y muestra el nuevo bloque «Empezar / Estado real».

## Lo que no se pudo verificar aquí

- La traducción dentro de la página, de punta a punta: requiere el `<webview>` de Electron en
  Windows y una clave de IA. Probada la lógica (recogida, troceado, interpretación, aplicación) y
  el camino sin clave.
- `gh release download` sigue devolviendo `EOF` en este entorno; el cruce de `SHA256SUMS.txt` con
  el `.exe` lo hace el usuario.
