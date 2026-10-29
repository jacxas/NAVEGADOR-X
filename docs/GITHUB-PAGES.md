# Edición web en GitHub Pages

Estado a 2026-10-29: **workflow listo y verificado en local; el sitio sigue sin
publicarse porque falta un ajuste que solo puede hacer el propietario del repositorio.**

## Por qué los 4 despliegues anteriores fallaron

Los cuatro `github-pages` que aparecen como *Failed to deploy* (#1 a #4, de los commits
`70f6e3e`, `2551ced`, `1b14193` y `6a1ded7`) son de antes de retirar el `deploy.yml`
antiguo. Todos fallaron por lo mismo: **Pages nunca se habilitó en el repositorio**, así
que `actions/deploy-pages` no tenía dónde publicar. No era un fallo del código ni del
build.

- `GET /repos/jacxas/NAVEGADOR-X/pages` → **404** (el sitio no existe).
- `POST /repos/jacxas/NAVEGADOR-X/pages` (habilitarlo por API) → **403
  `Resource not accessible by integration`**: el token de Actions no tiene permiso de
  administración del repositorio. **Yo no puedo habilitarlo.**

Esos cuatro registros son historial de despliegues: se pueden desactivar desde la API,
pero no borrar, y no afectan a nada una vez que el nuevo workflow funcione.

## Lo que sí está hecho

`.github/workflows/deploy.yml` (nuevo, en `main` tras el merge):

1. **Compila y prueba** en cada push a `main` (`npm run lint`, `npm test`).
2. **Comprueba si Pages está habilitado** (`GET /pages`):
   - `404` → no despliega, deja un aviso y un resumen en el job. **El CI queda en verde**,
     no rojo como antes.
   - Cualquier otro código → despliega (para no saltarse un despliegue real por un fallo
     transitorio de la API).
3. **Verifica el build bajo subpath** con `npm run check:pages`: sirve `dist/` en
   `/NAVEGADOR-X/` y pide cada script, hoja de estilos y fuente. Si Vite volviera a un
   `base` absoluto, esto falla antes de publicar.
4. Sube el artefacto y despliega con `actions/deploy-pages@v4`.

## El único paso que falta (30 segundos)

1. GitHub → **Settings** → **Pages**.
2. *Build and deployment* → **Source: GitHub Actions**.
3. Actions → **Deploy web edition (GitHub Pages)** → **Run workflow** (o un push a
   `main`).

En ese momento la web queda en **https://jacxas.github.io/NAVEGADOR-X/**.

## Qué funcionará y qué no en esa URL

| Función | En Pages |
|---|---|
| Interfaz completa, pestañas, inspector, ajustes | Sí |
| Persistencia local (IndexedDB, localStorage) | Sí, por navegador |
| Fuentes y estilos | Sí, servidas desde el propio sitio (sin peticiones a Google) |
| Navegación externa | Limitada por CSP: las webs se abren en iframe si el sitio lo permite |
| Inicio de sesión con Google | **Probablemente no** hasta añadir `jacxas.github.io` en Firebase → Authentication → Authorized domains. El error se muestra en pantalla y la app sigue usable sin cuenta |
| IA de Gemini | Solo si sirves `/api/v1/ai/*`; en Pages es estático y responde el motor local |

## Comprobaciones hechas en local

```
npm run build                       → dist/ con rutas relativas (./assets/…)
npm run check:pages                 → 8/8 referencias y fuentes en 200
                                      sin @import externo, sin /assets/ absolutos
build con --base=/ (caso malo)      → check:pages sale 1 y explica el fallo
```

El caso negativo se probó a propósito: un build con `base` absoluto hace que
`check:pages` falle con «index.html usa rutas absolutas /assets/». Es decir, la
comprobación no es decorativa.

## Fuentes: se sirven desde el propio sitio

La hoja de estilos importaba `fonts.googleapis.com`, y la CSP de la aplicación
(`style-src 'self'`, `font-src 'self'`) lo bloqueaba: la interfaz llevaba tiempo
mostrándose con las fuentes del sistema sin avisar. Ahora `@fontsource-variable/inter` y
`@fontsource-variable/jetbrains-mono` se empaqueta con el build (12 `.woff2`,
`unicode-range` por subconjunto) y **no se hace ninguna petición a Google**, que además
encaja mejor con la promesa de privacidad del producto.
